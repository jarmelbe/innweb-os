import { AgencyRole, ActivityStatus, ActivityType, ProjectStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const CreateProject = z.object({
  accountId: z.string().min(1),
  opportunityId: z.string().min(1).optional(),
  sourceProposalId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(200),
  type: z.string().trim().max(120).optional(),
  dueAt: z.string().datetime().optional(),
  budgetCop: z.number().nonnegative().max(999_999_999_999).optional(),
  notes: z.string().max(4000).optional(),
});

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser();
    if (response) return response;
    const items = await prisma.project.findMany({
      where: { agencyId: auth!.agencyId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
      include: { account: { select: { id: true, name: true } }, tasks: { orderBy: { dueAt: "asc" }, take: 10 } },
    });
    return NextResponse.json({ items });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.PRODUCTION]);
    if (response) return response;
    const parsed = CreateProject.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid project details.", details: parsed.error.flatten() }, { status: 400 });

    const account = await prisma.account.findFirst({ where: { id: parsed.data.accountId, agencyId: auth!.agencyId }, select: { id: true } });
    if (!account) return NextResponse.json({ error: "CRM account was not found." }, { status: 404 });
    if (parsed.data.sourceProposalId) {
      const proposal = await prisma.proposal.findFirst({
        where: { id: parsed.data.sourceProposalId, agencyId: auth!.agencyId, accountId: account.id, status: "ACCEPTED", project: null },
        select: { id: true, opportunityId: true, total: true },
      });
      if (!proposal) return NextResponse.json({ error: "An accepted, unconverted proposal for this account is required." }, { status: 409 });
    }
    if (parsed.data.opportunityId) {
      const opportunity = await prisma.opportunity.findFirst({
        where: { id: parsed.data.opportunityId, agencyId: auth!.agencyId, accountId: account.id },
        select: { id: true },
      });
      if (!opportunity) return NextResponse.json({ error: "Opportunity does not belong to this account." }, { status: 400 });
    }

    const project = await prisma.$transaction(async (transaction) => {
      const proposal = parsed.data.sourceProposalId
        ? await transaction.proposal.findFirst({
            where: { id: parsed.data.sourceProposalId, agencyId: auth!.agencyId, accountId: account.id, status: "ACCEPTED", project: null },
            select: { id: true, opportunityId: true, total: true },
          })
        : null;
      if (parsed.data.sourceProposalId && !proposal) return null;

      const created = await transaction.project.create({
        data: {
          agencyId: auth!.agencyId,
          accountId: account.id,
          opportunityId: parsed.data.opportunityId || proposal?.opportunityId || null,
          sourceProposalId: proposal?.id || null,
          name: parsed.data.name,
          type: parsed.data.type || null,
          status: ProjectStatus.PLANNING,
          dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
          budget: parsed.data.budgetCop !== undefined ? parsed.data.budgetCop : proposal?.total ?? null,
          notes: parsed.data.notes || null,
        },
      });
      await transaction.activity.create({
        data: {
          agencyId: auth!.agencyId,
          accountId: account.id,
          opportunityId: created.opportunityId,
          assigneeId: auth!.userId,
          type: ActivityType.TASK,
          status: ActivityStatus.OPEN,
          subject: `Kick off project: ${created.name}`,
          dueAt: created.dueAt,
        },
      });
      await transaction.auditEvent.create({
        data: { agencyId: auth!.agencyId, actorId: auth!.userId, action: "project.created", entityType: "Project", entityId: created.id },
      });
      return created;
    });

    if (!project) return NextResponse.json({ error: "Proposal was already converted to a project." }, { status: 409 });
    return NextResponse.json({ item: project }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}
