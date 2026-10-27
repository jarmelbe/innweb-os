/**
 * InnWeb Intelligence: one editorial source of truth for public and private UX.
 * Availability is deliberately precise: a concept is not labelled as a live integration.
 * Existing RankPulse score logic remains in /api/v1/opportunity-finder/audit.
 */
export type IntelligenceModuleId =
  | "rankpulse" | "brandia" | "sales" | "knowledge"
  | "workspace" | "social" | "video" | "voice" | "gateway";

export type IntelligenceStatus = "existing" | "drafts" | "concept" | "integration";
export type IntelligenceAudience = "visitor" | "team" | "both";

export type IntelligenceModule = {
  id: IntelligenceModuleId;
  label: string;
  strapline: string;
  description: string;
  proof: string;
  status: IntelligenceStatus;
  audience: IntelligenceAudience;
  category: string;
};

export const intelligenceModules: IntelligenceModule[] = [
  {
    id: "rankpulse", label: "RankPulse", strapline: "Decisiones con evidencia, no con suposiciones.",
    description: "Examina señales observables de un sitio y convierte los hallazgos en prioridades concretas de mejora.",
    proof: "La puntuación técnica actual se conserva. Los datos de Search Console y de búsqueda con IA requieren acceso autorizado y se mostrarán por separado.",
    status: "existing", audience: "both", category: "Visibilidad",
  },
  {
    id: "brandia", label: "BrandIA", strapline: "De una idea dispersa a una dirección de marca.",
    description: "Ordena tu mensaje, tus públicos y la personalidad de tu negocio antes de diseñar. El primer ejercicio es gratuito; la identidad final se construye con el equipo creativo.",
    proof: "El ejercicio editorial gratuito no genera un logo final, no registra datos y no afirma utilizar IA. Generación de imágenes con Nano Banana: integración pendiente.",
    status: "concept", audience: "both", category: "Marca",
  },
  {
    id: "sales", label: "Sales Desk", strapline: "Cada oportunidad merece un siguiente paso.",
    description: "Prepara propuestas, mensajes y próximos contactos con un tono coherente y contexto comercial aportado por el equipo.",
    proof: "Genera borradores para revisión. No envía mensajes ni modifica oportunidades automáticamente.",
    status: "drafts", audience: "team", category: "CRM",
  },
  {
    id: "knowledge", label: "Knowledge", strapline: "Respuestas que conocen el contexto, no lo inventan.",
    description: "Organiza preguntas y respuestas sobre servicios, operaciones y documentos aprobados para mantener al equipo alineado.",
    proof: "Hoy permite estructurar un borrador a partir del texto que pegues. La búsqueda privada en documentos con controles por empresa está pendiente.",
    status: "drafts", audience: "team", category: "Conocimiento",
  },
  {
    id: "workspace", label: "Workspace Flow", strapline: "Del correo al proceso, sin perder el criterio.",
    description: "Diseña flujos para pasar de una consulta a una tarea, una cita o una propuesta con responsable y seguimiento.",
    proof: "Los flujos se diseñan como borradores. Gmail, Calendar y Drive requieren permisos OAuth por cuenta y aprobación antes de enviar o cambiar datos.",
    status: "integration", audience: "team", category: "Operaciones",
  },
  {
    id: "social", label: "Search & Social Signals", strapline: "Entiende cómo te encuentran, antes de decidir qué publicar.",
    description: "Relaciona contenido, descubrimiento orgánico y consultas mediante informes identificados por fuente y periodo.",
    proof: "No mezclamos impresiones, clics, ventas ni puntuaciones en un único número. La importación oficial y la atribución están pendientes.",
    status: "integration", audience: "team", category: "Contenido",
  },
  {
    id: "video", label: "Motion Lab", strapline: "La idea primero. El movimiento después.",
    description: "Construye conceptos de Reels, anuncios y videos con guion, apertura, ritmo y dirección visual antes de producir.",
    proof: "Ahora se pueden preparar guiones con Gemini en el OS. La generación y edición de video requieren activar un proveedor compatible y sus costos.",
    status: "drafts", audience: "both", category: "Producción",
  },
  {
    id: "voice", label: "Voice Desk", strapline: "Una primera conversación que ya orienta.",
    description: "Diseña la conversación inicial para responder preguntas frecuentes, orientar a la persona y proponer el siguiente paso.",
    proof: "El flujo conversacional se prepara como borrador. El agente de voz en tiempo real, las llamadas y las reservas todavía no están conectados.",
    status: "drafts", audience: "both", category: "Atención",
  },
  {
    id: "gateway", label: "Agent Gateway", strapline: "Automatizaciones con límites claros.",
    description: "Define qué operaciones podrían utilizar los agentes y cuáles requieren permiso, registro y aprobación humana.",
    proof: "Módulo de arquitectura. No concede acceso directo a CRM, pagos ni información privada.",
    status: "concept", audience: "team", category: "Infraestructura",
  },
];

export const intelligenceStatusLabels: Record<IntelligenceStatus, string> = {
  existing: "Herramienta existente",
  drafts: "Borradores asistidos",
  concept: "Concepto en exploración",
  integration: "Integración por configurar",
};

export const intelligenceDrafts = {
  rankpulse: {
    label: "Interpretación técnica",
    instruction: "Analiza únicamente la evidencia escrita por la persona: URL, fecha, señales técnicas, scores existentes y metodología. Identifica observaciones verificadas, hipótesis y próximos pasos por separado. No inventes métricas, rankings de Google ni cambios de puntuación.",
  },
  brandia: {
    label: "Dirección editorial de marca",
    instruction: "Propón una dirección de marca con propósito, audiencia, tono, promesa diferenciadora y dos rutas creativas. Nunca asegures disponibilidad de nombre o marca registrada. No presentes un logo terminado: esto es una propuesta conceptual para diseño humano.",
  },
  sales: {
    label: "Propuesta comercial",
    instruction: "Redacta un borrador comercial convincente sin presiones artificiales. Separa alcance confirmado, supuestos, decisiones pendientes y siguiente paso. Nunca inventes casos de éxito, testimonios, resultados, tarifas ni compromisos.",
  },
  knowledge: {
    label: "Base de conocimiento",
    instruction: "Convierte el texto proporcionado en una ficha de conocimiento: respuesta corta, explicación, fuente indicada por el usuario y lagunas por verificar. Si no se aporta evidencia, señala sin fuente. No inventes política interna.",
  },
  workspace: {
    label: "Diseñar automatización",
    instruction: "Redacta un plan de automatización como borrador con disparador, permiso, responsable, excepciones, almacenamiento y aprobación humana. No afirmes que hay conectores activos, ni que se ha enviado correo o creado calendario.",
  },
  social: {
    label: "Informe editorial",
    instruction: "Propón un informe de visibilidad para Search Console y redes con métricas diferenciadas, ventana temporal, fuente y pasos de validación. No atribuyas conversiones ni posiciones sin datos y no reconstruyas puntuaciones de RankPulse.",
  },
  video: {
    label: "Guion creativo",
    instruction: "Crea un guion audiovisual listo para revisión: concepto, hook, escenas con tiempos, voz, texto en pantalla, música de referencia y CTA. No digas que has generado, renderizado o publicado un video.",
  },
  voice: {
    label: "Guion de atención",
    instruction: "Diseña un árbol conversacional de atención respetuoso: saludo, intención, respuesta breve, consentimiento, derivación humana y cierre. Evita promesas médicas, jurídicas o financieras. No afirmes que existe un bot conectado.",
  },
  gateway: {
    label: "Diseño de permisos",
    instruction: "Especifica herramientas propuestas para un agente, principio de menor privilegio, confirmaciones, auditoría, límites y casos prohibidos. No simules ejecuciones ni conexiones reales.",
  },
} satisfies Record<IntelligenceModuleId, { label: string; instruction: string }>;
