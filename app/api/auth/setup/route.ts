import { AgencyRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SetupInput = z.object({
  token: z.string().min(32).max(256),
  agencyName: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

function tokenMatches(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
}

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ databaseConfigured: false, setupAvailable: false });
  if (!process.env.INNWEB_SETUP_TOKEN) return NextResponse.json({ databaseConfigured: true, setupConfigured: false, setupAvailable: false });

  try {
    const userExists = (await prisma.user.count()) > 0;
    return NextResponse.json({ databaseConfigured: true, setupConfigured: true, setupAvailable: !userExists });
  } catch {
    return NextResponse.json({ error: "Database is not available" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const configuredToken = process.env.INNWEB_SETUP_TOKEN;
  if (!process.env.DATABASE_URL || !configuredToken) {
    return NextResponse.json({ error: "Initial setup is not configured" }, { status: 503 });
  }

  const parsed = SetupInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide valid setup details and a password of at least 12 characters." }, { status: 400 });
  }
  if (!tokenMatches(parsed.data.token, configuredToken)) {
    return NextResponse.json({ error: "Invalid setup token" }, { status: 403 });
  }

  const slugBase = parsed.data.agencyName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  if (!slugBase) return NextResponse.json({ error: "Agency name cannot create a valid workspace identifier." }, { status: 400 });

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const created = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(73102026, 1)`;
      if ((await transaction.user.count()) > 0) return null;

      const agency = await transaction.agency.create({
        data: { name: parsed.data.agencyName, slug: slugBase },
      });
      const user = await transaction.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          passwordHash,
          memberships: { create: { agencyId: agency.id, role: AgencyRole.OWNER } },
        },
        select: { id: true },
      });

      return { userId: user.id, agencyId: agency.id };
    });

    if (!created) return NextResponse.json({ error: "Initial setup has already been completed." }, { status: 409 });
    await createSession(created.userId, created.agencyId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("P2002")) {
      return NextResponse.json({ error: "That email or workspace is already in use." }, { status: 409 });
    }
    console.error("Initial workspace setup failed", error);
    return NextResponse.json({ error: "Could not complete initial setup." }, { status: 500 });
  }
}
