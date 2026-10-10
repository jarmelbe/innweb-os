"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

type Language = "en" | "es";
type AuditResult = {
  url: string;
  scannedAt: string;
  summary: string;
  quickWins: { title: string; impact: string; category: string; recommendation: string }[];
  focusAreas: { category: string; score: number; issues: number }[];
  scores: Record<string, number>;
  opportunityScore: number;
  classification: string;
  signals: {
    httpStatus: number;
    responseTimeMs: number;
    htmlBytes: number;
    images: number;
    missingAlt: number;
    hasSpf: boolean;
    hasDmarc: boolean;
    hasMail: boolean;
  };
  findings: { severity: string; category: string; title: string; recommendation: string }[];
};

const sampleSites = [
  { label: "Example", url: "https://example.com" },
  { label: "GitHub", url: "https://github.com" },
  { label: "Vercel", url: "https://vercel.com" },
  { label: "Wikipedia", url: "https://www.wikipedia.org" },
  { label: "Apple", url: "https://www.apple.com" },
  { label: "NASA", url: "https://www.nasa.gov" },
];

const copy = {
  en: {
    eyebrow: "INNweb OS",
    title: "Opportunity Finder",
    subtitle: "Find visible website gaps. Turn them into responsible, evidence-based opportunities.",
    placeholder: "https://example.com",
    scan: "Run website audit",
    scanning: "Auditing…",
    overall: "Overall quality",
    opportunity: "Opportunity score",
    findings: "All findings",
    empty: "Enter a public website to analyze its visible quality and infrastructure signals.",
    note: "One public page per audit. No crawling, authentication bypass, or exploit testing.",
    summary: "Site summary",
    quickWins: "Priority quick wins",
    areas: "Focus areas",
    sample: "Try a sample site",
    search: "Lead discovery is not connected yet. Enter a domain or use a sample to run a real audit.",
    categories: "score categories",
    page: "page per audit",
    limit: "HTML analysis cap",
    status: "HTTP status",
    responseTime: "Response time",
    pageSize: "HTML analyzed",
    missingAlt: "Images missing alt",
    observedSignals: "Observed signals",
    issue: "issue",
    issues: "issues",
    emailProtection: "Email protection",
    yes: "Detected",
    no: "Not detected",
  },
  es: {
    eyebrow: "INNweb OS",
    title: "Buscador de Oportunidades",
    subtitle: "Detecta brechas visibles y conviértelas en oportunidades responsables basadas en evidencia.",
    placeholder: "https://ejemplo.com",
    scan: "Auditar sitio web",
    scanning: "Auditando…",
    overall: "Calidad general",
    opportunity: "Puntaje de oportunidad",
    findings: "Todos los hallazgos",
    empty: "Ingresa un sitio público para analizar señales visibles de calidad e infraestructura.",
    note: "Una página pública por auditoría. Sin rastreo, acceso autenticado ni pruebas de explotación.",
    summary: "Resumen del sitio",
    quickWins: "Mejoras prioritarias",
    areas: "Áreas de enfoque",
    sample: "Prueba un sitio ejemplo",
    search: "La búsqueda automática de prospectos aún no está conectada. Ingresa un dominio o prueba un ejemplo.",
    categories: "categorías de puntaje",
    page: "página por auditoría",
    limit: "límite de análisis HTML",
    status: "Estado HTTP",
    responseTime: "Tiempo de respuesta",
    pageSize: "HTML analizado",
    missingAlt: "Imágenes sin alt",
    observedSignals: "Señales observadas",
    issue: "hallazgo",
    issues: "hallazgos",
    emailProtection: "Protección de correo",
    yes: "Detectado",
    no: "No detectado",
  },
} as const;

export default function Home() {
  const [language, setLanguage] = useState<Language>("es");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");
  const [captureBusy, setCaptureBusy] = useState(false);
  const t = copy[language];

  async function checkSession() {
    try {
      const response = await fetch("/api/auth/session");
      const session = await response.json();
      setAuthenticated(response.ok && session.authenticated === true);
    } catch {
      setAuthenticated(false);
    }
  }

  useEffect(() => {
    void checkSession();
  }, []);

  async function runAudit(targetUrl = url) {
    const value = targetUrl.trim();
    if (!value) return;

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/v1/opportunity-finder/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value, language }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Audit failed");
      setResult(data as AuditResult);
      setUrl(value);
      setCompanyName((current) => current || new URL(data.url).hostname.replace(/^www\./, ""));
      setCaptureMessage("");
      void checkSession();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") void runAudit();
  }

  async function captureOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result) return;

    setCaptureBusy(true);
    setCaptureMessage("");
    try {
      const response = await fetch("/api/crm/audits/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactName,
          email: contactEmail,
          phone: contactPhone,
          nextFollowUpAt: nextFollowUpAt ? new Date(`${nextFollowUpAt}T12:00:00.000Z`).toISOString() : undefined,
          audit: result,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la oportunidad.");
      setCaptureMessage(language === "es"
        ? `Listo. Se guardaron el prospecto, la oportunidad y la evidencia del diagnóstico (${data.ids.account.slice(0, 8)}).`
        : `Saved lead, opportunity, and audit evidence (${data.ids.account.slice(0, 8)}).`);
    } catch (caught) {
      setCaptureMessage(caught instanceof Error ? caught.message : "No se pudo guardar la oportunidad.");
    } finally {
      setCaptureBusy(false);
    }
  }

  return (
    <main className="finder-shell">
      <div className="orb one" />
      <div className="orb two" />
      <header className="topbar">
        <div className="brand">
          <span className="mark">in</span>
          <span>{t.eyebrow}</span>
          <Link href="/dashboard" className="command-link">Command Center →</Link>
        </div>
        <div className="seg" aria-label="Language">
          <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
          <button className={language === "es" ? "active" : ""} onClick={() => setLanguage("es")}>ES</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">AUDIT INTELLIGENCE</p>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="hero-stats">
          <div><strong>6</strong><span>{t.categories}</span></div>
          <div><strong>1</strong><span>{t.page}</span></div>
          <div><strong>3 MB</strong><span>{t.limit}</span></div>
        </div>
      </section>

      <section className="search-panel">
        <div className="search">
          <input
            aria-label="Website URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholder}
          />
          <button onClick={() => void runAudit()} disabled={loading || !url.trim()}>
            {loading ? t.scanning : t.scan}
          </button>
        </div>
        <div className="sample-row">
          <span>{t.sample}</span>
          {sampleSites.map((site) => (
            <button
              key={site.url}
              className="sample-pill"
              disabled={loading}
              onClick={() => {
                setUrl(site.url);
                void runAudit(site.url);
              }}
            >
              {site.label}
            </button>
          ))}
        </div>
        <p className="discovery-note">{t.search}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <small>{t.note}</small>
      </section>

      {result ? (
        <section className="results" aria-live="polite">
          <div className="scoreCard">
            <div className="label-row"><span>{t.overall}</span><em>{result.scores.overall}/100</em></div>
            <strong>{result.scores.overall}</strong>
            <div className="bar"><i style={{ width: `${result.scores.overall}%` }} /></div>
          </div>
          <div className="scoreCard opportunity">
            <div className="label-row"><span>{t.opportunity}</span><em>{result.classification}</em></div>
            <strong>{result.opportunityScore}</strong>
            <b>{result.classification}</b>
          </div>
          <div className="summary-card">
            <div className="result-url">{result.url}</div>
            <h3>{t.summary}</h3>
            <p>{result.summary}</p>
          </div>
          <div className="focus-card">
            <h3>{t.areas}</h3>
            <div className="focus-list">
              {result.focusAreas.map((area) => (
                <div key={area.category} className="focus-item">
                  <div className="focus-header"><span>{area.category}</span><strong>{area.score}</strong></div>
                  <div className="mini-bar"><i style={{ width: `${area.score}%` }} /></div>
                  <small>{area.issues} {area.issues === 1 ? t.issue : t.issues}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="grid">
            {Object.entries(result.scores).filter(([key]) => key !== "overall").map(([key, score]) => (
              <article key={key}><span>{key}</span><strong>{score}</strong></article>
            ))}
          </div>
          <div className="signals-card">
            <h3>{t.observedSignals}</h3>
            <div className="signals-grid">
              <div><span>{t.status}</span><strong>{result.signals.httpStatus}</strong></div>
              <div><span>{t.responseTime}</span><strong>{result.signals.responseTimeMs} ms</strong></div>
              <div><span>{t.pageSize}</span><strong>{(result.signals.htmlBytes / 1024).toFixed(1)} KB</strong></div>
              <div><span>{t.missingAlt}</span><strong>{result.signals.missingAlt}/{result.signals.images}</strong></div>
              <div><span>SPF</span><strong>{result.signals.hasSpf ? t.yes : t.no}</strong></div>
              <div><span>DMARC</span><strong>{result.signals.hasDmarc ? t.yes : t.no}</strong></div>
            </div>
          </div>
          <div className="quickWins">
            <h3>{t.quickWins}</h3>
            {result.quickWins.length ? result.quickWins.map((item, index) => (
              <article key={`${item.category}-${index}`}>
                <div><em>{item.impact}</em><span>{item.category}</span></div>
                <h4>{item.title}</h4>
                <p>{item.recommendation}</p>
              </article>
            )) : <p>No priority findings from this page.</p>}
          </div>
          <div className="findings">
            <h2>{t.findings}</h2>
            {result.findings.length ? result.findings.map((finding, index) => (
              <article key={`${finding.category}-${index}`}>
                <div><em>{finding.severity}</em><span>{finding.category}</span></div>
                <h3>{finding.title}</h3>
                <p>{finding.recommendation}</p>
              </article>
            )) : <p>No findings detected in the checks performed.</p>}
          </div>
          <div className="summary-card">
            <h3>{language === "es" ? "Convertir diagnóstico en oportunidad" : "Turn audit into an opportunity"}</h3>
            {!authenticated ? (
              <p>{language === "es" ? "Inicia sesión para guardar esta evidencia en el CRM." : "Sign in to save this evidence to the CRM."} <Link href="/login">{language === "es" ? "Iniciar sesión" : "Sign in"} →</Link></p>
            ) : (
              <form className="capture-form" onSubmit={captureOpportunity}>
                <label>{language === "es" ? "Empresa" : "Company"}<input required minLength={2} maxLength={200} value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label>
                <label>{language === "es" ? "Contacto (opcional)" : "Contact (optional)"}<input maxLength={200} value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
                <label>Email<input type="email" maxLength={254} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label>
                <label>{language === "es" ? "Teléfono" : "Phone"}<input maxLength={40} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
                <label>{language === "es" ? "Próximo seguimiento" : "Next follow-up"}<input type="date" value={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} /></label>
                <button disabled={captureBusy}>{captureBusy ? (language === "es" ? "Guardando…" : "Saving…") : (language === "es" ? "Guardar en CRM" : "Save to CRM")}</button>
              </form>
            )}
            {captureMessage && <p role="status">{captureMessage}</p>}
          </div>
        </section>
      ) : (
        <section className="empty">
          <div className="empty-card"><h2>{t.empty}</h2></div>
        </section>
      )}
      <style jsx>{`
        .capture-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .capture-form label{display:grid;gap:7px;color:#aaaab2;font-size:12px}
        .capture-form input{min-width:0;border:1px solid #ffffff1a;border-radius:9px;background:#08080b;padding:10px;color:#f5f5f7}
        .capture-form button{align-self:end;border:0;border-radius:9px;padding:11px 14px;background:#f5f5f7;color:#08080b;font-weight:750}
        .capture-form button:disabled{opacity:.6}
        @media(max-width:640px){.capture-form{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
