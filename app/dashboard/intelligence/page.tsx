import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import IntelligenceConsole from "./intelligence-console";
import "./intelligence.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "InnWeb Intelligence · Centro privado | InnWeb OS",
  robots: { index: false, follow: false },
};

export default async function IntelligencePage() {
  if (!process.env.DATABASE_URL) {
    return <main className="ix-shell"><div className="ix-wrap">
      <div className="ix-eyebrow">INNWEB OS · ACCESO PRIVADO</div>
      <h1>Intelligence necesita el CRM conectado.</h1>
      <p>Configura la base PostgreSQL y el primer usuario del OS antes de usar este centro de trabajo.</p>
      <Link href="/setup">Ver configuración</Link>
    </div></main>;
  }

  let user = null;
  try { user = await getAuthContext(); } catch { /* Database unavailable: fall back to login */ }
  if (!user) redirect("/login");

  return <main className="ix-shell">
    <div className="ix-wrap">
      <nav className="ix-nav" aria-label="Centro de herramientas">
        <Link href="/dashboard">← Volver al CRM</Link>
        <span>INNWEB / INTELLIGENCE</span>
        <Link href="/dashboard/ai">Asistente libre</Link>
      </nav>
      <header className="ix-hero">
        <div className="ix-eyebrow">INTELIGENCIA PARA TRABAJAR MEJOR</div>
        <h1>Las herramientas cambian. El criterio permanece.</h1>
        <p>Un centro privado para transformar evidencia, contexto y buenas ideas en borradores útiles. La IA propone; tu equipo comprueba, decide y aprueba.</p>
        <div className="ix-heroMeta">Sesión privada · {user.agencyName} · Ningún borrador se publica o envía automáticamente</div>
      </header>
      <IntelligenceConsole isConfigured={Boolean(process.env.GEMINI_API_KEY)} />
    </div>
  </main>;
}
