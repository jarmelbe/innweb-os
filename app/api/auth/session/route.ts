import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ authenticated: false, databaseConfigured: false });
  }

  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ authenticated: false });

    return NextResponse.json({
      authenticated: true,
      user: { id: auth.userId, email: auth.email, name: auth.name },
      agency: { id: auth.agencyId, name: auth.agencyName },
      role: auth.role,
    });
  } catch (error) {
    console.error("Session lookup failed", error);
    return NextResponse.json({ error: "Could not verify session." }, { status: 503 });
  }
}
