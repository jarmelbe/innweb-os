import { AgencyRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const TimeEntryInput = z.object({
  workDate: z.string().datetime(),
  hours: z.number().positive().max(24),
  costRateCop: z.number().nonnegative().max(999_999_999).optional(),
  billableRateCop: z.number().nonnegative().max(999_999_999).optional(),
  billable: z.boolean().default(true),
  description: z.string().trim().min(2).max(1000),
  taskId: z.string().min(1).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.PRODUCTION]);
    if (response) return response;
    const { id } = await params;
    const parsed = TimeEntryInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid time entry.", details: parsed.error.flatten() }, { status: 400 });
    const project = await prisma.project.findFirst({ where: { id, agencyId: auth!.agencyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project was not found." }, { status: 404 });
    if (parsed.data.taskId) {
      const task = await prisma.workItem.findFirst({ where: { id: parsed.data.taskId, projectId: id, agencyId: auth!.agencyId }, select: { id: true } });
      if (!task) return NextResponse.json({ error: "Task does not belong to this project." }, { status: 400 });
    }

    const entry = await prisma.$transaction(async (transaction) => {
      const created = await transaction.timeEntry.create({
        data: {
          agencyId: auth!.agencyId,
          projectId: id,
          taskId: parsed.data.taskId || null,
          userId: auth!.userId,
          workDate: new Date(parsed.data.workDate),
          hours: new Prisma.Decimal(String(parsed.data.hours)),
          costRate: parsed.data.costRateCop === undefined ? null : new Prisma.Decimal(String(parsed.data.costRateCop)),
          billableRate: parsed.data.billableRateCop === undefined ? null : new Prisma.Decimal(String(parsed.data.billableRateCop)),
          billable: parsed.data.billable,
          description: parsed.data.description,
        },
      });
      const entries = await transaction.timeEntry.findMany({
        where: { agencyId: auth!.agencyId, projectId: id },
        select: { hours: true, costRate: true },
      });
      const actualCost = entries.every((item) => item.costRate !== null)
        ? entries.reduce((sum, item) => sum.add(item.hours.mul(item.costRate!)), new Prisma.Decimal(0)).toDecimalPlaces(2)
        : null;
      await transaction.project.updateMany({ where: { id, agencyId: auth!.agencyId }, data: { actualCost } });
      await transaction.auditEvent.create({
        data: { agencyId: auth!.agencyId, actorId: auth!.userId, action: "time_entry.created", entityType: "TimeEntry", entityId: created.id },
      });
      return created;
    });
    return NextResponse.json({ item: entry }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}
