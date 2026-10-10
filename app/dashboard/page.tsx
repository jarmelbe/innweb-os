import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import AgencyDashboard from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!process.env.DATABASE_URL) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <span className="auth-eyebrow">INNWEB OS · CRM</span>
          <h1>La base aún no está conectada</h1>
          <p>El CRM no guarda ni muestra datos hasta conectar PostgreSQL. Configura DATABASE_URL y DIRECT_URL de Neon de forma privada, aplica la migración y establece el token de primer acceso.</p>
          <Link className="auth-submit" href="/setup">Ver configuración inicial</Link>
        </section>
        <AuthStyles />
      </main>
    );
  }

  try {
    const context = await getAuthContext();
    if (!context) redirect("/login");
    return <AgencyDashboard user={{ name: context.name, email: context.email }} role={context.role} />;
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("Dashboard could not load CRM session", error);
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <span className="auth-eyebrow">INNWEB OS · CRM</span>
          <h1>Base de datos no disponible</h1>
          <p>No se pudo verificar tu sesión con PostgreSQL. Revisa la conexión antes de continuar; no se muestran métricas simuladas.</p>
          <Link className="auth-submit" href="/login">Volver a iniciar sesión</Link>
        </section>
        <AuthStyles />
      </main>
    );
  }
}

function AuthStyles() {
  return <style>{`
    .auth-shell{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#15151c,#08080a 65%);color:#f5f5f7}
    .auth-card{width:min(100%,520px);padding:36px;border:1px solid #ffffff14;border-radius:22px;background:#101013}
    .auth-eyebrow{font-size:11px;letter-spacing:.15em;color:#92929c}
    .auth-card h1{font-size:30px;letter-spacing:-.04em;margin:16px 0}
    .auth-card p{color:#a1a1aa;line-height:1.6}
    .auth-submit{display:inline-flex;justify-content:center;margin-top:14px;padding:12px 16px;background:#f5f5f7;color:#08080a;border-radius:10px;text-decoration:none;font-weight:700}
  `}</style>;
}
