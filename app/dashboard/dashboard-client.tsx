"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { dataSheetNames, importableDataSheetNames, type DataSheetName } from "@/lib/sheet-config";

type Language = "es" | "en";
type Overview = {
  counts: { accounts: number; openOpportunities: number; customers: number; projects: number; overdueActivities: number };
  pipelineValueCop: string | null;
  stages: { stage: string; count: number }[];
  intelligence: {
    auditCount: number;
    averageOverallScore: number | null;
    averageOpportunityScore: number | null;
    latestAudit: {
      requestedUrl: string;
      overallScore: number | null;
      opportunityScore: number | null;
      classification: string | null;
      auditedAt: string;
    } | null;
  };
  proposalConversion: { total: number; accepted: number };
  historicalCloseRate: { closed: number; won: number };
};
type CrmAccount = {
  id: string;
  name: string;
  website: string | null;
  type: string;
  priority: string;
  updatedAt: string;
  contacts: { firstName: string; lastName: string | null; email: string | null; phone: string | null }[];
  _count: { opportunities: number; activities: number };
};
type Opportunity = {
  id: string;
  name: string;
  stage: string;
  amount: string | null;
  expectedCloseAt: string | null;
  account: { id: string; name: string };
};
type Proposal = {
  id: string;
  number: string;
  title: string;
  status: string;
  total: string;
  account: { id: string; name: string };
};
type Project = {
  id: string;
  name: string;
  status: string;
  progress: number;
  dueAt: string | null;
  account: { id: string; name: string };
  tasks: { id: string; title: string; status: string; dueAt: string | null }[];
};
type Invoice = {
  id: string;
  number: string;
  status: string;
  total: string;
  paid: string;
  balance: string;
  dueAt: string | null;
  account: { name: string };
  project: { name: string } | null;
};
type CsvPreview = { totalRows: number; validRows: number; created?: number; updated?: number; errors: { row: number; message: string }[]; error?: string };
type ProspectCandidate = {
  externalId: string;
  name: string;
  category: string;
  city: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string;
  alreadyImported: boolean;
};

const copy = {
  es: {
    product: "Centro de Comando",
    greeting: "CRM profesional",
    intro: "Una sola base para el ciclo comercial y operativo de InnWeb.",
    nav: ["Estado", "Intelligence", "Prospectos", "Clientes", "Propuestas", "Proyectos", "Finanzas"],
    scan: "Analizar un sitio",
    status: "Resumen del CRM",
    dataPolicy: "No se muestran empresas, ingresos, clientes ni métricas ficticias.",
    observatory: "Intelligence / Rank Pulse",
    measured: "Datos medidos",
    diagnosticScore: "Puntaje diagnóstico",
    opportunityScore: "Puntaje de oportunidad",
    proposalAcceptance: "Propuestas aceptadas",
    auditCount: "Auditorías registradas",
    latestAudit: "Último diagnóstico guardado",
    noAudits: "Aún no hay diagnósticos guardados en el CRM.",
    heuristicNote: "Puntajes heurísticos del análisis de una página; no son posiciones reales en Google.",
    operationalMap: "Ciclo operativo InnWeb",
    volumeByModule: "Registros actuales por módulo · no representa conversiones entre etapas",
    audits: "Diagnósticos",
    opportunities: "Oportunidades abiertas",
    proposals: "Propuestas",
    activeProjects: "Proyectos activos",
    scoreSimulator: "Simulador de mejora Rank Pulse",
    scoreSimulatorNote: "Escenario teórico: cierra una parte de la brecha del puntaje heurístico actual. No predice rankings ni resultados de buscadores.",
    findingsResolved: "Brecha del puntaje que se supone corregir",
    projectedDiagnostic: "Puntaje diagnóstico simulado",
    noAuditToSimulate: "Guarda primero un diagnóstico para simular un escenario.",
    commercialSimulator: "Simulador comercial",
    estimateOnly: "Estimación hipotética · no es ingreso contable ni compromiso comercial",
    scenarioOpportunities: "Oportunidades nuevas en el escenario",
    scenarioConversion: "Conversión estimada (%)",
    scenarioTicket: "Valor promedio supuesto (COP)",
    scenarioResult: "Valor potencial estimado",
    useObservedRate: "Usar tasa histórica",
    noObservedRate: "No hay cierres históricos para calcular una tasa observada.",
    sections: [
      { id: "ventas", title: "CRM comercial", description: "Empresas y contactos, responsables, prioridad, origen, segmentación y conversión de prospecto a cliente." },
      { id: "pipeline", title: "Pipeline y seguimiento", description: "Oportunidades por etapa, probabilidad, monto y cierre previsto; llamadas, reuniones, tareas y próximos contactos." },
      { id: "propuestas", title: "Cotizador y propuestas", description: "Catálogo de servicios, conceptos editables, tarifas, descuentos, impuestos, versiones y vigencia de cada propuesta." },
      { id: "proyectos", title: "Producción", description: "Proyectos, hitos, tareas, responsables, fechas, horas registradas, costos y avance." },
      { id: "finanzas", title: "Finanzas y referidos", description: "Facturas, pagos parciales, saldos y comisiones calculadas sobre ingresos y costos atribuibles verificados." },
      { id: "gobierno", title: "Equipo y trazabilidad", description: "Espacios por agencia, roles de acceso y registro de cambios para auditar la operación." },
    ],
    modulesTitle: "Capacidades previstas",
    csvTitle: "Convivencia con Google Sheets",
    csvDescription: "Intercambio manual compatible con las 14 pestañas: descarga cualquier pestaña e importa las hojas operativas con vista previa, permisos y validación. Facturas y comisiones solo se exportan para no inventar pagos o saldos sin evidencia.",
    rolesTitle: "Seguridad antes de producción",
    rolesDescription: "El acceso usa sesión privada, permisos por agencia y roles Owner/Admin/Ventas/Producción/Finanzas/Lectura. No conectes datos reales hasta verificar la configuración y los respaldos de PostgreSQL.",
    accountsTitle: "Empresas y prospectos",
    customersTitle: "Clientes",
    discoverTitle: "Buscar negocios potenciales",
    discoverDescription: "Encuentra negocios publicados en OpenStreetMap y guárdalos como prospectos para validar su encaje.",
    city: "Ciudad de Colombia",
    category: "Sector",
    allBusinesses: "Todos los negocios",
    healthBusinesses: "Salud",
    foodBusinesses: "Restaurantes y cafés",
    hospitalityBusinesses: "Hoteles y turismo",
    professionalBusinesses: "Servicios profesionales",
    retailBusinesses: "Comercio",
    searchProspects: "Buscar prospectos",
    searchingProspects: "Buscando…",
    selectProspects: "Seleccionados",
    importProspects: "Agregar seleccionados al CRM",
    importingProspects: "Agregando…",
    noDiscoveryResults: "No se encontraron negocios en esa ciudad. Prueba el nombre del municipio o un sector diferente.",
    alreadyImported: "Ya está en el CRM",
    noWebsite: "Sitio no listado",
    prospectImported: "prospectos agregados",
    duplicatesSkipped: "duplicados omitidos",
    openListing: "Ver fuente",
    osmAttribution: "Datos del listado comunitario de",
    newAccount: "Agregar empresa",
    companyName: "Nombre de empresa",
    website: "Sitio web",
    contact: "Contacto principal",
    email: "Email",
    phone: "Teléfono",
    followUp: "Próximo seguimiento",
    save: "Guardar prospecto",
    noAccounts: "Todavía no hay empresas en el CRM.",
    noCustomers: "Aún no hay clientes registrados. Una cuenta pasa a cliente al ganar su oportunidad o aceptar una propuesta. También puedes importar la pestaña Clientes.",
    loadError: "No fue posible cargar los datos reales del CRM.",
    stageNames: { DISCOVERED: "Descubierto", QUALIFIED: "Calificado", NEEDS_ANALYSIS: "Análisis", PROPOSAL: "Propuesta", NEGOTIATION: "Negociación", WON: "Ganado", LOST: "Perdido" } as Record<string, string>,
    proposalTitle: "Cotizador",
    proposalAccount: "Cliente",
    proposalLabel: "Título de propuesta",
    lineDescription: "Descripción del servicio",
    price: "Precio COP",
    taxRate: "Impuesto %",
    createProposal: "Crear propuesta",
    noProposals: "Aún no hay propuestas.",
    proposalCreated: "Propuesta creada con éxito.",
    opportunitiesTitle: "Oportunidades",
    noOpportunities: "No hay oportunidades en el pipeline.",
    closeDate: "Cierre previsto",
    quoteState: "Estado de propuesta",
    projectTitle: "Proyectos",
    projectName: "Nombre del proyecto",
    fromProposal: "Crear proyecto desde propuesta aceptada",
    createProject: "Iniciar proyecto",
    noProjects: "Aún no hay proyectos.",
    taskTitle: "Nueva tarea",
    addTask: "Agregar tarea",
    logHours: "Registrar horas",
    hours: "Horas",
    workDescription: "Concepto de trabajo",
    projectCreated: "Proyecto iniciado.",
    invoiceTitle: "Facturas y pagos",
    invoiceCreate: "Emitir factura",
    invoiceSubtotal: "Base COP",
    invoiceTax: "Impuesto COP",
    invoiceDue: "Vencimiento",
    invoiceConcept: "Concepto",
    invoicePayment: "Registrar pago",
    invoiceAmount: "Monto del pago COP",
    invoiceMethod: "Método",
    invoiceReference: "Referencia",
    noInvoices: "No hay facturas registradas.",
    invoiceCreated: "Factura emitida.",
    paymentCreated: "Pago registrado.",
  },
  en: {
    product: "Command Center",
    greeting: "Professional CRM",
    intro: "One source of truth for InnWeb's commercial and operational cycle.",
    nav: ["Status", "Intelligence", "Prospects", "Clients", "Proposals", "Projects", "Finance"],
    scan: "Audit a website",
    status: "CRM overview",
    dataPolicy: "No fictional companies, revenue, customers, or metrics are shown.",
    observatory: "Intelligence / Rank Pulse",
    measured: "Measured data",
    diagnosticScore: "Diagnostic score",
    opportunityScore: "Opportunity score",
    proposalAcceptance: "Accepted proposals",
    auditCount: "Audits recorded",
    latestAudit: "Latest saved diagnostic",
    noAudits: "No diagnostics have been saved to the CRM yet.",
    heuristicNote: "Heuristic scores from a single-page analysis; these are not actual Google positions.",
    operationalMap: "InnWeb operating cycle",
    volumeByModule: "Current records by module · not conversions between stages",
    audits: "Diagnostics",
    opportunities: "Open opportunities",
    proposals: "Proposals",
    activeProjects: "Active projects",
    scoreSimulator: "Rank Pulse improvement simulator",
    scoreSimulatorNote: "Theoretical scenario: close part of the current heuristic-score gap. It does not predict search rankings or results.",
    findingsResolved: "Score gap assumed to be addressed",
    projectedDiagnostic: "Simulated diagnostic score",
    noAuditToSimulate: "Save a diagnostic first to simulate a scenario.",
    commercialSimulator: "Commercial simulator",
    estimateOnly: "Hypothetical estimate · not booked revenue or a commercial commitment",
    scenarioOpportunities: "New opportunities in scenario",
    scenarioConversion: "Estimated conversion (%)",
    scenarioTicket: "Assumed average value (COP)",
    scenarioResult: "Estimated potential value",
    useObservedRate: "Use historical rate",
    noObservedRate: "There are no historical closed deals to calculate an observed rate.",
    sections: [
      { id: "ventas", title: "Sales CRM", description: "Company and contact records, ownership, priority, source, segmentation, and prospect-to-customer conversion." },
      { id: "pipeline", title: "Pipeline and follow-up", description: "Opportunities by stage, probability, amount, and expected close; calls, meetings, tasks, and next contacts." },
      { id: "propuestas", title: "Quotes and proposals", description: "Service catalog, editable line items, rates, discounts, taxes, revisions, and proposal validity." },
      { id: "proyectos", title: "Delivery operations", description: "Projects, milestones, tasks, owners, deadlines, logged hours, costs, and progress." },
      { id: "finanzas", title: "Finance and referrals", description: "Invoices, partial payments, balances, and commissions based on verified attributable revenue and costs." },
      { id: "gobierno", title: "Team and audit trail", description: "Agency workspaces, access roles, and change history for operational traceability." },
    ],
    modulesTitle: "Planned capabilities",
    csvTitle: "Google Sheets coexistence",
    csvDescription: "Manual exchange for all 14 sheets: download any sheet and preview validated imports for supported operational tabs. Invoices and commissions are export-only to avoid inventing payments or balances.",
    rolesTitle: "Security before production",
    rolesDescription: "Access uses private sessions, agency membership checks, and Owner/Admin/Sales/Production/Finance/Viewer roles. Verify PostgreSQL configuration and backups before using real customer data.",
    accountsTitle: "Companies and prospects",
    customersTitle: "Customers",
    discoverTitle: "Find potential customers",
    discoverDescription: "Find businesses listed in OpenStreetMap and save them as prospects to validate their fit.",
    city: "City in Colombia",
    category: "Industry",
    allBusinesses: "All businesses",
    healthBusinesses: "Healthcare",
    foodBusinesses: "Restaurants and cafes",
    hospitalityBusinesses: "Hotels and tourism",
    professionalBusinesses: "Professional services",
    retailBusinesses: "Retail",
    searchProspects: "Find prospects",
    searchingProspects: "Searching…",
    selectProspects: "Selected",
    importProspects: "Add selected to CRM",
    importingProspects: "Adding…",
    noDiscoveryResults: "No businesses were found in that city. Try the municipality name or another industry.",
    alreadyImported: "Already in CRM",
    noWebsite: "Website not listed",
    prospectImported: "prospects added",
    duplicatesSkipped: "duplicates skipped",
    openListing: "View source",
    osmAttribution: "Community directory data from",
    newAccount: "Add company",
    companyName: "Company name",
    website: "Website",
    contact: "Primary contact",
    email: "Email",
    phone: "Phone",
    followUp: "Next follow-up",
    save: "Save lead",
    noAccounts: "There are no company records in the CRM yet.",
    noCustomers: "There are no customers yet. An account becomes a customer when its opportunity is won or a proposal is accepted. You can also import the Clients sheet.",
    loadError: "Could not load real CRM data.",
    stageNames: { DISCOVERED: "Discovered", QUALIFIED: "Qualified", NEEDS_ANALYSIS: "Needs analysis", PROPOSAL: "Proposal", NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost" } as Record<string, string>,
    proposalTitle: "Quote builder",
    proposalAccount: "Customer",
    proposalLabel: "Proposal title",
    lineDescription: "Service description",
    price: "Price COP",
    taxRate: "Tax %",
    createProposal: "Create proposal",
    noProposals: "No proposals yet.",
    proposalCreated: "Proposal created.",
    opportunitiesTitle: "Opportunities",
    noOpportunities: "No opportunities in the pipeline.",
    closeDate: "Expected close",
    quoteState: "Proposal status",
    projectTitle: "Projects",
    projectName: "Project name",
    fromProposal: "Create project from accepted proposal",
    createProject: "Start project",
    noProjects: "No projects yet.",
    taskTitle: "New task",
    addTask: "Add task",
    logHours: "Log time",
    hours: "Hours",
    workDescription: "Work description",
    projectCreated: "Project started.",
    invoiceTitle: "Invoices and payments",
    invoiceCreate: "Issue invoice",
    invoiceSubtotal: "Subtotal COP",
    invoiceTax: "Tax COP",
    invoiceDue: "Due date",
    invoiceConcept: "Description",
    invoicePayment: "Record payment",
    invoiceAmount: "Payment amount COP",
    invoiceMethod: "Method",
    invoiceReference: "Reference",
    noInvoices: "No invoices recorded.",
    invoiceCreated: "Invoice issued.",
    paymentCreated: "Payment recorded.",
  },
};

function Odometer({ value, title, label }: { value: number | null; title?: string; label: string }) {
  const score = value === null ? null : Math.max(0, Math.min(100, Math.round(value)));
  const circumference = 2 * Math.PI * 36;

  return (
    <div className="odometer" aria-label={title ? `${title}: ${score ?? "—"}${label}` : undefined}>
      <svg viewBox="0 0 88 88" aria-hidden="true">
        <circle className="odometer-track" cx="44" cy="44" r="36" />
        {score !== null && (
          <circle
            className="odometer-value"
            cx="44"
            cy="44"
            r="36"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - score / 100)}
          />
        )}
      </svg>
      <strong>{score === null ? "—" : score}<small>{label}</small></strong>
      {title && <span>{title}</span>}
    </div>
  );
}

export default function AgencyDashboard({ user, role }: { user: { name: string; email: string }; role: string }) {
  const [language, setLanguage] = useState<Language>("es");
  const [activeSection, setActiveSection] = useState(0);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadError, setLoadError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [discoveryCity, setDiscoveryCity] = useState("");
  const [discoveryCategory, setDiscoveryCategory] = useState("all");
  const [prospectCandidates, setProspectCandidates] = useState<ProspectCandidate[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  const [prospectMessage, setProspectMessage] = useState("");
  const [discoveringProspects, setDiscoveringProspects] = useState(false);
  const [importingProspects, setImportingProspects] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [proposalName, setProposalName] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalPrice, setProposalPrice] = useState("");
  const [proposalTax, setProposalTax] = useState("0");
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalSaving, setProposalSaving] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [acceptedProposalId, setAcceptedProposalId] = useState("");
  const [projectMessage, setProjectMessage] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const [csvSheet, setCsvSheet] = useState<DataSheetName>("Prospectos");
  const [csvExportSheet, setCsvExportSheet] = useState<DataSheetName>("Inicio");
  const [csvContents, setCsvContents] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvMessage, setCsvMessage] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceAccountId, setInvoiceAccountId] = useState("");
  const [invoiceProjectId, setInvoiceProjectId] = useState("");
  const [scoreGapToClose, setScoreGapToClose] = useState(0);
  const [scenarioOpportunities, setScenarioOpportunities] = useState("");
  const [scenarioConversionRate, setScenarioConversionRate] = useState("");
  const [scenarioAverageTicket, setScenarioAverageTicket] = useState("");
  const t = copy[language];

  const loadCrm = useCallback(async () => {
    try {
      const canViewFinance = ["OWNER", "ADMIN", "FINANCE"].includes(role);
      const [summaryResponse, accountsResponse, opportunitiesResponse, proposalsResponse, projectsResponse, invoicesResponse] = await Promise.all([
        fetch("/api/crm/overview"),
        fetch("/api/crm/accounts"),
        fetch("/api/crm/opportunities"),
        fetch("/api/crm/proposals"),
        fetch("/api/crm/projects"),
        canViewFinance ? fetch("/api/crm/invoices") : Promise.resolve(null),
      ]);
      const [summaryData, accountsData, opportunitiesData, proposalsData, projectsData, invoicesData] = await Promise.all([
        summaryResponse.json(), accountsResponse.json(), opportunitiesResponse.json(), proposalsResponse.json(), projectsResponse.json(),
        invoicesResponse ? invoicesResponse.json() : Promise.resolve({ items: [] }),
      ]);
      if (!summaryResponse.ok || !accountsResponse.ok || !opportunitiesResponse.ok || !proposalsResponse.ok || !projectsResponse.ok || (invoicesResponse && !invoicesResponse.ok)) {
        throw new Error(summaryData.error || accountsData.error || opportunitiesData.error || proposalsData.error || projectsData.error || invoicesData.error || t.loadError);
      }
      setLoadError("");
      setOverview(summaryData as Overview);
      setAccounts(accountsData.items as CrmAccount[]);
      setOpportunities(opportunitiesData.items as Opportunity[]);
      setProposals(proposalsData.items as Proposal[]);
      setProjects(projectsData.items as Project[]);
      setInvoices(invoicesData.items as Invoice[]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t.loadError);
    }
  }, [role, t.loadError]);

  useEffect(() => {
    void Promise.resolve().then(loadCrm);
  }, [loadCrm]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/crm/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          website: website || undefined,
          source: "Manual",
          nextFollowUpAt: followUp ? new Date(`${followUp}T12:00:00.000Z`).toISOString() : undefined,
          contact: contactName ? { firstName: contactName.trim().split(/\s+/)[0], lastName: contactName.trim().split(/\s+/).slice(1).join(" "), email: contactEmail || undefined, phone: contactPhone || undefined } : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.loadError);
      setCompanyName("");
      setWebsite("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setFollowUp("");
      await loadCrm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.loadError);
    } finally {
      setSaving(false);
    }
  }

  async function discoverProspects(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDiscoveringProspects(true);
    setProspectMessage("");
    setProspectCandidates([]);
    setSelectedProspects([]);
    try {
      const response = await fetch("/api/crm/prospects/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ city: discoveryCity, category: discoveryCategory }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t.loadError);
      const candidates = result.candidates as ProspectCandidate[];
      setProspectCandidates(candidates);
      setSelectedProspects(candidates.filter((candidate) => !candidate.alreadyImported).slice(0, 20).map((candidate) => candidate.externalId));
      if (candidates.length === 0) setProspectMessage(t.noDiscoveryResults);
    } catch (error) {
      setProspectMessage(error instanceof Error ? error.message : t.loadError);
    } finally {
      setDiscoveringProspects(false);
    }
  }

  async function importDiscoveredProspects() {
    const candidates = prospectCandidates.filter((candidate) => selectedProspects.includes(candidate.externalId));
    if (candidates.length === 0) return;
    setImportingProspects(true);
    setProspectMessage("");
    try {
      const response = await fetch("/api/crm/prospects/discover", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          city: discoveryCity,
          externalIds: candidates.map((candidate) => candidate.externalId),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t.loadError);
      setProspectMessage(`${result.imported} ${t.prospectImported}; ${result.duplicates} ${t.duplicatesSkipped}.`);
      setProspectCandidates((current) => current.map((candidate) => (
        selectedProspects.includes(candidate.externalId) ? { ...candidate, alreadyImported: true } : candidate
      )));
      setSelectedProspects([]);
      await loadCrm();
    } catch (error) {
      setProspectMessage(error instanceof Error ? error.message : t.loadError);
    } finally {
      setImportingProspects(false);
    }
  }

  async function moveOpportunity(id: string, stage: string) {
    let lostReason: string | undefined;
    if (stage === "LOST") {
      lostReason = window.prompt(language === "es" ? "Indica el motivo de pérdida:" : "Enter a reason for loss:") || undefined;
      if (!lostReason?.trim()) {
        await loadCrm();
        return;
      }
    }
    try {
      const response = await fetch(`/api/crm/opportunities/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage, lostReason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t.loadError);
      await loadCrm();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t.loadError);
    }
  }

  async function changeProposalStatus(id: string, status: string) {
    try {
      const response = await fetch(`/api/crm/proposals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t.loadError);
      await loadCrm();
    } catch (error) {
      setProposalMessage(error instanceof Error ? error.message : t.loadError);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProjectMessage("");
    setProjectSaving(true);
    try {
      const proposal = proposals.find((item) => item.id === acceptedProposalId);
      if (!proposal) throw new Error(language === "es" ? "Selecciona una propuesta aceptada." : "Select an accepted proposal.");
      const response = await fetch("/api/crm/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: proposal.account.id, sourceProposalId: proposal.id, name: projectName || proposal.title }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t.loadError);
      setProjectName("");
      setProjectMessage(t.projectCreated);
      await loadCrm();
    } catch (error) {
      setProjectMessage(error instanceof Error ? error.message : t.loadError);
    } finally {
      setProjectSaving(false);
    }
  }

  async function createProjectTask(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("taskTitle") || "");
    try {
      const response = await fetch(`/api/crm/projects/${encodeURIComponent(projectId)}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t.loadError);
      formElement.reset();
      await loadCrm();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t.loadError);
    }
  }

  async function updateTask(id: string, status: string) {
    try {
      const response = await fetch(`/api/crm/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t.loadError);
      await loadCrm();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t.loadError);
    }
  }

  async function logProjectTime(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch(`/api/crm/projects/${encodeURIComponent(projectId)}/time-entries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workDate: new Date(`${String(form.get("workDate"))}T12:00:00.000Z`).toISOString(),
          hours: Number(form.get("hours")),
          description: String(form.get("description") || ""),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t.loadError);
      formElement.reset();
      await loadCrm();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t.loadError);
    }
  }

  async function createProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProposalMessage("");
    setProposalSaving(true);
    try {
      const response = await fetch("/api/crm/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          title: proposalName,
          taxRate: Number(proposalTax),
          items: [{ description: proposalDescription, quantity: 1, unit: "servicio", unitPrice: Number(proposalPrice) }],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t.loadError);
      setProposalName("");
      setProposalDescription("");
      setProposalPrice("");
      setProposalMessage(t.proposalCreated);
      await loadCrm();
    } catch (error) {
      setProposalMessage(error instanceof Error ? error.message : t.loadError);
    } finally {
      setProposalSaving(false);
    }
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      setInvoiceBusy(true);
      setInvoiceMessage("");
      try {
        const dueDate = String(form.get("dueAt") || "");
        const response = await fetch("/api/crm/invoices", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accountId: String(form.get("accountId") || ""),
            projectId: String(form.get("projectId") || "") || undefined,
            subtotalCop: Number(form.get("subtotalCop")),
            taxCop: Number(form.get("taxCop") || 0),
            dueAt: dueDate ? new Date(`${dueDate}T12:00:00.000Z`).toISOString() : undefined,
            notes: String(form.get("notes") || ""),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || t.loadError);
        formElement.reset();
        setInvoiceAccountId("");
        setInvoiceProjectId("");
        setInvoiceMessage(t.invoiceCreated);
        await loadCrm();
      } catch (error) {
        setInvoiceMessage(error instanceof Error ? error.message : t.loadError);
      } finally {
        setInvoiceBusy(false);
      }
    }

  async function recordPayment(event: FormEvent<HTMLFormElement>, invoiceId: string) {
      event.preventDefault();
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      setInvoiceBusy(true);
      setInvoiceMessage("");
      try {
        const response = await fetch(`/api/crm/invoices/${encodeURIComponent(invoiceId)}/payments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            amountCop: Number(form.get("amountCop")),
            paidAt: new Date(`${String(form.get("paidAt"))}T12:00:00.000Z`).toISOString(),
            method: String(form.get("method") || "") || undefined,
            reference: String(form.get("reference") || "") || undefined,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || t.loadError);
        formElement.reset();
        setInvoiceMessage(t.paymentCreated);
        await loadCrm();
      } catch (error) {
        setInvoiceMessage(error instanceof Error ? error.message : t.loadError);
      } finally {
        setInvoiceBusy(false);
    }
  }

  async function readCsvFile(event: ChangeEvent<HTMLInputElement>) {
      const file = event.currentTarget.files?.[0];
      setCsvContents("");
      setCsvFileName("");
      setCsvPreview(null);
      setCsvMessage("");
      if (!file) return;
      if (file.size > 5_000_000) {
        setCsvMessage(language === "es" ? "El archivo supera el límite de 5 MB." : "The file exceeds the 5 MB limit.");
        return;
      }
      try {
        setCsvContents(await file.text());
        setCsvFileName(file.name);
      } catch {
        setCsvMessage(language === "es" ? "No se pudo leer el archivo CSV." : "Could not read the CSV file.");
      }
    }

  async function importCsv(commit: boolean) {
      if (!csvContents) return;
      setCsvBusy(true);
      setCsvMessage("");
      try {
        const response = await fetch("/api/crm/csv/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sheet: csvSheet, csv: csvContents, commit }),
        });
        const result = await response.json() as CsvPreview;
        if (!response.ok && !result.errors) throw new Error(result.error || t.loadError);
        setCsvPreview(result);
        if (commit && response.ok) {
          setCsvMessage(language === "es"
            ? `Importación completada: ${result.created ?? 0} registros nuevos y ${result.updated ?? 0} actualizados.`
            : `Import completed: ${result.created ?? 0} new records and ${result.updated ?? 0} updated.`);
          await loadCrm();
        } else if (!commit) {
          setCsvMessage(language === "es"
            ? `Vista previa: ${result.validRows} de ${result.totalRows} filas válidas; ${result.created ?? 0} registros nuevos y ${result.updated ?? 0} existentes.`
            : `Preview: ${result.validRows} of ${result.totalRows} rows are valid; ${result.created ?? 0} new records and ${result.updated ?? 0} existing.`);
        } else {
          setCsvMessage(result.error || (language === "es" ? "Corrige los errores antes de importar." : "Fix errors before importing."));
        }
      } catch (error) {
        setCsvMessage(error instanceof Error ? error.message : t.loadError);
      } finally {
        setCsvBusy(false);
    }
  }

  const money = (value: string | null) => value === null
    ? "—"
    : new Intl.NumberFormat(language === "es" ? "es-CO" : "en-US", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value));
  const proposalAcceptanceRate = overview && overview.proposalConversion.total > 0
    ? (overview.proposalConversion.accepted / overview.proposalConversion.total) * 100
    : null;
  const latestDiagnosticScore = overview?.intelligence.latestAudit?.overallScore ?? null;
  const simulatedDiagnosticScore = latestDiagnosticScore === null
    ? null
    : Math.round(latestDiagnosticScore + ((100 - latestDiagnosticScore) * scoreGapToClose) / 100);
  const scenarioInputs = [scenarioOpportunities, scenarioConversionRate, scenarioAverageTicket];
  const scenarioIsComplete = scenarioInputs.every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0)
    && Number(scenarioOpportunities) <= 10000
    && Number(scenarioConversionRate) <= 100
    && Number(scenarioAverageTicket) <= 1_000_000_000;
  const scenarioPotentialValue = scenarioIsComplete
    ? Number(scenarioOpportunities) * (Number(scenarioConversionRate) / 100) * Number(scenarioAverageTicket)
    : null;
  const moduleVolumes = overview ? [
    { label: t.audits, value: overview.intelligence.auditCount },
    { label: t.opportunities, value: overview.counts.openOpportunities },
    { label: t.proposals, value: overview.proposalConversion.total },
    { label: t.activeProjects, value: overview.counts.projects },
  ] : [];
  const maxModuleVolume = Math.max(1, ...moduleVolumes.map((item) => item.value));
  const customers = accounts.filter((account) => account.type === "CUSTOMER");
  const prospects = accounts.filter((account) => account.type === "LEAD" || account.type === "PROSPECT");
  const canManageProspects = ["OWNER", "ADMIN", "SALES"].includes(role);
  const sectionTargets = ["estado", "rank-pulse", "prospectos", "clientes", "propuestas", "proyectos", "finanzas"];

  return (
    <main className="agency-shell">
      <aside className="agency-sidebar">
        <div className="agency-logo"><span className="brand-logo-wrap"><img src="/innweb-logo.png" alt="InnWeb" /></span><b>OS</b></div>
        <nav aria-label="CRM sections">
          {t.nav.map((item, index) => (
            <a key={item} className={index === activeSection ? "selected" : ""} href={`#${sectionTargets[index]}`} onClick={() => setActiveSection(index)}>
              <i>{["⌂", "✳", "◎", "◇", "◌", "▱", "⌁"][index]}</i>{item}
            </a>
          ))}
        </nav>
        <div className="agency-profile">
          <div className="avatar">IW</div>
          <div><strong>InnWeb</strong><span>{language === "es" ? "Espacio de trabajo" : "Agency workspace"}</span></div>
        </div>
      </aside>

      <section className="agency-content">
        <header className="agency-topbar">
          <div><span className="muted">InnWeb OS</span><strong>{t.product}</strong></div>
          <div className="top-actions">
            <div className="language-switch">
              <button className={language === "es" ? "active" : ""} onClick={() => setLanguage("es")}>ES</button>
              <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
            </div>
            <span className="muted">{user.name} · {role}</span>
            <button className="primary-action" onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.assign("/login");
            }}>{language === "es" ? "Salir" : "Sign out"}</button>
            <Link className="primary-action" href="/">{t.scan}</Link>
          </div>
        </header>

        <div className="agency-hero">
          <div id="estado"><p className="eyebrow">InnWeb OS · CRM</p><h1>{t.greeting}</h1><p>{t.intro}</p></div>
          <span className="live-pill"><i />{t.status}</span>
        </div>

        <section className="metric-grid">
          <article><span>{language === "es" ? "EMPRESAS" : "COMPANIES"}</span><strong>{overview?.counts.accounts ?? "…"}</strong><small>{language === "es" ? "Prospectos, clientes y socios reales" : "Real leads, customers, and partners"}</small></article>
          <article><span>{language === "es" ? "PIPELINE ABIERTO" : "OPEN PIPELINE"}</span><strong>{overview?.counts.openOpportunities ?? "…"}</strong><small>{money(overview?.pipelineValueCop ?? null)} · COP</small></article>
          <article><span>{language === "es" ? "CLIENTES" : "CUSTOMERS"}</span><strong>{overview?.counts.customers ?? "…"}</strong><small>{language === "es" ? "Cuentas convertidas" : "Converted accounts"}</small></article>
          <article><span>{language === "es" ? "PROYECTOS ACTIVOS" : "ACTIVE PROJECTS"}</span><strong>{overview?.counts.projects ?? "…"}</strong><small>{language === "es" ? `${overview?.counts.overdueActivities ?? "…"} seguimientos vencidos` : `${overview?.counts.overdueActivities ?? "…"} overdue follow-ups`}</small></article>
        </section>

        <section className="observatory-section" id="rank-pulse" aria-labelledby="observatory-title">
          <div className="observatory-heading">
            <div><span>{t.measured}</span><h2 id="observatory-title">{t.observatory}</h2></div>
            <Link href="/">{language === "es" ? "Ejecutar diagnóstico" : "Run diagnostic"} →</Link>
          </div>
          <div className="observatory-grid">
            <article className="observatory-card intelligence-card">
              <div className="section-heading"><div><span>{t.latestAudit}</span><h3>{t.diagnosticScore}</h3></div></div>
              {overview?.intelligence.latestAudit ? (
                <>
                  <div className="diagnostic-score-row">
                    <Odometer value={latestDiagnosticScore} label="/100" />
                    <div className="diagnostic-detail">
                      <a href={overview.intelligence.latestAudit.requestedUrl} target="_blank" rel="noreferrer">
                        {new URL(overview.intelligence.latestAudit.requestedUrl).hostname}
                      </a>
                      <span>{overview.intelligence.latestAudit.classification || "—"}</span>
                      <time dateTime={overview.intelligence.latestAudit.auditedAt}>
                        {new Date(overview.intelligence.latestAudit.auditedAt).toLocaleDateString(language === "es" ? "es-CO" : "en-US")}
                      </time>
                    </div>
                  </div>
                  <p className="observatory-footnote">{t.heuristicNote}</p>
                </>
              ) : (
                <div className="observatory-empty"><p>{t.noAudits}</p><Link href="/">{language === "es" ? "Abrir Rank Pulse" : "Open Rank Pulse"} →</Link></div>
              )}
            </article>

            <article className="observatory-card odometer-card">
              <div className="section-heading"><div><span>{t.measured}</span><h3>{t.auditCount}: {overview?.intelligence.auditCount ?? "…"}</h3></div></div>
              <div className="odometer-list">
                <Odometer value={overview?.intelligence.averageOverallScore ?? null} title={t.diagnosticScore} label="/100" />
                <Odometer value={overview?.intelligence.averageOpportunityScore ?? null} title={t.opportunityScore} label="/100" />
                <Odometer value={proposalAcceptanceRate} title={t.proposalAcceptance} label="%" />
              </div>
              <p className="observatory-footnote">{t.heuristicNote}</p>
            </article>

            <article className="observatory-card simulator-card">
              <div className="section-heading"><div><span>RANK PULSE · {language === "es" ? "ESCENARIO" : "SCENARIO"}</span><h3>{t.scoreSimulator}</h3></div></div>
              {latestDiagnosticScore === null ? <div className="observatory-empty"><p>{t.noAuditToSimulate}</p></div> : (
                <>
                  <div className="simulator-result"><span>{t.projectedDiagnostic}</span><strong>{simulatedDiagnosticScore}<small>/100</small></strong></div>
                  <label className="range-control">
                    <span>{t.findingsResolved}<b>{scoreGapToClose}%</b></span>
                    <input type="range" min="0" max="100" step="5" value={scoreGapToClose} onChange={(event) => setScoreGapToClose(Number(event.target.value))} />
                  </label>
                  <p className="observatory-footnote">{t.scoreSimulatorNote}</p>
                </>
              )}
            </article>
          </div>
        </section>

        <section className="agency-panels infographic-panels" aria-label={t.operationalMap}>
          <article className="pipeline-card module-infographic">
            <div className="section-heading"><div><span>InnWeb OS · {language === "es" ? "INFOGRAFÍA INTERNA" : "INTERNAL INFOGRAPHIC"}</span><h2>{t.operationalMap}</h2></div></div>
            <p className="observatory-footnote">{t.volumeByModule}</p>
            <div className="module-flow">
              {moduleVolumes.map((module, index) => (
                <div className="module-flow-item" key={module.label}>
                  <div className="module-flow-heading"><span>{module.label}</span><strong>{module.value}</strong></div>
                  <div className="module-flow-track"><i style={{ width: `${module.value ? Math.max(5, (module.value / maxModuleVolume) * 100) : 0}%` }} /></div>
                  {index < moduleVolumes.length - 1 && <span className="module-flow-arrow" aria-hidden="true">→</span>}
                </div>
              ))}
            </div>
          </article>
          <article className="observatory-card business-simulator">
            <div className="section-heading"><div><span>CRM · {language === "es" ? "ESCENARIO" : "SCENARIO"}</span><h3>{t.commercialSimulator}</h3></div></div>
            <p className="estimate-label">{t.estimateOnly}</p>
            <div className="scenario-fields">
              <label>{t.scenarioOpportunities}<input type="number" min="0" max="10000" step="1" value={scenarioOpportunities} onChange={(event) => setScenarioOpportunities(event.target.value)} /></label>
              <label>{t.scenarioConversion}<input type="number" min="0" max="100" step="1" value={scenarioConversionRate} onChange={(event) => setScenarioConversionRate(event.target.value)} /></label>
              <label>{t.scenarioTicket}<input type="number" min="0" step="10000" value={scenarioAverageTicket} onChange={(event) => setScenarioAverageTicket(event.target.value)} /></label>
            </div>
            {overview?.historicalCloseRate.closed ? (
              <button className="scenario-helper" type="button" onClick={() => setScenarioConversionRate(String(Math.round((overview.historicalCloseRate.won / overview.historicalCloseRate.closed) * 100)))}>
                {t.useObservedRate} ({Math.round((overview.historicalCloseRate.won / overview.historicalCloseRate.closed) * 100)}%)
              </button>
            ) : (
              <p className="observatory-footnote">{t.noObservedRate}</p>
            )}
            <div className="scenario-output"><span>{t.scenarioResult}</span><strong>{scenarioPotentialValue === null ? "—" : money(String(scenarioPotentialValue))}</strong></div>
          </article>
        </section>

        {loadError && <p className="error" role="alert">{loadError}</p>}

        <section className="opportunities-table" id="prospectos">
          <div className="section-heading"><div><span>SALES CRM</span><h2>{t.accountsTitle}</h2></div><Link href="/">{t.scan} →</Link></div>
          {canManageProspects && (
            <div className="prospect-discovery">
              <div>
                <h3>{t.discoverTitle}</h3>
                <p>{t.discoverDescription}</p>
              </div>
              <form className="discovery-form" onSubmit={discoverProspects}>
                <label>{t.city}<input required minLength={2} maxLength={80} pattern="[A-Za-zÀ-ÿ .'-]+" value={discoveryCity} onChange={(event) => setDiscoveryCity(event.target.value)} placeholder="Bogotá, Medellín, Cali…" /></label>
                <label>{t.category}
                  <select value={discoveryCategory} onChange={(event) => setDiscoveryCategory(event.target.value)}>
                    <option value="all">{t.allBusinesses}</option>
                    <option value="health">{t.healthBusinesses}</option>
                    <option value="food">{t.foodBusinesses}</option>
                    <option value="hospitality">{t.hospitalityBusinesses}</option>
                    <option value="professional">{t.professionalBusinesses}</option>
                    <option value="retail">{t.retailBusinesses}</option>
                  </select>
                </label>
                <button disabled={discoveringProspects}>{discoveringProspects ? t.searchingProspects : t.searchProspects}</button>
              </form>
              {prospectMessage && <p className="prospect-message" role="status">{prospectMessage}</p>}
              {prospectCandidates.length > 0 && (
                <>
                  <div className="discovery-results-heading">
                    <strong>{prospectCandidates.length} · {discoveryCity}</strong>
                    <span>{t.selectProspects} ({selectedProspects.length}/20)</span>
                  </div>
                  <ul className="prospect-results">
                    {prospectCandidates.map((candidate) => (
                      <li key={candidate.externalId}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedProspects.includes(candidate.externalId)}
                            disabled={candidate.alreadyImported || (!selectedProspects.includes(candidate.externalId) && selectedProspects.length >= 20)}
                            onChange={(event) => setSelectedProspects((current) => event.target.checked
                              ? [...current, candidate.externalId]
                              : current.filter((id) => id !== candidate.externalId))}
                          />
                          <span className="prospect-result-main">
                            <strong>{candidate.name}</strong>
                            <small>{candidate.category} · {candidate.address || candidate.city}</small>
                            <small>{candidate.website || t.noWebsite}{candidate.email ? ` · ${candidate.email}` : ""}{candidate.phone ? ` · ${candidate.phone}` : ""}</small>
                          </span>
                        </label>
                        <span className="prospect-result-actions">
                          {candidate.alreadyImported && <small>{t.alreadyImported}</small>}
                          <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">{t.openListing}</a>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="discovery-footer">
                    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t.osmAttribution} OpenStreetMap</a>
                    <button className="auth-submit" type="button" disabled={!selectedProspects.length || importingProspects} onClick={() => void importDiscoveredProspects()}>
                      {importingProspects ? t.importingProspects : `${t.importProspects} (${selectedProspects.length})`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <form className="account-form" onSubmit={createAccount}>
          <h3>{t.newAccount}</h3>
          <div>
            <label>{t.companyName}<input required minLength={2} maxLength={200} value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label>
            <label>{t.website}<input type="url" maxLength={2048} placeholder="https://" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
            <label>{t.contact}<input maxLength={200} value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
            <label>{t.email}<input type="email" maxLength={254} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label>
            <label>{t.phone}<input maxLength={40} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
            <label>{t.followUp}<input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label>
          </div>
          <button disabled={saving}>{saving ? "…" : t.save}</button>
          {formError && <p className="error" role="alert">{formError}</p>}
          </form>
          <div className="table-scroll"><table><thead><tr><th>{t.companyName}</th><th>{language === "es" ? "Tipo" : "Type"}</th><th>{language === "es" ? "Prioridad" : "Priority"}</th><th>{language === "es" ? "Contacto" : "Contact"}</th><th>{language === "es" ? "Oportunidades" : "Opportunities"}</th></tr></thead>
          <tbody>{prospects.map((account) => <tr key={account.id}>
            <td><div className="company-cell"><span>{account.name.slice(0, 2).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.website || "—"}</small></div></div></td>
            <td>{account.type}</td><td>{account.priority}</td>
            <td>{account.contacts[0] ? [account.contacts[0].firstName, account.contacts[0].lastName].filter(Boolean).join(" ") : "—"}</td>
            <td>{account._count.opportunities}</td>
          </tr>)}</tbody>
          </table></div>
          {prospects.length === 0 && !loadError && <p>{t.noAccounts} {language === "es" ? "Usa el formulario de arriba o" : "Use the form above or"} <Link href="#csv">{language === "es" ? "importa un CSV" : "import a CSV"}</Link>.</p>}
        </section>

        <section className="opportunities-table" id="clientes">
          <div className="section-heading"><div><span>CLIENT ACCOUNTS</span><h2>{t.customersTitle}</h2></div></div>
          <div className="table-scroll"><table><thead><tr><th>{t.companyName}</th><th>{t.website}</th><th>{language === "es" ? "Contacto principal" : "Primary contact"}</th><th>{language === "es" ? "Proyectos" : "Projects"}</th></tr></thead>
            <tbody>{customers.map((customer) => (
              <tr key={customer.id}>
                <td><div className="company-cell"><span>{customer.name.slice(0, 2).toUpperCase()}</span><div><strong>{customer.name}</strong><small>{customer.priority}</small></div></div></td>
                <td>{customer.website || "—"}</td>
                <td>{customer.contacts[0] ? [customer.contacts[0].firstName, customer.contacts[0].lastName].filter(Boolean).join(" ") : "—"}</td>
                <td>{projects.filter((project) => project.account.id === customer.id).length}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {customers.length === 0 && !loadError && <p>{t.noCustomers} <Link href="#csv">{language === "es" ? "Ir a importación CSV" : "Go to CSV import"} →</Link></p>}
        </section>

        <section className="agency-panels">
          <article className="pipeline-card" id="pipeline">
          <div className="section-heading"><div><span>PIPELINE · DATABASE</span><h2>{t.sections[1].title}</h2></div></div>
          <div className="pipeline-bars">
            {(overview?.stages ?? []).map((stage) => (
              <div key={stage.stage}><span><b>{t.stageNames[stage.stage] || stage.stage}</b><em>{stage.count}</em></span><div><i style={{ width: `${Math.min(stage.count * 12, 100)}%` }} /></div></div>
            ))}
            {overview?.stages.length === 0 && <p>{language === "es" ? "Sin oportunidades registradas." : "No opportunities recorded."}</p>}
          </div>
          </article>
          <article className="health-card"><div className="section-heading"><div><span>FOLLOW-UP CONTROL</span><h2>{language === "es" ? "Actividad vencida" : "Overdue activity"}</h2></div></div><p>{overview?.counts.overdueActivities ?? "…"} · {language === "es" ? "actividades abiertas con fecha vencida" : "open activities past due"}</p></article>
        </section>

        <section className="opportunities-table">
          <div className="section-heading"><div><span>SALES PIPELINE · LIVE</span><h2>{t.opportunitiesTitle}</h2></div></div>
          <div className="table-scroll"><table><thead><tr><th>{t.companyName}</th><th>{language === "es" ? "Oportunidad" : "Opportunity"}</th><th>{language === "es" ? "Etapa" : "Stage"}</th><th>Monto COP</th><th>{t.closeDate}</th></tr></thead>
            <tbody>{opportunities.map((opportunity) => <tr key={opportunity.id}>
              <td>{opportunity.account.name}</td><td>{opportunity.name}</td>
              <td><select aria-label={`${language === "es" ? "Etapa de" : "Stage for"} ${opportunity.name}`} value={opportunity.stage} onChange={(event) => void moveOpportunity(opportunity.id, event.target.value)}>
                {Object.entries(t.stageNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></td>
              <td>{money(opportunity.amount)}</td>
              <td>{opportunity.expectedCloseAt ? new Date(opportunity.expectedCloseAt).toLocaleDateString(language === "es" ? "es-CO" : "en-US") : "—"}</td>
            </tr>)}</tbody>
          </table></div>
          {opportunities.length === 0 && !loadError && <p>{t.noOpportunities}</p>}
        </section>

        <section className="opportunities-table" id="propuestas">
          <div className="section-heading"><div><span>QUOTE BUILDER · COP</span><h2>{t.proposalTitle}</h2></div></div>
          <form className="account-form" onSubmit={createProposal}>
            <div>
              <label>{t.proposalAccount}<select required value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)}><option value="">—</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <label>{t.proposalLabel}<input required minLength={2} maxLength={200} value={proposalName} onChange={(event) => setProposalName(event.target.value)} /></label>
              <label>{t.lineDescription}<input required maxLength={500} value={proposalDescription} onChange={(event) => setProposalDescription(event.target.value)} /></label>
              <label>{t.price}<input required type="number" min="0" step="1" value={proposalPrice} onChange={(event) => setProposalPrice(event.target.value)} /></label>
              <label>{t.taxRate}<input type="number" min="0" max="100" step="0.01" value={proposalTax} onChange={(event) => setProposalTax(event.target.value)} /></label>
            </div>
            <button disabled={proposalSaving || accounts.length === 0}>{proposalSaving ? "…" : t.createProposal}</button>
            {proposalMessage && <p role="status">{proposalMessage}</p>}
          </form>
          <div className="table-scroll"><table><thead><tr><th>{language === "es" ? "Número" : "Number"}</th><th>{t.companyName}</th><th>{t.proposalLabel}</th><th>{t.quoteState}</th><th>Total COP</th></tr></thead>
            <tbody>{proposals.map((proposal) => <tr key={proposal.id}><td>{proposal.number}</td><td>{proposal.account.name}</td><td>{proposal.title}</td><td>
              <select aria-label={`${t.quoteState}: ${proposal.number}`} value={proposal.status} onChange={(event) => void changeProposalStatus(proposal.id, event.target.value)}>
                {[proposal.status, ...(proposal.status === "DRAFT" ? ["SENT", "CANCELED"] : proposal.status === "SENT" ? ["VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELED"] : proposal.status === "VIEWED" ? ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELED"] : [])].filter((value, index, all) => all.indexOf(value) === index).map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </td><td>{money(proposal.total)}</td></tr>)}</tbody>
          </table></div>
          {proposals.length === 0 && !loadError && <p>{t.noProposals}</p>}
        </section>

        <section className="opportunities-table" id="proyectos">
          <div className="section-heading"><div><span>DELIVERY OPERATIONS</span><h2>{t.projectTitle}</h2></div></div>
          <form className="account-form" onSubmit={createProject}>
            <div>
              <label>{t.fromProposal}<select required value={acceptedProposalId} onChange={(event) => setAcceptedProposalId(event.target.value)}><option value="">—</option>{proposals.filter((proposal) => proposal.status === "ACCEPTED").map((proposal) => <option key={proposal.id} value={proposal.id}>{proposal.number} · {proposal.account.name} · {money(proposal.total)}</option>)}</select></label>
              <label>{t.projectName}<input maxLength={200} value={projectName} onChange={(event) => setProjectName(event.target.value)} /></label>
            </div>
            <button disabled={projectSaving || proposals.every((proposal) => proposal.status !== "ACCEPTED")}>{projectSaving ? "…" : t.createProject}</button>
            {projectMessage && <p role="status">{projectMessage}</p>}
          </form>
          <div className="table-scroll"><table><thead><tr><th>{t.projectName}</th><th>{t.companyName}</th><th>{language === "es" ? "Estado" : "Status"}</th><th>{language === "es" ? "Avance" : "Progress"}</th><th>{t.closeDate}</th></tr></thead>
            <tbody>{projects.map((project) => <tr key={project.id}><td>{project.name}</td><td>{project.account.name}</td><td>{project.status}</td><td>{project.progress}%</td><td>{project.dueAt ? new Date(project.dueAt).toLocaleDateString(language === "es" ? "es-CO" : "en-US") : "—"}</td></tr>)}</tbody>
          </table></div>
          {projects.map((project) => <details key={`${project.id}-operations`} className="project-operations">
            <summary>{project.name} · {language === "es" ? "tareas y horas" : "tasks and time"}</summary>
            <ul>{project.tasks.map((task) => <li key={task.id}><label><input type="checkbox" checked={task.status === "DONE"} onChange={(event) => void updateTask(task.id, event.target.checked ? "DONE" : "TODO")} />{task.title}</label>{task.dueAt ? ` · ${new Date(task.dueAt).toLocaleDateString()}` : ""}</li>)}</ul>
            <form className="inline-form" onSubmit={(event) => void createProjectTask(event, project.id)}>
              <input name="taskTitle" required minLength={2} maxLength={200} placeholder={t.taskTitle} />
              <button>{t.addTask}</button>
            </form>
            <form className="inline-form" onSubmit={(event) => void logProjectTime(event, project.id)}>
              <input name="workDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              <input name="hours" type="number" min="0.01" max="24" step="0.01" required placeholder={t.hours} />
              <input name="description" required minLength={2} maxLength={1000} placeholder={t.workDescription} />
              <button>{t.logHours}</button>
            </form>
          </details>)}
          {projects.length === 0 && !loadError && <p>{t.noProjects}</p>}
        </section>

        <section className="opportunities-table" id="finanzas">
          <div className="section-heading"><div><span>FINANCE · VERIFIED RECORDS</span><h2>{t.invoiceTitle}</h2></div></div>
          {["OWNER", "ADMIN", "FINANCE"].includes(role) && (
            <form className="account-form" onSubmit={createInvoice}>
              <div>
                <label>{t.proposalAccount}<select name="accountId" required value={invoiceAccountId} onChange={(event) => { setInvoiceAccountId(event.target.value); setInvoiceProjectId(""); }}><option value="">—</option>{accounts.filter((account) => account.type === "CUSTOMER").map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                <label>{t.projectTitle}<select name="projectId" value={invoiceProjectId} onChange={(event) => setInvoiceProjectId(event.target.value)}><option value="">—</option>{projects.filter((project) => project.account.id === invoiceAccountId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
                <label>{t.invoiceSubtotal}<input name="subtotalCop" required type="number" min="0" max="999999999999" step="0.01" /></label>
                <label>{t.invoiceTax}<input name="taxCop" type="number" min="0" max="999999999999" step="0.01" defaultValue="0" /></label>
                <label>{t.invoiceDue}<input name="dueAt" type="date" /></label>
                <label>{t.invoiceConcept}<input name="notes" maxLength={4000} /></label>
              </div>
              <button disabled={invoiceBusy || accounts.every((account) => account.type !== "CUSTOMER")}>{invoiceBusy ? "…" : t.invoiceCreate}</button>
            </form>
          )}
          <div className="table-scroll"><table><thead><tr><th>{language === "es" ? "Factura" : "Invoice"}</th><th>{t.proposalAccount}</th><th>{t.projectTitle}</th><th>{language === "es" ? "Estado" : "Status"}</th><th>Total</th><th>{language === "es" ? "Pagado" : "Paid"}</th><th>{language === "es" ? "Saldo" : "Balance"}</th><th>{t.invoiceDue}</th></tr></thead>
            <tbody>{invoices.map((invoice) => <tr key={invoice.id}>
              <td>{invoice.number}</td><td>{invoice.account.name}</td><td>{invoice.project?.name || "—"}</td><td>{invoice.status}</td>
              <td>{money(invoice.total)}</td><td>{money(invoice.paid)}</td><td>{money(invoice.balance)}</td>
              <td>{invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString(language === "es" ? "es-CO" : "en-US") : "—"}</td>
            </tr>)}</tbody>
          </table></div>
          {invoices.length === 0 && !loadError && <p>{t.noInvoices}</p>}
          {["OWNER", "ADMIN", "FINANCE"].includes(role) && invoices.filter((invoice) => Number(invoice.balance) > 0 && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)).map((invoice) => (
            <form key={`${invoice.id}-payment`} className="inline-form" onSubmit={(event) => void recordPayment(event, invoice.id)}>
              <strong>{invoice.number} · {money(invoice.balance)}</strong>
              <input name="amountCop" type="number" required min="0.01" max={invoice.balance} step="0.01" placeholder={t.invoiceAmount} />
              <input name="paidAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} aria-label={language === "es" ? "Fecha de pago" : "Payment date"} />
              <input name="method" maxLength={80} placeholder={t.invoiceMethod} />
              <input name="reference" maxLength={160} placeholder={t.invoiceReference} />
              <button disabled={invoiceBusy}>{t.invoicePayment}</button>
            </form>
          ))}
          {invoiceMessage && ["OWNER", "ADMIN", "FINANCE"].includes(role) && !invoiceBusy && <p role="status">{invoiceMessage}</p>}
        </section>

        <section className="opportunities-table">
          <div className="section-heading"><div><span>CRM MODULES</span><h2>{t.modulesTitle}</h2></div></div>
          <div className="agency-panels">
          {t.sections.map((section) => (
            <article className="pipeline-card" id={`module-${section.id}`} key={section.id}>
              <div className="section-heading"><div><span>{["ventas", "pipeline", "propuestas"].includes(section.id) ? "LIVE CRM MODULE" : "DATABASE MODEL · MODULE UI IN PROGRESS"}</span><h2>{section.title}</h2></div></div>
              <p>{section.description}</p>
            </article>
          ))}
          </div>
        </section>

        <section className="opportunities-table" id="csv">
          <div className="section-heading"><div><span>CSV · MANUAL EXCHANGE</span><h2>{t.csvTitle}</h2></div></div>
          <p>{t.csvDescription}</p>
          <div className="account-form">
            <div>
              <label>{language === "es" ? "Exportar pestaña" : "Export sheet"}
                <select value={csvExportSheet} onChange={(event) => setCsvExportSheet(event.target.value as DataSheetName)}>
                  {dataSheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              {["OWNER", "ADMIN"].includes(role) && <>
                <label>{language === "es" ? "Pestaña de importación" : "Import sheet"}
                  <select value={csvSheet} onChange={(event) => { setCsvSheet(event.target.value as DataSheetName); setCsvPreview(null); setCsvMessage(""); }}>
                    {importableDataSheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <label>{language === "es" ? "Archivo CSV (máximo 5 MB)" : "CSV file (5 MB max)"}
                  <input type="file" accept=".csv,text/csv" onChange={(event) => void readCsvFile(event)} />
                </label>
              </>}
            </div>
            <div className="csv-actions">
              <a className="csv-button" href={`/api/crm/csv/export?sheet=${encodeURIComponent(csvExportSheet)}`} download>{language === "es" ? "Descargar CSV" : "Download CSV"}</a>
              {["OWNER", "ADMIN"].includes(role) && <>
                <button disabled={csvBusy || !csvContents} onClick={() => void importCsv(false)}>{csvBusy ? "…" : language === "es" ? "Validar y previsualizar" : "Validate and preview"}</button>
                <button disabled={csvBusy || !csvContents || !csvPreview || csvPreview.errors.length > 0 || csvPreview.validRows !== csvPreview.totalRows} onClick={() => void importCsv(true)}>{language === "es" ? "Importar todo" : "Import all"}</button>
              </>}
            </div>
            {csvFileName && <p>{language === "es" ? "Archivo:" : "File:"} {csvFileName}</p>}
            {csvMessage && <p role="status">{csvMessage}</p>}
            {csvPreview?.errors.map((error) => <p className="error" role="alert" key={`${error.row}-${error.message}`}>{language === "es" ? "Fila" : "Row"} {error.row}: {error.message}</p>)}
          </div>
        </section>
        <section className="agency-panels">
          <article className="health-card" id="gobierno"><div className="section-heading"><div><span>ACCESS CONTROL</span><h2>{t.rolesTitle}</h2></div></div><p>{t.rolesDescription}</p></article>
        </section>
        <p className="demo-note">{t.dataPolicy}</p>
      </section>
    </main>
  );
}
