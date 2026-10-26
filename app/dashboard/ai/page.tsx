import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import AiClient from "./ai-client";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  if (!process.env.DATABASE_URL) {
    return <main style={{ maxWidth: 840, margin: "48px auto", padding: 24 }}>
      <h1>InnWeb OS · Gemini</h1>
      <p>El CRM necesita una conexión a PostgreSQL antes de usar el módulo.</p>
      <Link href="/dashboard">Volver al dashboard</Link>
    </main>;
  }
  let user;
  try { user = await getAuthContext(); } catch { user = null; }
  if (!user) redirect("/login");

  return <main style={{ maxWidth: 840, margin: "36px auto", padding: "0 20px 48px" }}>
    <p style={{ color: "#9cdf3e", letterSpacing: 1, fontSize: 12 }}>INNWEB OS / INTELIGENCIA</p>
    <h1 style={{ marginBottom: 8 }}>Gemini · Asistente IA</h1>
    <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
      Prueba privada: analiza ideas y redacta propuestas. No introduzcas datos personales,
      médicos, financieros ni información confidencial de clientes.
    </p>
    <AiClient />
    <p style={{ marginTop: 24 }}><Link href="/dashboard">← Volver al CRM</Link></p>
  </main>;
}
