import { AgencyRole, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const ProposalInput = z.object({
  accountId: z.string().min(1),
  opportunityId: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(200),
  validUntil: z.string().datetime().optional(),
  taxRate: z.number().min(0).max(100).default(0),
  estimatedHours: z.number().nonnegative().max(100000).optional(),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive().max(100000),
    unit: z.string().trim().min(1).max(40).default("servicio"),
    unitPrice: z.number().nonnegative().max(999_999_999_999),
    discount: z.number().nonnegative().max(999_999_999_999).default(0),
  })).min(1).max(50),
});

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser();
    if (response) return response;
    const items = await prisma.proposal.findMany({
      where: { agencyId: auth!.agencyId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { account: { select: { id: true, name: true } }, opportunity: { select: { id: true, name: true } }, items: { orderBy: { sortOrder: "asc" } } },
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
    const parsed = ProposalInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid proposal details.", details: parsed.error.flatten() }, { status: 400 });

    const account = await prisma.account.findFirst({
      where: { id: parsed.data.accountId, agencyId: auth!.agencyId, archivedAt: null },
      select: { id: true },
    });
    if (!account) return NextResponse.json({ error: "CRM account was not found." }, { status: 404 });
    if (parsed.data.opportunityId) {
      const opportunity = await prisma.opportunity.findFirst({
        where: { id: parsed.data.opportunityId, agencyId: auth!.agencyId, accountId: account.id },
        select: { id: true },
      });
      if (!opportunity) return NextResponse.json({ error: "Opportunity does not belong to this account." }, { status: 400 });
    }

    const lines = parsed.data.items.map((item) => {
      const quantity = new Prisma.Decimal(String(item.quantity));
      const unitPrice = new Prisma.Decimal(String(item.unitPrice));
      const discount = new Prisma.Decimal(String(item.discount));
      const gross = quantity.mul(unitPrice).toDecimalPlaces(2);
      if (discount.gt(gross)) throw new Error("A line discount cannot exceed its gross amount.");
      return { ...item, quantity, unitPrice, discount, total: gross.sub(discount).toDecimalPlaces(2), gross };
    });
    const subtotal = lines.reduce((total, item) => total.add(item.gross), new Prisma.Decimal(0)).toDecimalPlaces(2);
    const discountTotal = lines.reduce((total, item) => total.add(item.discount), new Prisma.Decimal(0)).toDecimalPlaces(2);
    const taxable = subtotal.sub(discountTotal);
    const tax = taxable.mul(String(parsed.data.taxRate)).div(100).toDecimalPlaces(2);
    const total = taxable.add(tax).toDecimalPlaces(2);
    const number = `IW-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const created = await prisma.$transaction(async (transaction) => {
      const proposal = await transaction.proposal.create({
        data: {
          agencyId: auth!.agencyId,
          accountId: account.id,
          opportunityId: parsed.data.opportunityId || null,
          authorId: auth!.userId,
          number,
          title: parsed.data.title,
          currency: "COP",
          subtotal,
          discount: discountTotal,
          tax,
          total,
          estimatedHours: parsed.data.estimatedHours === undefined ? null : new Prisma.Decimal(String(parsed.data.estimatedHours)),
          validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
          items: {
            create: lines.map((item, index) => ({
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.total,
              sortOrder: index,
            })),
          },
        },
        include: { items: true },
      });
      await transaction.auditEvent.create({
        data: {
          agencyId: auth!.agencyId,
          actorId: auth!.userId,
          action: "proposal.created",
          entityType: "Proposal",
          entityId: proposal.id,
          metadata: { number: proposal.number, total: proposal.total.toString(), currency: proposal.currency },
        },
      });
      return proposal;
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("A line discount")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return unavailable(error);
  }
}
