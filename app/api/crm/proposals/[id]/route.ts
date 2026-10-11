import { AccountType, ActivityStatus, ActivityType, AgencyRole, OpportunityStage, ProposalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const StatusUpdate = z.object({ status: z.nativeEnum(ProposalStatus) });

const transitions: Record<ProposalStatus, ProposalStatus[]> = {
  DRAFT: [ProposalStatus.SENT, ProposalStatus.CANCELED],
  SENT: [ProposalStatus.VIEWED, ProposalStatus.ACCEPTED, ProposalStatus.REJECTED, ProposalStatus.EXPIRED, ProposalStatus.CANCELED],
  VIEWED: [ProposalStatus.ACCEPTED, ProposalStatus.REJECTED, ProposalStatus.EXPIRED, ProposalStatus.CANCELED],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELED: [],
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.SALES]);
    if (response) return response;
    const { id } = await params;
    const parsed = StatusUpdate.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid proposal status." }, { status: 400 });

    const result = await prisma.$transaction(async (transaction) => {
      const proposal = await transaction.proposal.findFirst({
        where: { id, agencyId: auth!.agencyId },
        select: { id: true, accountId: true, opportunityId: true, status: true, number: true },
      });
      if (!proposal) return { kind: "not-found" as const };
      if (!transitions[proposal.status].includes(parsed.data.status)) {
        return { kind: "invalid-transition" as const, current: proposal.status };
      }

      const now = new Date();
      await transaction.proposal.update({
        where: { id: proposal.id },
        data: {
          status: parsed.data.status,
          ...(parsed.data.status === ProposalStatus.SENT ? { sentAt: now } : {}),
          ...(parsed.data.status === ProposalStatus.ACCEPTED ? { acceptedAt: now } : {}),
          ...(parsed.data.status === ProposalStatus.REJECTED ? { rejectedAt: now } : {}),
        },
      });

      if (parsed.data.status === ProposalStatus.ACCEPTED) {
        await transaction.account.updateMany({
          where: { id: proposal.accountId, agencyId: auth!.agencyId },
          data: { type: AccountType.CUSTOMER, convertedAt: now },
        });
        if (proposal.opportunityId) {
          await transaction.opportunity.updateMany({
            where: { id: proposal.opportunityId, agencyId: auth!.agencyId },
            data: { stage: OpportunityStage.WON, actualCloseAt: now },
          });
        }
      }

      await transaction.activity.create({
        data: {
          agencyId: auth!.agencyId,
          accountId: proposal.accountId,
          opportunityId: proposal.opportunityId,
          assigneeId: auth!.userId,
          type: ActivityType.STATUS_CHANGE,
          status: ActivityStatus.COMPLETED,
          subject: `Proposal ${proposal.number}: ${parsed.data.status}`,
          completedAt: now,
        },
      });
      await transaction.auditEvent.create({
        data: {
          agencyId: auth!.agencyId,
          actorId: auth!.userId,
          action: "proposal.status_changed",
          entityType: "Proposal",
          entityId: proposal.id,
          metadata: { from: proposal.status, to: parsed.data.status },
        },
      });
      return { kind: "updated" as const };
    });

    if (result.kind === "not-found") return NextResponse.json({ error: "Proposal was not found." }, { status: 404 });
    if (result.kind === "invalid-transition") return NextResponse.json({ error: `Proposal cannot move from ${result.current} to ${parsed.data.status}.` }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return unavailable(error);
  }
}
