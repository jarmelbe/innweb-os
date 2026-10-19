import { AgencyRole, OpportunityStage, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCrmUser } from "@/lib/crm";
import { serializeCsv } from "@/lib/csv";
import { dataSheetNames, sheetHeaders, type DataSheetName } from "@/lib/sheet-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function date(value: Date | null | undefined) {
  return value?.toISOString() ?? "";
}

function record(id: string | null | undefined, externalId?: string | null) {
  return externalId || id || "";
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "CRM database is not configured." }, { status: 503 });
  try {
    const { auth, response } = await requireCrmUser();
    if (response) return response;
    const sheet = new URL(request.url).searchParams.get("sheet") as DataSheetName | null;
    if (!sheet || !dataSheetNames.includes(sheet)) return NextResponse.json({ error: "Unknown CSV sheet." }, { status: 400 });
    const financeSheets = ["Facturas", "Referidos"].includes(sheet);
    const productionSheets = ["Proyectos", "Tareas", "Horas"].includes(sheet);
    const allowedRoles: AgencyRole[] = financeSheets
      ? [AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.FINANCE]
      : productionSheets
        ? [AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.PRODUCTION]
        : [AgencyRole.OWNER, AgencyRole.ADMIN, AgencyRole.SALES];
    if (!allowedRoles.includes(auth!.role)) return NextResponse.json({ error: "Insufficient agency permissions." }, { status: 403 });
    const agencyId = auth!.agencyId;
    let rows: Array<Record<string, unknown>> = [];
    switch (sheet) {
      case "Inicio": {
        const [accounts, opportunities, customers, projects, openActivities, pipeline] = await Promise.all([
          prisma.account.count({ where: { agencyId, archivedAt: null } }),
          prisma.opportunity.count({ where: { agencyId, stage: { notIn: [OpportunityStage.WON, OpportunityStage.LOST] } } }),
          prisma.account.count({ where: { agencyId, type: "CUSTOMER", archivedAt: null } }),
          prisma.project.count({ where: { agencyId, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } }),
          prisma.activity.count({ where: { agencyId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
          prisma.opportunity.aggregate({
            where: { agencyId, stage: { notIn: [OpportunityStage.WON, OpportunityStage.LOST] } },
            _sum: { amount: true },
          }),
        ]);
        rows = [
          { Métrica: "Empresas", Valor: accounts, Observaciones: "Registros reales de esta agencia" },
          { Métrica: "Oportunidades abiertas", Valor: opportunities, Observaciones: "No incluye negocios ganados o perdidos" },
          { Métrica: "Clientes", Valor: customers, Observaciones: "Cuentas convertidas" },
          { Métrica: "Proyectos activos", Valor: projects, Observaciones: "Planificación, activos o en pausa" },
          { Métrica: "Actividades abiertas", Valor: openActivities, Observaciones: "Seguimientos pendientes o en curso" },
          { Métrica: "Pipeline abierto COP", Valor: pipeline._sum.amount?.toString() || "0", Observaciones: "Suma de montos registrados; puede incluir montos vacíos" },
        ];
        break;
      }
      case "Prospectos":
      case "Clientes": {
        const accounts = await prisma.account.findMany({
          where: { agencyId, archivedAt: null, type: sheet === "Clientes" ? "CUSTOMER" : { not: "CUSTOMER" } },
          orderBy: { createdAt: "asc" },
          include: { contacts: { where: { isPrimary: true }, take: 1 }, referralPartner: true },
        });
        rows = accounts.map((account) => {
          const contact = account.contacts[0];
          const common = {
            ID: record(account.id, account.externalId),
            Empresa: account.name,
            "Razón social": account.legalName || account.name,
            "Contacto principal": contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : "",
            Contacto: contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : "",
            Email: contact?.email || "",
            Teléfono: contact?.phone || "",
            "Teléfono/WhatsApp": contact?.whatsapp || contact?.phone || "",
            "Sitio web": account.website || "",
            Industria: account.industry || "",
            País: account.country || "",
            "Servicio solicitado": account.serviceInterest || "",
            Servicio: account.serviceInterest || "",
            Fuente: account.source || "",
            Estado: account.type,
            Prioridad: account.priority,
            Ciudad: account.city || "",
            "Fecha alta": date(account.createdAt),
            "Próximo contacto": date(account.nextFollowUpAt),
            "Última interacción": date(account.lastContactAt),
            "Partner ID": record(account.referralPartner?.id, account.referralPartner?.externalId),
            "Prospecto origen ID": "",
            NIT: account.taxId || "",
            Notas: account.notes || "",
            "Responsable": account.ownerId || "",
          };
          return common;
        });
        break;
      }
      case "Contactos": {
        const contacts = await prisma.contact.findMany({ where: { agencyId }, orderBy: { createdAt: "asc" }, include: { account: true } });
        rows = contacts.map((item) => ({
          ID: record(item.id, item.externalId),
          "Organización o lead ID": record(item.account?.id, item.account?.externalId),
          Nombre: [item.firstName, item.lastName].filter(Boolean).join(" "),
          Cargo: item.title || "",
          Email: item.email || "",
          WhatsApp: item.whatsapp || item.phone || "",
          "Contacto principal": item.isPrimary ? "Sí" : "No",
          Notas: item.notes || "",
        }));
        break;
      }
      case "Oportunidades": {
        const opportunities = await prisma.opportunity.findMany({
          where: { agencyId }, orderBy: { createdAt: "asc" },
          include: { account: true, referralPartner: true },
        });
        rows = opportunities.map((item) => ({
          ID: record(item.id, item.externalId),
          "Prospecto ID": item.account.type === "CUSTOMER" ? "" : record(item.account.id, item.account.externalId),
          "Cliente ID": item.account.type === "CUSTOMER" ? record(item.account.id, item.account.externalId) : "",
          Negocio: item.name,
          Servicio: item.serviceName || "",
          Etapa: item.stage,
          "Monto COP": item.amount?.toString() || "",
          "Probabilidad 0-100": item.probability ?? "",
          "Fecha cierre prevista": date(item.expectedCloseAt),
          Responsable: item.ownerId || "",
          "Partner ID": record(item.referralPartner?.id, item.referralPartner?.externalId),
          "Motivo pérdida": item.lostReason || "",
          Notas: item.notes || "",
        }));
        break;
      }
      case "Actividades": {
        const activities = await prisma.activity.findMany({
          where: { agencyId }, orderBy: { createdAt: "asc" },
          include: { account: true, contact: true, opportunity: true },
        });
        rows = activities.map((item) => {
          const entity = item.opportunity ? "Oportunidad" : item.contact ? "Contacto" : "Cuenta";
          const linkedId = item.opportunity
            ? record(item.opportunity.id, item.opportunity.externalId)
            : item.contact
              ? record(item.contact.id, item.contact.externalId)
              : record(item.account?.id, item.account?.externalId);
          return {
            ID: record(item.id, item.externalId), Tipo: item.type, "Entidad vinculada": entity, "Entidad ID": linkedId,
            Descripción: item.subject, Responsable: item.assigneeId || "", Fecha: date(item.dueAt), Estado: item.status,
            "Próxima acción": "", Notas: item.description || "",
          };
        });
        break;
      }
      case "Propuestas": {
        const proposals = await prisma.proposal.findMany({
          where: { agencyId }, orderBy: { createdAt: "asc" },
          include: { account: true, opportunity: true },
        });
        rows = proposals.map((item) => ({
          ID: record(item.id, item.externalId), Fecha: date(item.createdAt),
          "Cliente ID": record(item.account.id, item.account.externalId),
          "Oportunidad ID": record(item.opportunity?.id, item.opportunity?.externalId),
          "Título propuesta": item.title, Estado: item.status, Moneda: item.currency,
          Subtotal: item.subtotal.toString(), Descuento: item.discount.toString(), Impuestos: item.tax.toString(),
          Total: item.total.toString(), "Válida hasta": date(item.validUntil), Responsable: item.authorId || "",
          "Enlace PDF": item.documentUrl || "", "Horas estimadas": item.estimatedHours?.toString() || "",
          "Tarifa comercial COP/h": item.hourlyRate?.toString() || "",
          "Referencia subtotal horas COP": item.estimatedHours && item.hourlyRate
            ? item.estimatedHours.mul(item.hourlyRate).toDecimalPlaces(2).toString()
            : "",
        }));
        break;
      }
      case "Proyectos": {
        const projects = await prisma.project.findMany({ where: { agencyId }, orderBy: { createdAt: "asc" }, include: { account: true } });
        rows = projects.map((item) => ({
          ID: record(item.id, item.externalId), "Cliente ID": record(item.account.id, item.account.externalId),
          Nombre: item.name, Tipo: item.type || "", Estado: item.status, "Fecha inicio": date(item.startAt),
          "Entrega prevista": date(item.dueAt), Responsable: "", "Presupuesto COP": item.budget?.toString() || "",
          "Costo previsto COP": item.plannedCost?.toString() || "", "Gasto real COP": item.actualCost?.toString() || "",
          "Balance previsto COP": item.budget && item.plannedCost ? item.budget.sub(item.plannedCost).toString() : "",
          "Balance vs gasto COP": item.budget && item.actualCost ? item.budget.sub(item.actualCost).toString() : "",
          "Avance 0-100": item.progress, "Enlace entregables": item.deliverablesUrl || "",
        }));
        break;
      }
      case "Tareas": {
        const tasks = await prisma.workItem.findMany({
          where: { agencyId }, orderBy: { createdAt: "asc" },
          include: { project: true, timeEntries: { select: { hours: true } } },
        });
        rows = tasks.map((item) => ({
          ID: record(item.id, item.externalId), "Proyecto ID": record(item.project.id, item.project.externalId),
          Tarea: item.title, Responsable: item.assigneeId || "", Prioridad: item.priority, Estado: item.status,
          "Fecha límite": date(item.dueAt), "Horas estimadas": item.estimateHours?.toString() || "",
          "Horas ejecutadas": item.timeEntries.reduce((sum, entry) => sum.add(entry.hours), new Prisma.Decimal(0)).toString(),
          Bloqueo: item.status === "BLOCKED" ? item.description || "" : "",
          Notas: item.description || "",
        }));
        break;
      }
      case "Horas": {
        const entries = await prisma.timeEntry.findMany({ where: { agencyId }, orderBy: [{ workDate: "asc" }, { createdAt: "asc" }], include: { project: true } });
        rows = entries.map((item) => ({
          ID: record(item.id, item.externalId), Fecha: date(item.workDate),
          "Proyecto ID": record(item.project.id, item.project.externalId), Colaborador: item.userId || "",
          Horas: item.hours.toString(), "Tarifa costo/hora COP": item.costRate?.toString() || "",
          "Costo total COP": item.costRate ? item.hours.mul(item.costRate).toDecimalPlaces(2).toString() : "",
          Facturable: item.billable ? "Sí" : "No", Concepto: item.description,
        }));
        break;
      }
      case "Facturas": {
        const invoices = await prisma.invoice.findMany({ where: { agencyId }, orderBy: { createdAt: "asc" }, include: { account: true, project: true, payments: true } });
        rows = invoices.map((item) => {
          const collected = item.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
          return {
            ID: record(item.id, item.externalId), Fecha: date(item.issuedAt),
            "Cliente ID": record(item.account.id, item.account.externalId),
            "Proyecto ID": record(item.project?.id, item.project?.externalId), Concepto: item.notes || "",
            "Base COP": item.subtotal.toString(), "Impuesto COP": item.tax.toString(), "Total COP": item.total.toString(),
            Vencimiento: date(item.dueAt), Estado: item.status, "Recaudado COP": collected.toString(),
            "Saldo COP": item.total.sub(collected).toString(),
          };
        });
        break;
      }
      case "Referidos": {
        const partners = await prisma.referralPartner.findMany({ where: { agencyId }, orderBy: { createdAt: "asc" }, include: { commissions: true } });
        rows = partners.map((partner) => {
          const sum = (key: "collectedRevenue" | "attributedCosts" | "netProfit" | "amountDue" | "amountPaid") =>
            partner.commissions.reduce((total, item) => total.add(item[key]), new Prisma.Decimal(0));
          const earned = sum("amountDue");
          const paid = sum("amountPaid");
          return {
            "Partner ID": record(partner.id, partner.externalId), "Nombre socio": partner.name, Código: partner.code,
            "% comisión utilidad neta": partner.commissionRate.toString(), "Ingresos cobrados COP": sum("collectedRevenue").toString(),
            "Costos atribuidos COP": sum("attributedCosts").toString(), "Utilidad neta COP": sum("netProfit").toString(),
            "Comisión devengada COP": earned.toString(), "Comisión pagada COP": paid.toString(),
            "Saldo comisión COP": earned.sub(paid).toString(), Estado: partner.active ? "ACTIVO" : "INACTIVO", Notas: partner.notes || "",
          };
        });
        break;
      }
      case "Servicios": {
        const services = await prisma.service.findMany({ where: { agencyId }, orderBy: { createdAt: "asc" } });
        rows = services.map((item) => ({
          ID: record(item.id, item.externalId), Servicio: item.name, Categoría: item.category || "",
          Ciclo: item.cycle || "", "Precio COP": item.defaultPrice?.toString() || "",
          "Costo previsto COP": item.estimatedCost?.toString() || "",
          "Margen %": item.defaultPrice && item.estimatedCost && item.defaultPrice.gt(0)
            ? item.defaultPrice.sub(item.estimatedCost).div(item.defaultPrice).mul(100).toDecimalPlaces(2).toString()
            : "",
          Estado: item.active ? "ACTIVO" : "INACTIVO",
        }));
        break;
      }
      case "Configuración": {
        const agency = await prisma.agency.findUnique({
          where: { id: agencyId },
          select: { name: true, slug: true, defaultCurrency: true, timezone: true, baseHourlyRate: true },
        });
        if (!agency) return NextResponse.json({ error: "Agency configuration was not found." }, { status: 404 });
        rows = [
          { Parámetro: "Agencia", Valor: agency.name, Observaciones: "Configuración del espacio de trabajo" },
          { Parámetro: "Identificador", Valor: agency.slug, Observaciones: "No contiene secretos" },
          { Parámetro: "Moneda", Valor: agency.defaultCurrency, Observaciones: "Moneda predeterminada" },
          { Parámetro: "Zona horaria", Valor: agency.timezone, Observaciones: "Zona horaria del espacio" },
          { Parámetro: "Tarifa base por hora", Valor: agency.baseHourlyRate.toString(), Observaciones: "Valor COP configurado" },
          { Parámetro: "Intercambio", Valor: "CSV manual", Observaciones: "No hay sincronización automática con Google Sheets" },
        ];
        break;
      }
    }

    const csv = `\uFEFF${serializeCsv(sheetHeaders[sheet], rows)}`;
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${encodeURIComponent(sheet)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("CSV export failed", error);
    return NextResponse.json({ error: "CSV export failed." }, { status: 503 });
  }
}
