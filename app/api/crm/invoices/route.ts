import { AgencyRole, InvoiceStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const NewInvoice = z.object({
  accountId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  subtotalCop: z.number().nonnegative().max(999_999_999_999),
  taxCop: z.number().nonnegative().max(999_999_999_999).default(0),
  dueAt: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
});

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.FINANCE]);
    if (response) return response;
    const items = await prisma.invoice.findMany({
      where: { agencyId: auth!.agencyId },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        account: { select: { name: true } },
        project: { select: { name: true } },
        payments: { select: { amount: true, paidAt: true } },
      },
    });
    return NextResponse.json({ items: items.map((invoice) => {
      const paid = invoice.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
      return { ...invoice, paid: paid.toString(), balance: invoice.total.sub(paid).toString() };
    }) });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.FINANCE]);
    if (response) return response;
    const parsed = NewInvoice.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid invoice details.", details: parsed.error.flatten() }, { status: 400 });
    const account = await prisma.account.findFirst({ where: { id: parsed.data.accountId, agencyId: auth!.agencyId }, select: { id: true } });
    if (!account) return NextResponse.json({ error: "CRM account was not found." }, { status: 404 });
    if (parsed.data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: parsed.data.projectId, agencyId: auth!.agencyId, accountId: account.id },
        select: { id: true },
      });
      if (!project) return NextResponse.json({ error: "Project does not belong to this account." }, { status: 400 });
    }

    const subtotal = new Prisma.Decimal(String(parsed.data.subtotalCop));
    const tax = new Prisma.Decimal(String(parsed.data.taxCop));
    const total = subtotal.add(tax).toDecimalPlaces(2);
    const invoice = await prisma.$transaction(async (transaction) => {
      const created = await transaction.invoice.create({
        data: {
          agencyId: auth!.agencyId,
          accountId: account.id,
          projectId: parsed.data.projectId || null,
          number: `FAC-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          status: InvoiceStatus.ISSUED,
          currency: "COP",
          subtotal,
          tax,
          total,
          issuedAt: new Date(),
          dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
          notes: parsed.data.notes || null,
        },
      });
      await transaction.auditEvent.create({
        data: { agencyId: auth!.agencyId, actorId: auth!.userId, action: "invoice.issued", entityType: "Invoice", entityId: created.id },
      });
      return created;
    });
    return NextResponse.json({ item: invoice }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}
