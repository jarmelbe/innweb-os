import { AgencyRole, OpportunityStage, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const UpdateOpportunity = z.object({
  stage: z.nativeEnum(OpportunityStage).optional(),
  amount: z.number().nonnegative().max(999_999_999_999).nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  expectedCloseAt: z.string().datetime().nullable().optional(),
  lostReason: z.string().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.SALES]);
    if (response) return response;
    const { id } = await params;
    const parsed = UpdateOpportunity.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid opportunity update.", details: parsed.error.flatten() }, { status: 400 });

    if (parsed.data.stage === OpportunityStage.LOST && !parsed.data.lostReason?.trim()) {
      return NextResponse.json({ error: "Provide a reason when marking an opportunity lost." }, { status: 400 });
    }
    const existing = await prisma.opportunity.findFirst({ where: { id, agencyId: auth!.agencyId }, select: { id: true, stage: true, accountId: true } });
    if (!existing) return NextResponse.json({ error: "Opportunity was not found." }, { status: 404 });

    const data: Prisma.OpportunityUpdateManyMutationInput = {};
    if (parsed.data.stage !== undefined) data.stage = parsed.data.stage;
    if (parsed.data.amount !== undefined) data.amount = parsed.data.amount === null ? null : new Prisma.Decimal(parsed.data.amount);
    if (parsed.data.probability !== undefined) data.probability = parsed.data.probability;
    if (parsed.data.expectedCloseAt !== undefined) data.expectedCloseAt = parsed.data.expectedCloseAt ? new Date(parsed.data.expectedCloseAt) : null;
    if (parsed.data.lostReason !== undefined) data.lostReason = parsed.data.lostReason;
    if (parsed.data.stage === OpportunityStage.WON || parsed.data.stage === OpportunityStage.LOST) data.actualCloseAt = new Date();
    else if (parsed.data.stage) data.actualCloseAt = null;

    const result = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.opportunity.updateMany({ where: { id, agencyId: auth!.agencyId }, data });
      if (!updated.count) return false;
      if (parsed.data.stage === OpportunityStage.WON) {
        await transaction.account.updateMany({
          where: { id: existing.accountId, agencyId: auth!.agencyId },
          data: { type: "CUSTOMER", convertedAt: new Date() },
        });
      }
      await transaction.auditEvent.create({
        data: {
          agencyId: auth!.agencyId,
          actorId: auth!.userId,
          action: parsed.data.stage && parsed.data.stage !== existing.stage ? "opportunity.stage_changed" : "opportunity.updated",
          entityType: "Opportunity",
          entityId: id,
          metadata: { fromStage: existing.stage, toStage: parsed.data.stage || existing.stage },
        },
      });
      return true;
    });
    if (!result) return NextResponse.json({ error: "Opportunity was not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return unavailable(error);
  }
}
