import { OpportunityStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser();
    if (response) return response;

    const [
      accounts,
      openOpportunities,
      customers,
      projects,
      overdueActivities,
      stageCounts,
      pipeline,
      audits,
      latestAudit,
      proposalCount,
      acceptedProposalCount,
      closedOpportunities,
      wonOpportunities,
    ] = await Promise.all([
      prisma.account.count({ where: { agencyId: auth!.agencyId, archivedAt: null } }),
      prisma.opportunity.count({
        where: {
          agencyId: auth!.agencyId,
          stage: { notIn: [OpportunityStage.WON, OpportunityStage.LOST] },
        },
      }),
      prisma.account.count({ where: { agencyId: auth!.agencyId, type: "CUSTOMER", archivedAt: null } }),
      prisma.project.count({ where: { agencyId: auth!.agencyId, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } }),
      prisma.activity.count({
        where: {
          agencyId: auth!.agencyId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          dueAt: { lt: new Date() },
        },
      }),
      prisma.opportunity.groupBy({
        by: ["stage"],
        where: { agencyId: auth!.agencyId },
        _count: { _all: true },
      }),
      prisma.opportunity.aggregate({
        where: {
          agencyId: auth!.agencyId,
          stage: { notIn: [OpportunityStage.WON, OpportunityStage.LOST] },
        },
        _sum: { amount: true },
      }),
      prisma.websiteAudit.aggregate({
        where: { agencyId: auth!.agencyId },
        _count: { _all: true },
        _avg: { overallScore: true, opportunityScore: true },
      }),
      prisma.websiteAudit.findFirst({
        where: { agencyId: auth!.agencyId },
        orderBy: { auditedAt: "desc" },
        select: {
          requestedUrl: true,
          overallScore: true,
          opportunityScore: true,
          classification: true,
          auditedAt: true,
        },
      }),
      prisma.proposal.count({ where: { agencyId: auth!.agencyId } }),
      prisma.proposal.count({ where: { agencyId: auth!.agencyId, status: "ACCEPTED" } }),
      prisma.opportunity.count({
        where: { agencyId: auth!.agencyId, stage: { in: [OpportunityStage.WON, OpportunityStage.LOST] } },
      }),
      prisma.opportunity.count({ where: { agencyId: auth!.agencyId, stage: OpportunityStage.WON } }),
    ]);

    return NextResponse.json({
      counts: { accounts, openOpportunities, customers, projects, overdueActivities },
      pipelineValueCop: pipeline._sum.amount?.toString() ?? null,
      stages: stageCounts.map((item) => ({ stage: item.stage, count: item._count._all })),
      intelligence: {
        auditCount: audits._count._all,
        averageOverallScore: audits._avg.overallScore,
        averageOpportunityScore: audits._avg.opportunityScore,
        latestAudit: latestAudit ? {
          ...latestAudit,
          auditedAt: latestAudit.auditedAt.toISOString(),
        } : null,
      },
      proposalConversion: {
        total: proposalCount,
        accepted: acceptedProposalCount,
      },
      historicalCloseRate: {
        closed: closedOpportunities,
        won: wonOpportunities,
      },
    });
  } catch (error) {
    return unavailable(error);
  }
}
