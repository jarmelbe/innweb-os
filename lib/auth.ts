import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { AgencyRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "innweb_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  agencyId: string;
  agencyName: string;
  role: AgencyRole;
  sessionId: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = encoded.split(":");
  if (algorithm !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(userId: string, agencyId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.authSession.create({
    data: { userId, agencyId, tokenHash: hashToken(token), expiresAt },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          disabledAt: true,
        },
      },
      agency: { select: { id: true, name: true } },
    },
  });

  if (!session || session.expiresAt <= new Date() || session.user.disabledAt) {
    if (session) await prisma.authSession.delete({ where: { id: session.id } });
    (await cookies()).delete(SESSION_COOKIE);
    return null;
  }

  const membership = await prisma.membership.findUnique({
    where: { agencyId_userId: { agencyId: session.agencyId, userId: session.user.id } },
    select: { role: true },
  });
  if (!membership || session.agency.id !== session.agencyId) {
    await prisma.authSession.delete({ where: { id: session.id } });
    (await cookies()).delete(SESSION_COOKIE);
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    agencyId: session.agencyId,
    agencyName: session.agency.name,
    role: membership.role,
    sessionId: session.id,
  };
}

export function hasRole(context: AuthContext, roles: AgencyRole[]): boolean {
  return roles.includes(context.role);
}
