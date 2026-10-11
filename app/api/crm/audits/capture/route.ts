import { ActivityStatus, ActivityType, AccountType, AgencyRole, OpportunityStage, Prisma, RecordPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { prisma } from "@/lib/prisma";

const Finding = z.object({
  severity: z.string().max(30),
  category: z.string().max(80),
  title: z.string().max(300),
  recommendation: z.string().max(2000),
});

const AuditCapture = z.object({
  companyName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  nextFollowUpAt: z.string().datetime().optional(),
  audit: z.object({
    url: z.string().url().max(2048),
    scannedAt: z.string().datetime(),
    summary: z.string().max(5000),
    scores: z.record(z.string().max(80), z.number().int().min(0).max(100)),
    opportunityScore: z.number().int().min(0).max(100),
    classification: z.string().max(120),
    signals: z.object({
      httpStatus: z.number().int(),
      responseTimeMs: z.number().int().nonnegative(),
      htmlBytes: z.number().int().nonnegative(),
      images: z.number().int().nonnegative(),
      missingAlt: z.number().int().nonnegative(),
      hasSpf: z.boolean(),
      hasDmarc: z.boolean(),
      hasMail: z.boolean(),
    }),
    findings: z.array(Finding).max(100),
    quickWins: z.array(z.object({
      title: z.string().max(300),
      impact: z.string().max(30),
      category: z.string().max(80),
      recommendation: z.string().max(2000),
    })).max(20),
  }),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.SALES]);
    if (response) return response;
    const parsed = AuditCapture.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid audit or prospect details.", details: parsed.error.flatten() }, { status: 400 });

    const website = new URL(parsed.data.audit.url);
    if (!["http:", "https:"].includes(website.protocol)) {
      return NextResponse.json({ error: "The website URL is invalid." }, { status: 400 });
    }

    const duplicate = await prisma.account.findFirst({
      where: { agencyId: auth!.agencyId, archivedAt: null, website: { contains: website.hostname, mode: "insensitive" } },
      select: { id: true, name: true, website: true },
    });
    if (duplicate) {
      return NextResponse.json({
        error: "A CRM account with this website already exists.",
        duplicate: { id: duplicate.id, name: duplicate.name, website: duplicate.website },
      }, { status: 409 });
    }

    const score = parsed.data.audit.opportunityScore;
    const priority = score >= 75 ? RecordPriority.HIGH : score >= 50 ? RecordPriority.NORMAL : RecordPriority.LOW;
    const storedAt = new Date(parsed.data.audit.scannedAt);
    const result = await prisma.$transaction(async (transaction) => {
      const account = await transaction.account.create({
        data: {
          agencyId: auth!.agencyId,
          ownerId: auth!.userId,
          name: parsed.data.companyName,
          website: website.origin,
          type: AccountType.LEAD,
          priority,
          source: "InnWeb Diagnostics: Intelligence / Rank Pulse",
          serviceInterest: "Website improvement",
          nextFollowUpAt: parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null,
        },
      });

      let contactId: string | undefined;
      if (parsed.data.contactName || parsed.data.email || parsed.data.phone) {
        const names = (parsed.data.contactName || "Contact").trim().split(/\s+/);
        const contact = await transaction.contact.create({
          data: {
            agencyId: auth!.agencyId,
            accountId: account.id,
            firstName: names[0],
            lastName: names.slice(1).join(" ") || null,
            email: parsed.data.email?.toLowerCase() || null,
            phone: parsed.data.phone || null,
            isPrimary: true,
          },
        });
        contactId = contact.id;
      }

      const opportunity = await transaction.opportunity.create({
        data: {
          agencyId: auth!.agencyId,
          accountId: account.id,
          primaryContactId: contactId,
          ownerId: auth!.userId,
          name: `Website improvement · ${account.name}`,
          serviceName: "Website improvement",
          stage: OpportunityStage.DISCOVERED,
          currency: "COP",
          amount: null,
          probability: null,
          notes: `Audit opportunity score: ${score}/100 (${parsed.data.audit.classification}). The score is heuristic and is not a quote or revenue estimate.`,
        },
      });

      const audit = parsed.data.audit;
      const evidence = await transaction.websiteAudit.create({
        data: {
          agencyId: auth!.agencyId,
          accountId: account.id,
          opportunityId: opportunity.id,
          authorId: auth!.userId,
          requestedUrl: parsed.data.audit.url,
          finalUrl: parsed.data.audit.url,
          httpStatus: audit.signals.httpStatus,
          responseTimeMs: audit.signals.responseTimeMs,
          htmlBytes: audit.signals.htmlBytes,
          overallScore: audit.scores.overall ?? null,
          opportunityScore: audit.opportunityScore,
          classification: audit.classification,
          scoringVersion: "heuristic-v1",
          source: "opportunity-finder",
          auditedAt: storedAt,
          signals: audit.signals as Prisma.InputJsonValue,
          findings: audit.findings as Prisma.InputJsonValue,
          recommendations: audit.quickWins as Prisma.InputJsonValue,
        },
      });

      await transaction.activity.create({
        data: {
          agencyId: auth!.agencyId,
          accountId: account.id,
          contactId,
          opportunityId: opportunity.id,
          assigneeId: auth!.userId,
          type: ActivityType.WEBSITE_AUDIT,
          status: ActivityStatus.COMPLETED,
          subject: "Website audit completed",
          description: `${audit.findings.length} findings recorded. Score values are heuristic.`,
          completedAt: storedAt,
        },
      });

      await transaction.auditEvent.create({
        data: {
          agencyId: auth!.agencyId,
          actorId: auth!.userId,
          action: "opportunity_finder.captured",
          entityType: "Account",
          entityId: account.id,
          metadata: { opportunityId: opportunity.id, websiteAuditId: evidence.id, source: "opportunity-finder" },
        },
      });

      return { account, opportunity, websiteAudit: evidence };
    });

    return NextResponse.json({
      ids: {
        account: result.account.id,
        opportunity: result.opportunity.id,
        websiteAudit: result.websiteAudit.id,
      },
    }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}
