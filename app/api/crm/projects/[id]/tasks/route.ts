import { AgencyRole, RecordPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const NewTask = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(4000).optional(),
  priority: z.nativeEnum(RecordPriority).default(RecordPriority.NORMAL),
  dueAt: z.string().datetime().optional(),
  estimateHours: z.number().nonnegative().max(100000).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser();
    if (response) return response;
    const { id } = await params;
    const tasks = await prisma.workItem.findMany({
      where: { projectId: id, agencyId: auth!.agencyId },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: { assignee: { select: { name: true } }, subtasks: true },
    });
    return NextResponse.json({ items: tasks });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.PRODUCTION]);
    if (response) return response;
    const { id } = await params;
    const parsed = NewTask.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid task details.", details: parsed.error.flatten() }, { status: 400 });
    const project = await prisma.project.findFirst({ where: { id, agencyId: auth!.agencyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project was not found." }, { status: 404 });

    const task = await prisma.$transaction(async (transaction) => {
      const created = await transaction.workItem.create({
        data: {
          agencyId: auth!.agencyId,
          projectId: id,
          assigneeId: auth!.userId,
          title: parsed.data.title,
          description: parsed.data.description || null,
          priority: parsed.data.priority,
          dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
          estimateHours: parsed.data.estimateHours ?? null,
        },
      });
      await transaction.auditEvent.create({
        data: { agencyId: auth!.agencyId, actorId: auth!.userId, action: "task.created", entityType: "WorkItem", entityId: created.id },
      });
      return created;
    });
    return NextResponse.json({ item: task }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}
