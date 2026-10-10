import { AgencyRole, CommissionStatus, InvoiceStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const PaymentInput = z.object({
  amountCop: z.number().positive().max(999_999_999_999),
  paidAt: z.string().datetime(),
  method: z.string().trim().max(80).optional(),
  reference: z.string().trim().max(160).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.FINANCE]);
    if (response) return response;
    const { id } = await params;
    const parsed = PaymentInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment details.", details: parsed.error.flatten() }, { status: 400 });

    const result = await prisma.$transaction(async (transaction) => {
      const invoice = await transaction.invoice.findFirst({
        where: { id, agencyId: auth!.agencyId },
        include: { payments: { select: { amount: true } } },
      });
      if (!invoice) return { kind: "not-found" as const };
      if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.DRAFT) return { kind: "not-payable" as const };
      const previousPaid = invoice.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
      const amount = new Prisma.Decimal(String(parsed.data.amountCop));
      const balance = invoice.total.sub(previousPaid);
      if (amount.gt(balance)) return { kind: "overpayment" as const, balance: balance.toString() };

      const payment = await transaction.payment.create({
        data: {
          agencyId: auth!.agencyId,
          invoiceId: invoice.id,
          amount,
          paidAt: new Date(parsed.data.paidAt),
          method: parsed.data.method || null,
          reference: parsed.data.reference || null,
          notes: parsed.data.notes || null,
        },
      });
      const paid = previousPaid.add(amount);
      const status = paid.gte(invoice.total) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
      await transaction.invoice.updateMany({ where: { id, agencyId: auth!.agencyId }, data: { status } });

      if (invoice.projectId) {
        const project = await transaction.project.findFirst({
          where: { id: invoice.projectId, agencyId: auth!.agencyId },
          select: { opportunityId: true, actualCost: true },
        });
        if (project?.opportunityId) {
          const commissions = await transaction.referralCommission.findMany({
            where: { agencyId: auth!.agencyId, opportunityId: project.opportunityId, status: { not: CommissionStatus.VOID } },
            select: { id: true, collectedRevenue: true, attributedCosts: true, commissionRate: true },
          });
          for (const commission of commissions) {
            if (commission.collectedRevenue === null || commission.attributedCosts === null) continue;
            const revenue = commission.collectedRevenue.add(amount);
            const net = revenue.sub(commission.attributedCosts);
            const due = net.gt(0) ? net.mul(commission.commissionRate).div(100).toDecimalPlaces(2) : new Prisma.Decimal(0);
            await transaction.referralCommission.updateMany({
              where: { id: commission.id, agencyId: auth!.agencyId },
              data: { collectedRevenue: revenue, netProfit: net, amountDue: due },
            });
          }
        }
      }

      await transaction.auditEvent.create({
        data: {
          agencyId: auth!.agencyId,
          actorId: auth!.userId,
          action: "invoice.payment_recorded",
          entityType: "Invoice",
          entityId: invoice.id,
          metadata: { paymentId: payment.id, amount: amount.toString(), status },
        },
      });
      return { kind: "created" as const, payment, status, balance: invoice.total.sub(paid).toString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "not-found") return NextResponse.json({ error: "Invoice was not found." }, { status: 404 });
    if (result.kind === "not-payable") return NextResponse.json({ error: "This invoice cannot accept payments in its current status." }, { status: 409 });
    if (result.kind === "overpayment") return NextResponse.json({ error: "Payment exceeds the outstanding balance.", balance: result.balance }, { status: 400 });
    return NextResponse.json({ item: result.payment, status: result.status, balance: result.balance }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}
