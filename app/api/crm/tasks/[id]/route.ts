import { AgencyRole, WorkItemStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const TaskUpdate = z.object({
  status: z.nativeEnum(WorkItemStatus).optional(),
  title: z.string().trim().min(2).max(200).optional(),
  dueAt: z.string().datetime().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.PRODUCTION]);
    if (response) return response;
    const { id } = await params;
    const parsed = TaskUpdate.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid task update.", details: parsed.error.flatten() }, { status: 400 });
    const task = await prisma.workItem.findFirst({ where: { id, agencyId: auth!.agencyId }, select: { id: true } });
    if (!task) return NextResponse.json({ error: "Task was not found." }, { status: 404 });

    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.workItem.updateMany({
        where: { id, agencyId: auth!.agencyId },
        data: {
          ...(parsed.data.status ? { status: parsed.data.status, completedAt: parsed.data.status === WorkItemStatus.DONE ? new Date() : null } : {}),
          ...(parsed.data.title ? { title: parsed.data.title } : {}),
          ...(parsed.data.dueAt !== undefined ? { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null } : {}),
        },
      });
      if (!updated.count) return;
      const task = await transaction.workItem.findFirst({
        where: { id, agencyId: auth!.agencyId },
        select: { projectId: true },
      });
      if (task) {
        const [total, done] = await Promise.all([
          transaction.workItem.count({ where: { projectId: task.projectId, agencyId: auth!.agencyId, status: { not: WorkItemStatus.CANCELED } } }),
          transaction.workItem.count({ where: { projectId: task.projectId, agencyId: auth!.agencyId, status: WorkItemStatus.DONE } }),
        ]);
        await transaction.project.updateMany({
          where: { id: task.projectId, agencyId: auth!.agencyId },
          data: { progress: total === 0 ? 0 : Math.round((done / total) * 100) },
        });
      }
      await transaction.auditEvent.create({
        data: { agencyId: auth!.agencyId, actorId: auth!.userId, action: "task.updated", entityType: "WorkItem", entityId: id },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return unavailable(error);
  }
}
