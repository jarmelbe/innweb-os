import { AccountType, ActivityStatus, ActivityType, AgencyRole, RecordPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const CreateAccount = z.object({
  name: z.string().trim().min(2).max(200),
  website: z.string().trim().url().max(2048).optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().length(2).default("CO"),
  type: z.nativeEnum(AccountType).default(AccountType.LEAD),
  priority: z.nativeEnum(RecordPriority).default(RecordPriority.NORMAL),
  source: z.string().trim().max(120).optional(),
  serviceInterest: z.string().trim().max(200).optional(),
  notes: z.string().max(4000).optional(),
  nextFollowUpAt: z.string().datetime().optional(),
  contact: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100).optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional(),
    title: z.string().trim().max(120).optional(),
  }).optional(),
});

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim().slice(0, 120);
    const cursor = searchParams.get("cursor") || undefined;
    const items = await prisma.account.findMany({
      where: {
        agencyId: auth!.agencyId,
        archivedAt: null,
        ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { website: { contains: query, mode: "insensitive" as const } }] } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        contacts: { where: { isPrimary: true }, take: 1, select: { firstName: true, lastName: true, email: true, phone: true } },
        _count: { select: { opportunities: true, activities: true } },
      },
    });

    const hasMore = items.length > 50;
    const page = hasMore ? items.slice(0, 50) : items;
    return NextResponse.json({ items: page, nextCursor: hasMore ? page[page.length - 1]?.id : null });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.SALES]);
    if (response) return response;
    const parsed = CreateAccount.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid account details.", details: parsed.error.flatten() }, { status: 400 });

    const account = await prisma.$transaction(async (transaction) => {
      const created = await transaction.account.create({
        data: {
          agencyId: auth!.agencyId,
          ownerId: auth!.userId,
          name: parsed.data.name,
          website: parsed.data.website || null,
          industry: parsed.data.industry || null,
          city: parsed.data.city || null,
          country: parsed.data.country,
          type: parsed.data.type,
          priority: parsed.data.priority,
          source: parsed.data.source || "Manual",
          serviceInterest: parsed.data.serviceInterest || null,
          notes: parsed.data.notes || null,
          nextFollowUpAt: parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null,
        },
      });
      if (parsed.data.contact) {
        await transaction.contact.create({
          data: {
            agencyId: auth!.agencyId,
            accountId: created.id,
            firstName: parsed.data.contact.firstName,
            lastName: parsed.data.contact.lastName || null,
            email: parsed.data.contact.email?.toLowerCase() || null,
            phone: parsed.data.contact.phone || null,
            title: parsed.data.contact.title || null,
            isPrimary: true,
          },
        });
      }
      if (parsed.data.nextFollowUpAt) {
        await transaction.activity.create({
          data: {
            agencyId: auth!.agencyId,
            accountId: created.id,
            assigneeId: auth!.userId,
            type: ActivityType.TASK,
            status: ActivityStatus.OPEN,
            subject: "Follow up with " + created.name,
            dueAt: new Date(parsed.data.nextFollowUpAt),
          },
        });
      }
      await transaction.auditEvent.create({
        data: {
          agencyId: auth!.agencyId,
          actorId: auth!.userId,
          action: "account.created",
          entityType: "Account",
          entityId: created.id,
          metadata: { source: parsed.data.source || "Manual" },
        },
      });
      return created;
    });

    return NextResponse.json({ item: account }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}
