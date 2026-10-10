import { AgencyRole, OpportunityStage, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const NewOpportunity = z.object({
  accountId: z.string().min(1),
  name: z.string().trim().min(2).max(200),
  serviceName: z.string().trim().max(200).optional(),
  amount: z.number().nonnegative().max(999_999_999_999).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseAt: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
});

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser();
    if (response) return response;
    const items = await prisma.opportunity.findMany({
      where: { agencyId: auth!.agencyId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
      include: {
        account: { select: { id: true, name: true, website: true } },
        owner: { select: { name: true } },
        _count: { select: { proposals: true, activities: true } },
      },
    });
    return NextResponse.json({ items });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.SALES]);
    if (response) return response;
    const parsed = NewOpportunity.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid opportunity details.", details: parsed.error.flatten() }, { status: 400 });

    const accountExists = await prisma.account.findFirst({
      where: { id: parsed.data.accountId, agencyId: auth!.agencyId, archivedAt: null },
      select: { id: true },
    });
    if (!accountExists) return NextResponse.json({ error: "CRM account was not found." }, { status: 404 });

    const opportunity = await prisma.$transaction(async (transaction) => {
      const created = await transaction.opportunity.create({
        data: {
          agencyId: auth!.agencyId,
          accountId: parsed.data.accountId,
          ownerId: auth!.userId,
          name: parsed.data.name,
          serviceName: parsed.data.serviceName || null,
          stage: OpportunityStage.DISCOVERED,
          amount: parsed.data.amount === undefined ? null : new Prisma.Decimal(parsed.data.amount),
          probability: parsed.data.probability ?? null,
          expectedCloseAt: parsed.data.expectedCloseAt ? new Date(parsed.data.expectedCloseAt) : null,
          notes: parsed.data.notes || null,
        },
      });
      await transaction.auditEvent.create({
        data: {
          agencyId: auth!.agencyId,
          actorId: auth!.userId,
          action: "opportunity.created",
          entityType: "Opportunity",
          entityId: created.id,
        },
      });
      return created;
    });
    return NextResponse.json({ item: opportunity }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}
