import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LoginInput = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function allowAttempt(request: Request, email: string): boolean {
  const now = Date.now();
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${ip}:${email.toLowerCase()}`;
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_ATTEMPTS) return false;
  current.count += 1;
  if (attempts.size > 10_000) {
    for (const [entry, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(entry);
    }
  }
  return true;
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  }

  const parsed = LoginInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }
  if (!allowAttempt(request, parsed.data.email)) {
    return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429, headers: { "retry-after": "900" } });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: {
        memberships: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { agencyId: true },
        },
      },
    });
    const valid = user?.passwordHash
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : false;

    if (!user || !valid || user.disabledAt || !user.memberships[0]) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user.id, user.memberships[0].agencyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sign-in failed", error);
    return NextResponse.json({ error: "Could not sign in right now." }, { status: 503 });
  }
}
