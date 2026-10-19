import {
  AccountType, ActivityStatus, ActivityType, AgencyRole, OpportunityStage, ProposalStatus,
  ProjectStatus, RecordPriority, WorkItemStatus, Prisma,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseCsv } from "@/lib/csv";
import { accountImportIssues, importCountry } from "@/lib/csv-import";
import { requireCrmUser, unavailable } from "@/lib/crm";
import { dataSheetNames, importableDataSheetNames, optionalImportHeaders, sheetHeaders, type DataSheetName } from "@/lib/sheet-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ImportInput = z.object({
  sheet: z.string(),
  csv: z.string().min(1).max(5_000_000),
  commit: z.boolean().default(false),
});

const importable = new Set<DataSheetName>(importableDataSheetNames);

function value(row: Record<string, string>, key: string) {
  return (row[key] || "").trim();
}

function parseNumber(row: Record<string, string>, key: string, options: { required?: boolean; min?: number; max?: number } = {}) {
  const raw = value(row, key);
  if (!raw && !options.required) return null;
  let normalized = raw.replace(/[\s$]/g, "").replace(/COP/gi, "");
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else if (/^-?\d+,\d+$/.test(normalized)) {
    normalized = normalized.replace(",", ".");
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || (options.min !== undefined && parsed < options.min) || (options.max !== undefined && parsed > options.max)) {
    throw new Error(`${key} must be a number${options.min !== undefined ? ` from ${options.min}` : ""}${options.max !== undefined ? ` to ${options.max}` : ""}.`);
  }
  return parsed;
}

function parseDate(row: Record<string, string>, key: string, required = false) {
  const raw = value(row, key);
  if (!raw && !required) return null;
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) throw new Error(`${key} must be a valid date.`);
  return parsed;
}

function parseDecimal(row: Record<string, string>, key: string, options?: { required?: boolean; min?: number; max?: number }) {
  const parsed = parseNumber(row, key, options);
  return parsed === null ? null : new Prisma.Decimal(String(parsed)).toDecimalPlaces(2);
}

function parseYesNo(raw: string, defaultValue = false) {
  if (!raw) return defaultValue;
  if (/^(si|sí|yes|true|1|principal)$/i.test(raw)) return true;
  if (/^(no|false|0)$/i.test(raw)) return false;
  throw new Error("Boolean fields must be Sí/No or Yes/No.");
}

function enumValue<T extends string>(
  raw: string,
  values: readonly T[],
  field: string,
  fallback?: T,
  aliases: Record<string, T> = {},
): T {
  const normalized = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\s-]+/g, "_");
  if (aliases[normalized]) return aliases[normalized];
  if (values.includes(normalized as T)) return normalized as T;
  if (!raw && fallback) return fallback;
  throw new Error(`${field} has an unsupported value.`);
}

const accountTypeAliases: Record<string, AccountType> = {
  NUEVO: AccountType.LEAD, NUEVO_LEAD: AccountType.LEAD, PROSPECTO: AccountType.PROSPECT,
  CLIENTE: AccountType.CUSTOMER, SOCIO: AccountType.PARTNER, REFERIDO: AccountType.PARTNER,
  ARCHIVADO: AccountType.ARCHIVED,
};
const priorityAliases: Record<string, RecordPriority> = {
  BAJA: RecordPriority.LOW, MEDIA: RecordPriority.NORMAL, MEDIO: RecordPriority.NORMAL,
  ALTA: RecordPriority.HIGH, URGENTE: RecordPriority.URGENT,
};
const opportunityAliases: Record<string, OpportunityStage> = {
  NUEVO: OpportunityStage.DISCOVERED, DESCUBIERTO: OpportunityStage.DISCOVERED,
  CALIFICADO: OpportunityStage.QUALIFIED, DIAGNOSTICO: OpportunityStage.NEEDS_ANALYSIS,
  ANALISIS: OpportunityStage.NEEDS_ANALYSIS, PROPUESTA_ENVIADA: OpportunityStage.PROPOSAL,
  NEGOCIACION: OpportunityStage.NEGOTIATION, GANADA: OpportunityStage.WON,
  GANADO: OpportunityStage.WON, PERDIDA: OpportunityStage.LOST,
};
const activityTypeAliases: Record<string, ActivityType> = {
  LLAMADA: ActivityType.CALL, CORREO: ActivityType.EMAIL, REUNION: ActivityType.MEETING,
  NOTA: ActivityType.NOTE, TAREA: ActivityType.TASK, AUDITORIA: ActivityType.WEBSITE_AUDIT,
  AUDITORIA_WEB: ActivityType.WEBSITE_AUDIT, PROPUESTA_ENVIADA: ActivityType.PROPOSAL_SENT,
  CAMBIO_ESTADO: ActivityType.STATUS_CHANGE,
};
const activityStatusAliases: Record<string, ActivityStatus> = {
  PENDIENTE: ActivityStatus.OPEN, ABIERTA: ActivityStatus.OPEN, ABIERTO: ActivityStatus.OPEN,
  EN_CURSO: ActivityStatus.IN_PROGRESS, COMPLETADA: ActivityStatus.COMPLETED,
  COMPLETADO: ActivityStatus.COMPLETED, CANCELADA: ActivityStatus.CANCELED,
};
const proposalStatusAliases: Record<string, ProposalStatus> = {
  BORRADOR: ProposalStatus.DRAFT, ENVIADA: ProposalStatus.SENT, VISTA: ProposalStatus.VIEWED,
  ACEPTADA: ProposalStatus.ACCEPTED, RECHAZADA: ProposalStatus.REJECTED,
  VENCIDA: ProposalStatus.EXPIRED, CANCELADA: ProposalStatus.CANCELED,
};
const projectStatusAliases: Record<string, ProjectStatus> = {
  PLANIFICACION: ProjectStatus.PLANNING, PLANIFICADO: ProjectStatus.PLANNING,
  ACTIVO: ProjectStatus.ACTIVE, EN_PAUSA: ProjectStatus.ON_HOLD, PAUSADO: ProjectStatus.ON_HOLD,
  COMPLETADO: ProjectStatus.COMPLETED, CANCELADO: ProjectStatus.CANCELED,
};
const taskStatusAliases: Record<string, WorkItemStatus> = {
  PENDIENTE: WorkItemStatus.TODO, POR_HACER: WorkItemStatus.TODO,
  EN_CURSO: WorkItemStatus.IN_PROGRESS, BLOQUEADA: WorkItemStatus.BLOCKED,
  BLOQUEADO: WorkItemStatus.BLOCKED, COMPLETADA: WorkItemStatus.DONE,
  COMPLETADO: WorkItemStatus.DONE, CANCELADA: WorkItemStatus.CANCELED,
};

async function findByIdOrExternal<T extends { id: string }>(
  agencyId: string,
  id: string,
  find: (where: { agencyId: string; OR: Array<{ id?: string; externalId?: string }> }) => Promise<T[]>,
): Promise<T | null> {
  if (!id) return null;
  const matches = await find({ agencyId, OR: [{ id }, { externalId: id }] });
  if (matches.length > 1) throw new Error("ID is ambiguous: it matches different internal and external records.");
  return matches[0] || null;
}

function splitName(fullName: string) {
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  return { firstName: firstName || "", lastName: rest.join(" ") };
}

function parseServiceActive(raw: string) {
  const normalized = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!normalized || /^(activo|active|si|yes|true|1)$/.test(normalized)) return true;
  if (/^(inactivo|inactive|no|false|0)$/.test(normalized)) return false;
  throw new Error("Service status must be Activo/Inactive or Sí/No.");
}

async function applyRow(
  transaction: Prisma.TransactionClient,
  agencyId: string,
  sheet: DataSheetName,
  row: Record<string, string>,
  commit: boolean,
): Promise<{ kind: "created" | "updated"; targetId?: string }> {
  const externalId = value(row, "ID") || (sheet === "Referidos" ? value(row, "Partner ID") : "");
  if (!externalId) throw new Error("ID is required for safe, repeatable imports.");

  const accountForSheet = async () => {
    const accountId = value(row, "Prospecto ID") || value(row, "Cliente ID") || value(row, "Organización o lead ID");
    const account = await findByIdOrExternal(agencyId, accountId, (where) => transaction.account.findMany({ where }));
    if (!account) throw new Error("Referenced account was not found in this agency.");
    return account;
  };
  const projectForSheet = async () => {
    const project = await findByIdOrExternal(agencyId, value(row, "Proyecto ID"), (where) => transaction.project.findMany({ where }));
    if (!project) throw new Error("Referenced project was not found in this agency.");
    return project;
  };
  switch (sheet) {
    case "Prospectos":
    case "Clientes": {
      const existingAccount = await findByIdOrExternal(agencyId, externalId, (where) => transaction.account.findMany({
        where, select: { id: true },
      }));
      const customer = sheet === "Clientes";
      const accountName = value(row, customer ? "Razón social" : "Empresa");
      if (accountName.length < 2 || accountName.length > 200) throw new Error("Company name must contain 2–200 characters.");
      const website = value(row, "Sitio web");
      const country = importCountry(value(row, "País"));
      const industry = value(row, "Industria");
      if (website) {
        try {
          new URL(website);
        } catch {
          throw new Error("Website must be a valid URL.");
        }
      }
      const type = customer
        ? AccountType.CUSTOMER
        : enumValue(value(row, "Estado"), Object.values(AccountType), "Estado", AccountType.LEAD, accountTypeAliases);
      if (!customer && type === AccountType.CUSTOMER) throw new Error("Import customers using the Clientes sheet.");
      const ownerId = value(row, "Responsable");
      const owner = ownerId ? await transaction.user.findFirst({
        where: { id: ownerId, memberships: { some: { agencyId } } }, select: { id: true },
      }) : null;
      if (ownerId && !owner) throw new Error("Responsible user is not a member of this agency.");
      const priority = enumValue(value(row, "Prioridad"), Object.values(RecordPriority), "Prioridad", RecordPriority.NORMAL, priorityAliases);
      const nextFollowUpAt = parseDate(row, "Próximo contacto");
      const lastContactAt = parseDate(row, "Última interacción");
      const createdAt = parseDate(row, "Fecha alta");
      const primaryContactName = value(row, customer ? "Contacto" : "Contacto principal");
      const primaryContact = primaryContactName ? splitName(primaryContactName) : null;
      if (primaryContact && (!primaryContact.firstName || primaryContact.firstName.length > 100 || primaryContact.lastName.length > 100)) {
        throw new Error("Primary contact name is invalid.");
      }
      const contactEmail = value(row, "Email").toLowerCase();
      if (contactEmail && !z.string().email().max(254).safeParse(contactEmail).success) {
        throw new Error("Primary contact email is invalid.");
      }
      const contactPhone = value(row, "Teléfono/WhatsApp") || value(row, "Teléfono");
      const hasPrimaryContact = Boolean(primaryContact || contactEmail || contactPhone);
      const primaryContacts = hasPrimaryContact && existingAccount ? await transaction.contact.findMany({
        where: { agencyId, accountId: existingAccount.id, isPrimary: true }, select: { id: true },
      }) : [];
      if (primaryContacts.length > 1) throw new Error("Account has multiple primary contacts; reconcile them before importing.");
      if (commit) {
        const createData = {
            agencyId, externalId, name: accountName, legalName: value(row, "Razón social") || null,
            website: website || null, industry: industry || null, country: country ?? "", taxId: value(row, "NIT") || null,
            city: value(row, "Ciudad") || null, source: value(row, "Fuente") || "CSV",
            serviceInterest: value(row, "Servicio solicitado") || value(row, "Servicio") || null,
            type, priority,
            ownerId: owner?.id || null, notes: value(row, "Notas") || null,
            nextFollowUpAt, lastContactAt, createdAt: createdAt || new Date(),
        };
        const savedAccount = existingAccount ? await transaction.account.update({
          where: { id: existingAccount.id }, data: {
            name: accountName, legalName: Object.hasOwn(row, "Razón social") ? value(row, "Razón social") || null : undefined,
            website: Object.hasOwn(row, "Sitio web") ? website || null : undefined,
            industry: Object.hasOwn(row, "Industria") ? industry || null : undefined,
            country,
            taxId: Object.hasOwn(row, "NIT") ? value(row, "NIT") || null : undefined,
            city: Object.hasOwn(row, "Ciudad") ? value(row, "Ciudad") || null : undefined,
            source: Object.hasOwn(row, "Fuente") ? value(row, "Fuente") || "CSV" : undefined,
            serviceInterest: value(row, "Servicio solicitado") || value(row, "Servicio") || null,
            type, priority: Object.hasOwn(row, "Prioridad") ? priority : undefined,
            ownerId: Object.hasOwn(row, "Responsable") ? owner?.id || null : undefined,
            notes: Object.hasOwn(row, "Notas") ? value(row, "Notas") || null : undefined,
            nextFollowUpAt: Object.hasOwn(row, "Próximo contacto") ? nextFollowUpAt : undefined,
            lastContactAt: Object.hasOwn(row, "Última interacción") ? lastContactAt : undefined,
          },
        }) : await transaction.account.create({ data: createData });
        if (hasPrimaryContact) {
          const existingPrimary = primaryContacts[0];
          const contactData = {
            agencyId,
            accountId: savedAccount.id,
            email: contactEmail || undefined,
            phone: contactPhone || undefined,
            whatsapp: contactPhone || undefined,
            isPrimary: true,
          };
          if (existingPrimary) {
            await transaction.contact.update({ where: { id: existingPrimary.id }, data: {
              ...contactData,
              firstName: primaryContact?.firstName,
              lastName: primaryContact ? primaryContact.lastName || null : undefined,
            } });
          } else {
            await transaction.contact.create({ data: {
              ...contactData, firstName: primaryContact?.firstName || "Contacto", lastName: primaryContact?.lastName || null,
            } });
          }
        }
      }
      return { kind: existingAccount ? "updated" : "created", targetId: existingAccount?.id };
    }
    case "Contactos": {
      const existingContact = await findByIdOrExternal(agencyId, externalId, (where) => transaction.contact.findMany({
        where, select: { id: true },
      }));
      const accountId = value(row, "Organización o lead ID");
      const account = accountId ? await findByIdOrExternal(agencyId, accountId, (where) => transaction.account.findMany({ where })) : null;
      if (accountId && !account) throw new Error("Referenced account was not found in this agency.");
      const { firstName, lastName } = splitName(value(row, "Nombre"));
      if (!firstName || firstName.length > 100 || lastName.length > 100) throw new Error("Contact name is invalid.");
      const isPrimary = parseYesNo(value(row, "Contacto principal"));
      if (commit) {
        const data = {
          agencyId, externalId, accountId: account?.id || null, firstName, lastName: lastName || null,
          title: value(row, "Cargo") || null, email: value(row, "Email").toLowerCase() || null,
          phone: value(row, "WhatsApp") || null, whatsapp: value(row, "WhatsApp") || null,
          isPrimary, notes: value(row, "Notas") || null,
        };
        await transaction.contact.upsert({
          where: { id: existingContact?.id || "__missing__" }, create: data, update: { ...data, externalId: undefined },
        });
      }
      return { kind: existingContact ? "updated" : "created", targetId: existingContact?.id };
    }
    case "Oportunidades": {
      const existingOpportunity = await findByIdOrExternal(agencyId, externalId, (where) => transaction.opportunity.findMany({
        where, select: { id: true },
      }));
      const account = await accountForSheet();
      const partnerId = value(row, "Partner ID");
      const partner = partnerId ? await findByIdOrExternal(agencyId, partnerId, (where) => transaction.referralPartner.findMany({ where })) : null;
      if (partnerId && !partner) throw new Error("Referenced referral partner was not found in this agency.");
      const amount = parseDecimal(row, "Monto COP", { min: 0 });
      const probability = parseNumber(row, "Probabilidad 0-100", { min: 0, max: 100 });
      const stage = enumValue(value(row, "Etapa"), Object.values(OpportunityStage), "Etapa", OpportunityStage.DISCOVERED, opportunityAliases);
      const ownerId = value(row, "Responsable");
      const owner = ownerId ? await transaction.user.findFirst({
        where: { id: ownerId, memberships: { some: { agencyId } } }, select: { id: true },
      }) : null;
      if (ownerId && !owner) throw new Error("Responsible user is not a member of this agency.");
      const name = value(row, "Negocio");
      if (!name || name.length > 200) throw new Error("Opportunity name is required and limited to 200 characters.");
      const expectedCloseAt = parseDate(row, "Fecha cierre prevista");
      if (commit) {
        const data = {
          agencyId, externalId, accountId: account.id, name,
          serviceName: value(row, "Servicio") || null, stage, amount,
          probability, expectedCloseAt,
          ownerId: owner?.id || null, referralPartnerId: partner?.id || null,
          lostReason: value(row, "Motivo pérdida") || null, notes: value(row, "Notas") || null,
          actualCloseAt: stage === OpportunityStage.WON || stage === OpportunityStage.LOST ? new Date() : null,
        };
        await transaction.opportunity.upsert({
          where: { id: existingOpportunity?.id || "__missing__" }, create: data, update: { ...data, externalId: undefined },
        });
      }
      return { kind: existingOpportunity ? "updated" : "created", targetId: existingOpportunity?.id };
    }
    case "Actividades": {
      const existingActivity = await findByIdOrExternal(agencyId, externalId, (where) => transaction.activity.findMany({
        where, select: { id: true },
      }));
      const entityType = value(row, "Entidad vinculada").toLowerCase();
      const entityId = value(row, "Entidad ID");
      let accountId: string | null = null;
      let contactId: string | null = null;
      let opportunityId: string | null = null;
      if (entityId && entityType.includes("oportun")) {
        const entity = await findByIdOrExternal(agencyId, entityId, (where) => transaction.opportunity.findMany({ where }));
        if (!entity) throw new Error("Referenced opportunity was not found in this agency.");
        opportunityId = entity.id;
      } else if (entityId && entityType.includes("contact")) {
        const entity = await findByIdOrExternal(agencyId, entityId, (where) => transaction.contact.findMany({ where }));
        if (!entity) throw new Error("Referenced contact was not found in this agency.");
        contactId = entity.id;
      } else if (entityId) {
        const entity = await findByIdOrExternal(agencyId, entityId, (where) => transaction.account.findMany({ where }));
        if (!entity) throw new Error("Referenced account was not found in this agency.");
        accountId = entity.id;
      }
      const subject = value(row, "Descripción");
      if (!subject || subject.length > 200) throw new Error("Activity description is required and limited to 200 characters.");
      const status = enumValue(value(row, "Estado"), Object.values(ActivityStatus), "Estado", ActivityStatus.OPEN, activityStatusAliases);
      const type = enumValue(value(row, "Tipo"), Object.values(ActivityType), "Tipo", ActivityType.NOTE, activityTypeAliases);
      const dueAt = parseDate(row, "Fecha");
      const assigneeId = value(row, "Responsable");
      const assignee = assigneeId ? await transaction.user.findFirst({
        where: { id: assigneeId, memberships: { some: { agencyId } } }, select: { id: true },
      }) : null;
      if (assigneeId && !assignee) throw new Error("Responsible user is not a member of this agency.");
      if (commit) {
        const data = {
          agencyId, externalId, accountId, contactId, opportunityId, assigneeId: assignee?.id || null,
          type, status, subject, description: value(row, "Notas") || null,
          dueAt,
          completedAt: status === ActivityStatus.COMPLETED ? dueAt || new Date() : null,
        };
        await transaction.activity.upsert({
          where: { id: existingActivity?.id || "__missing__" }, create: data, update: { ...data, externalId: undefined },
        });
      }
      return { kind: existingActivity ? "updated" : "created", targetId: existingActivity?.id };
    }
    case "Propuestas": {
      const existingProposal = await findByIdOrExternal(agencyId, externalId, (where) => transaction.proposal.findMany({
        where, select: { id: true },
      }));
      const account = await accountForSheet();
      const opportunityId = value(row, "Oportunidad ID");
      const opportunity = opportunityId ? await findByIdOrExternal(agencyId, opportunityId, (where) => transaction.opportunity.findMany({ where })) : null;
      if (opportunityId && (!opportunity || opportunity.accountId !== account.id)) throw new Error("Referenced opportunity does not belong to the selected account.");
      const title = value(row, "Título propuesta");
      if (!title || title.length > 200) throw new Error("Proposal title is required and limited to 200 characters.");
      const status = enumValue(value(row, "Estado"), Object.values(ProposalStatus), "Estado", ProposalStatus.DRAFT, proposalStatusAliases);
      const subtotal = parseDecimal(row, "Subtotal", { required: true, min: 0 })!;
      const discount = parseDecimal(row, "Descuento", { min: 0 }) || new Prisma.Decimal(0);
      const tax = parseDecimal(row, "Impuestos", { min: 0 }) || new Prisma.Decimal(0);
      const total = parseDecimal(row, "Total", { required: true, min: 0 })!;
      const estimatedHours = parseDecimal(row, "Horas estimadas", { min: 0 });
      const hourlyRate = parseDecimal(row, "Tarifa comercial COP/h", { min: 0 });
      const validUntil = parseDate(row, "Válida hasta");
      const proposalDate = parseDate(row, "Fecha");
      if (commit) {
        const data = {
          agencyId, externalId, accountId: account.id, opportunityId: opportunity?.id || null,
          authorId: null,
          number: `CSV-${createHash("sha256").update(externalId).digest("hex").slice(0, 24)}`,
          title, status,
          currency: value(row, "Moneda") || "COP", subtotal, discount, tax, total,
          estimatedHours, hourlyRate, validUntil, documentUrl: value(row, "Enlace PDF") || null,
        };
        await transaction.proposal.upsert({
          where: { id: existingProposal?.id || "__missing__" },
          create: { ...data, version: 1, createdAt: proposalDate || new Date() },
          update: { ...data, externalId: undefined, number: undefined },
        });
      }
      return { kind: existingProposal ? "updated" : "created", targetId: existingProposal?.id };
    }
    case "Proyectos": {
      const existingProject = await findByIdOrExternal(agencyId, externalId, (where) => transaction.project.findMany({
        where, select: { id: true },
      }));
      const account = await accountForSheet();
      const name = value(row, "Nombre");
      if (!name || name.length > 200) throw new Error("Project name is required and limited to 200 characters.");
      const status = enumValue(value(row, "Estado"), Object.values(ProjectStatus), "Estado", ProjectStatus.PLANNING, projectStatusAliases);
      const progress = parseNumber(row, "Avance 0-100", { min: 0, max: 100 }) ?? 0;
      const startAt = parseDate(row, "Fecha inicio");
      const dueAt = parseDate(row, "Entrega prevista");
      const budget = parseDecimal(row, "Presupuesto COP", { min: 0 });
      const plannedCost = parseDecimal(row, "Costo previsto COP", { min: 0 });
      const actualCost = parseDecimal(row, "Gasto real COP", { min: 0 });
      if (commit) {
        const data = {
          agencyId, externalId, accountId: account.id, name, type: value(row, "Tipo") || null,
          status, startAt, dueAt, budget, plannedCost, actualCost,
          progress: Math.round(progress), deliverablesUrl: value(row, "Enlace entregables") || null,
        };
        await transaction.project.upsert({
          where: { id: existingProject?.id || "__missing__" }, create: data, update: { ...data, externalId: undefined },
        });
      }
      return { kind: existingProject ? "updated" : "created", targetId: existingProject?.id };
    }
    case "Tareas": {
      const existingTask = await findByIdOrExternal(agencyId, externalId, (where) => transaction.workItem.findMany({
        where, select: { id: true },
      }));
      const project = await projectForSheet();
      const title = value(row, "Tarea");
      if (!title || title.length > 200) throw new Error("Task title is required and limited to 200 characters.");
      const status = enumValue(value(row, "Estado"), Object.values(WorkItemStatus), "Estado", WorkItemStatus.TODO, taskStatusAliases);
      const priority = enumValue(value(row, "Prioridad"), Object.values(RecordPriority), "Prioridad", RecordPriority.NORMAL, priorityAliases);
      const dueAt = parseDate(row, "Fecha límite");
      const estimateHours = parseDecimal(row, "Horas estimadas", { min: 0 });
      const assigneeId = value(row, "Responsable");
      const assignee = assigneeId ? await transaction.user.findFirst({
        where: { id: assigneeId, memberships: { some: { agencyId } } }, select: { id: true },
      }) : null;
      if (assigneeId && !assignee) throw new Error("Responsible user is not a member of this agency.");
      if (commit) {
        const data = {
          agencyId, externalId, projectId: project.id, title, status, priority, assigneeId: assignee?.id || null,
          dueAt, estimateHours,
          description: [value(row, "Bloqueo"), value(row, "Notas")].filter(Boolean).join("\n") || null,
          completedAt: status === WorkItemStatus.DONE ? dueAt || new Date() : null,
        };
        await transaction.workItem.upsert({
          where: { id: existingTask?.id || "__missing__" }, create: data, update: { ...data, externalId: undefined },
        });
      }
      return { kind: existingTask ? "updated" : "created", targetId: existingTask?.id };
    }
    case "Horas": {
      const existingEntry = await findByIdOrExternal(agencyId, externalId, (where) => transaction.timeEntry.findMany({
        where, select: { id: true },
      }));
      const project = await projectForSheet();
      const hours = parseDecimal(row, "Horas", { required: true, min: 0.01, max: 24 })!;
      const workDate = parseDate(row, "Fecha", true)!;
      const description = value(row, "Concepto");
      if (!description || description.length > 1000) throw new Error("Time-entry concept is required and limited to 1,000 characters.");
      const billable = parseYesNo(value(row, "Facturable"), true);
      const costRate = parseDecimal(row, "Tarifa costo/hora COP", { min: 0 });
      const collaboratorId = value(row, "Colaborador");
      const collaborator = collaboratorId ? await transaction.user.findFirst({
        where: { id: collaboratorId, memberships: { some: { agencyId } } }, select: { id: true },
      }) : null;
      if (collaboratorId && !collaborator) throw new Error("Collaborator is not a member of this agency.");
      if (commit) {
        const data = {
          agencyId, externalId, projectId: project.id, taskId: null, userId: collaborator?.id || null,
          workDate, hours, costRate,
          billableRate: null, billable, description,
        };
        await transaction.timeEntry.upsert({
          where: { id: existingEntry?.id || "__missing__" }, create: data, update: { ...data, externalId: undefined },
        });
      }
      return { kind: existingEntry ? "updated" : "created", targetId: existingEntry?.id };
    }
    case "Servicios": {
      const existingService = await findByIdOrExternal(agencyId, externalId, (where) => transaction.service.findMany({
        where, select: { id: true },
      }));
      const name = value(row, "Servicio");
      if (!name || name.length > 160) throw new Error("Service name is required and limited to 160 characters.");
      const defaultPrice = parseDecimal(row, "Precio COP", { min: 0 });
      const estimatedCost = parseDecimal(row, "Costo previsto COP", { min: 0 });
      const active = parseServiceActive(value(row, "Estado"));
      if (commit) {
        const data = {
          agencyId, externalId, name, category: value(row, "Categoría") || null,
          cycle: value(row, "Ciclo") || null, defaultPrice, estimatedCost, active,
        };
        await transaction.service.upsert({
          where: { id: existingService?.id || "__missing__" }, create: data, update: { ...data, externalId: undefined },
        });
      }
      return { kind: existingService ? "updated" : "created", targetId: existingService?.id };
    }
    default:
      throw new Error("This sheet is export-only; import is not supported.");
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 5_500_000) return NextResponse.json({ error: "CSV upload exceeds the 5 MB limit." }, { status: 413 });
  try {
    const { auth, response } = await requireCrmUser([AgencyRole.OWNER, AgencyRole.ADMIN]);
    if (response) return response;
    const parsedInput = ImportInput.safeParse(await request.json().catch(() => null));
    if (!parsedInput.success) return NextResponse.json({ error: "Invalid CSV import request.", details: parsedInput.error.flatten() }, { status: 400 });
    if (!dataSheetNames.includes(parsedInput.data.sheet as DataSheetName)) return NextResponse.json({ error: "Unknown sheet." }, { status: 400 });
    const sheet = parsedInput.data.sheet as DataSheetName;
    if (!importable.has(sheet)) return NextResponse.json({ error: "This sheet is export-only. It can be downloaded, but not imported safely yet." }, { status: 422 });
    const table = parseCsv(parsedInput.data.csv, 500);
    if (sheet === "Prospectos" || sheet === "Clientes") {
      const aliases: Record<string, string> = { Pais: "País", Sector: "Industria" };
      table.headers = table.headers.map((header) => Object.hasOwn(aliases, header) ? aliases[header] : header);
      if (new Set(table.headers).size !== table.headers.length) {
        return NextResponse.json({ error: "CSV contains duplicate columns for the same field." }, { status: 400 });
      }
      table.rows = table.rows.map((row) => Object.fromEntries(Object.entries(row).map(([header, cell]) => [Object.hasOwn(aliases, header) ? aliases[header] : header, cell])));
    }
    const expectedHeaders = sheetHeaders[sheet] as readonly string[];
    const optionalHeaders = optionalImportHeaders[sheet] || [];
    const missingHeaders = expectedHeaders.filter((header) => !optionalHeaders.includes(header) && !table.headers.includes(header));
    if (missingHeaders.length) return NextResponse.json({ error: "CSV headers do not match the selected sheet.", missingHeaders }, { status: 400 });

    const ids = new Set<string>();
    const duplicateLines = new Set<number>();
    table.rows.forEach((row, index) => {
      const id = value(row, "ID");
      if (!id) return;
      if (ids.has(id)) duplicateLines.add(index + 2);
      ids.add(id);
    });

    const errors: Array<{ row: number; message: string }> = [];
    const counts = { created: 0, updated: 0 };
    await prisma.$transaction(async (transaction) => {
      const accountIssues = sheet === "Prospectos" || sheet === "Clientes"
        ? accountImportIssues(table.rows, await transaction.account.findMany({
          where: { agencyId: auth!.agencyId }, select: { id: true, externalId: true, name: true, country: true },
        }), sheet === "Clientes" ? "Razón social" : "Empresa")
        : new Map<number, string>();
      const targets = new Set<string>();
      // Validate every row without writes, including when commit was requested.
      for (let index = 0; index < table.rows.length; index += 1) {
        if (duplicateLines.has(index + 2)) {
          errors.push({ row: index + 2, message: "Duplicate ID in this CSV." });
          continue;
        }
        const accountIssue = accountIssues.get(index);
        if (accountIssue) {
          errors.push({ row: index + 2, message: accountIssue });
          continue;
        }
        try {
          const result = await applyRow(transaction, auth!.agencyId, sheet, table.rows[index], false);
          if (result.targetId && targets.has(result.targetId)) {
            errors.push({ row: index + 2, message: "Duplicate record: multiple CSV IDs resolve to the same record." });
            continue;
          }
          if (result.targetId) targets.add(result.targetId);
          if (result.kind === "created") counts.created += 1;
          else counts.updated += 1;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError) throw error;
          errors.push({ row: index + 2, message: error instanceof Error ? error.message : "Invalid row." });
        }
      }
      if (parsedInput.data.commit && errors.length === 0) {
        // Let write failures escape this callback so Prisma rolls back the entire batch.
        for (const row of table.rows) {
          await applyRow(transaction, auth!.agencyId, sheet, row, true);
        }
      }
      if (parsedInput.data.commit && errors.length === 0 && table.rows.length > 0) {
        await transaction.auditEvent.create({
          data: {
            agencyId: auth!.agencyId, actorId: auth!.userId, action: "csv.imported",
            entityType: sheet, metadata: { rows: table.rows.length, created: counts.created, updated: counts.updated },
          },
        });
      }
    }, { timeout: 30_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (parsedInput.data.commit && errors.length) return NextResponse.json({
      error: "CSV validation failed; no records were written.",
      errors,
      totalRows: table.rows.length,
      validRows: table.rows.length - errors.length,
    }, { status: 422 });
    return NextResponse.json({
      mode: parsedInput.data.commit ? "imported" : "preview",
      sheet,
      totalRows: table.rows.length,
      created: counts.created,
      updated: counts.updated,
      validRows: table.rows.length - errors.length,
      errors,
    }, { status: parsedInput.data.commit && errors.length ? 422 : 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      return NextResponse.json({ error: "Import conflicted with another record or concurrent change; no records were written. Preview again before retrying." }, { status: 409 });
    }
    if (error instanceof Error && /CSV |Row \d+|headers|unterminated|empty|limit/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return unavailable(error);
  }
}
