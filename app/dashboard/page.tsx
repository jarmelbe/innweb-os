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
          <div className="auth-brand"><span className="brand-logo-wrap"><img src="/innweb-logo.png" alt="InnWeb" /></span><b>OS</b></div>
          <span className="auth-eyebrow">InnWeb OS · CRM</span>
          <h1>La base aún no está conectada</h1>
          <p>El CRM no guarda ni muestra datos hasta conectar PostgreSQL. Configura DATABASE_URL y DIRECT_URL de Neon de forma privada, aplica la migración y establece el token de primer acceso.</p>
          <Link className="auth-submit" href="/setup">Ver configuración inicial</Link>
        </section>
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
          <div className="auth-brand"><span className="brand-logo-wrap"><img src="/innweb-logo.png" alt="InnWeb" /></span><b>OS</b></div>
          <span className="auth-eyebrow">InnWeb OS · CRM</span>
          <h1>Base de datos no disponible</h1>
          <p>No se pudo verificar tu sesión con PostgreSQL. Revisa la conexión antes de continuar; no se muestran métricas simuladas.</p>
          <Link className="auth-submit" href="/login">Volver a iniciar sesión</Link>
        </section>
      </main>
    );
  }
}
