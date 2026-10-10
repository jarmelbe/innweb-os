"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Language = "es" | "en";
type Prospect = {
  company: string;
  domain: string;
  score: number;
  value: number;
  stage: "discovered" | "qualified" | "proposal" | "won";
  risk: "low" | "medium" | "high";
};

const prospects: Prospect[] = [
  { company: "Nova Dental", domain: "novadental.co", score: 92, value: 4500, stage: "qualified", risk: "high" },
  { company: "Caribe Realty", domain: "cariberealty.co", score: 87, value: 6200, stage: "proposal", risk: "medium" },
  { company: "Verde Legal", domain: "verdelegal.co", score: 84, value: 3800, stage: "discovered", risk: "high" },
  { company: "Norte Constructores", domain: "norteconstructores.co", score: 79, value: 7900, stage: "won", risk: "low" },
];

const copy = {
  es: {
    product: "Centro de Comando",
    greeting: "Buenos días",
    intro: "Una vista clara de oportunidades, clientes e infraestructura.",
    nav: ["Resumen", "Oportunidades", "Prospectos", "Clientes", "Sitios", "Infraestructura"],
    scan: "Analizar un sitio",
    revenue: "Ingresos potenciales",
    active: "Prospectos activos",
    managed: "Sitios administrados",
    health: "Salud de infraestructura",
    pipeline: "Pipeline de oportunidades",
    top: "Oportunidades prioritarias",
    company: "Empresa",
    score: "Puntaje",
    stage: "Etapa",
    value: "Valor estimado",
    status: "Estado operativo",
    ssl: "SSL activo",
    dns: "DNS saludable",
    backups: "Copias verificadas",
    incidents: "Incidentes abiertos",
    demo: "Datos de demostración hasta conectar PostgreSQL.",
    stages: { discovered: "Descubierto", qualified: "Calificado", proposal: "Propuesta", won: "Ganado" },
  },
  en: {
    product: "Command Center",
    greeting: "Good morning",
    intro: "A clear view of opportunities, clients, and infrastructure.",
    nav: ["Overview", "Opportunities", "Prospects", "Clients", "Websites", "Infrastructure"],
    scan: "Audit a website",
    revenue: "Potential revenue",
    active: "Active prospects",
    managed: "Managed websites",
    health: "Infrastructure health",
    pipeline: "Opportunity pipeline",
    top: "Priority opportunities",
    company: "Company",
    score: "Score",
    stage: "Stage",
    value: "Estimated value",
    status: "Operational status",
    ssl: "SSL active",
    dns: "Healthy DNS",
    backups: "Verified backups",
    incidents: "Open incidents",
    demo: "Demo data until PostgreSQL is connected.",
    stages: { discovered: "Discovered", qualified: "Qualified", proposal: "Proposal", won: "Won" },
  },
};

function money(value: number, language: Language) {
  return new Intl.NumberFormat(language === "es" ? "es-CO" : "en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(value);
}

export default function AgencyDashboard() {
  const [language, setLanguage] = useState<Language>("es");
  const [activeNav, setActiveNav] = useState(0);
  const t = copy[language];
  const revenue = useMemo(() => prospects.reduce((sum, item) => sum + item.value, 0), []);
  const stageCounts = useMemo(() => prospects.reduce<Record<string, number>>((acc, item) => {
    acc[item.stage] = (acc[item.stage] || 0) + 1;
    return acc;
  }, {}), []);

  return (
    <main className="agency-shell">
      <aside className="agency-sidebar">
        <div className="agency-logo"><span>in</span><b>INNweb OS</b></div>
        <nav aria-label="Agency navigation">
          {t.nav.map((item, index) => (
            <button key={item} className={activeNav === index ? "selected" : ""} onClick={() => setActiveNav(index)}>
              <i>{["⌂", "◎", "◇", "◌", "▱", "⌁"][index]}</i>{item}
            </button>
          ))}
        </nav>
        <div className="agency-profile">
          <div className="avatar">IW</div>
          <div><strong>INNweb</strong><span>Agency workspace</span></div>
        </div>
      </aside>

      <section className="agency-content">
        <header className="agency-topbar">
          <div><span className="muted">INNweb OS</span><strong>{t.product}</strong></div>
          <div className="top-actions">
            <div className="language-switch">
              <button className={language === "es" ? "active" : ""} onClick={() => setLanguage("es")}>ES</button>
              <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
            </div>
            <Link className="primary-action" href="/">{t.scan}</Link>
          </div>
        </header>

        <div className="agency-hero">
          <div><p className="eyebrow">AGENCY INTELLIGENCE</p><h1>{t.greeting}, INNweb.</h1><p>{t.intro}</p></div>
          <span className="live-pill"><i /> Sistemas operativos</span>
        </div>

        <section className="metric-grid">
          <article><span>{t.revenue}</span><strong>{money(revenue, language)}</strong><small>+18.4% · pipeline</small></article>
          <article><span>{t.active}</span><strong>{prospects.length}</strong><small>2 high priority</small></article>
          <article><span>{t.managed}</span><strong>18</strong><small>17 online · 1 staging</small></article>
          <article><span>{t.health}</span><strong>97.8%</strong><small>All regions</small></article>
        </section>

        <section className="agency-panels">
          <article className="pipeline-card">
            <div className="section-heading"><div><span>PIPELINE</span><h2>{t.pipeline}</h2></div><button>···</button></div>
            <div className="pipeline-bars">
              {(["discovered", "qualified", "proposal", "won"] as const).map((stage, index) => (
                <div key={stage}>
                  <span><b>{t.stages[stage]}</b><em>{stageCounts[stage] || 0}</em></span>
                  <div><i style={{ width: `${[45, 68, 82, 100][index]}%` }} /></div>
                </div>
              ))}
            </div>
          </article>

          <article className="health-card">
            <div className="section-heading"><div><span>INFRASTRUCTURE TWIN</span><h2>{t.status}</h2></div><b className="health-score">98</b></div>
            <ul>
              <li><span><i className="ok" />{t.ssl}</span><strong>18/18</strong></li>
              <li><span><i className="ok" />{t.dns}</span><strong>17/18</strong></li>
              <li><span><i className="ok" />{t.backups}</span><strong>18/18</strong></li>
              <li><span><i className="warn" />{t.incidents}</span><strong>1</strong></li>
            </ul>
          </article>
        </section>

        <section className="opportunities-table">
          <div className="section-heading"><div><span>OPPORTUNITY FINDER</span><h2>{t.top}</h2></div><Link href="/">+ {t.scan}</Link></div>
          <div className="table-scroll"><table><thead><tr><th>{t.company}</th><th>{t.score}</th><th>{t.stage}</th><th>{t.value}</th><th /></tr></thead>
            <tbody>{prospects.map((item) => <tr key={item.domain}>
              <td><div className="company-cell"><span>{item.company.slice(0, 2).toUpperCase()}</span><div><strong>{item.company}</strong><small>{item.domain}</small></div></div></td>
              <td><b className={`score ${item.score >= 88 ? "hot" : ""}`}>{item.score}</b></td>
              <td><span className={`stage ${item.stage}`}>{t.stages[item.stage]}</span></td>
              <td><strong>{money(item.value, language)}</strong></td>
              <td><button className="row-button">→</button></td>
            </tr>)}</tbody>
          </table></div>
        </section>
        <p className="demo-note">{t.demo}</p>
      </section>
    </main>
  );
}
