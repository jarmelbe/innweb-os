import { NextResponse } from "next/server";
import { AgencyRole } from "@prisma/client";
import { getAuthContext, hasRole } from "@/lib/auth";

export async function requireCrmUser(roles?: AgencyRole[]) {
  const auth = await getAuthContext();
  if (!auth) {
    return { auth: null, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (roles && !hasRole(auth, roles)) {
    return { auth: null, response: NextResponse.json({ error: "Insufficient agency permissions." }, { status: 403 }) };
  }
  return { auth, response: null };
}

export function unavailable(error: unknown) {
  console.error("CRM database operation failed", error);
  return NextResponse.json({ error: "CRM data is temporarily unavailable." }, { status: 503 });
}
