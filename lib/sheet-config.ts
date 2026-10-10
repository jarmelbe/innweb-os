export const sheetHeaders = {
  Inicio: ["Métrica", "Valor", "Observaciones"],
  Prospectos: ["ID", "Fecha alta", "Empresa", "Contacto principal", "Email", "Teléfono/WhatsApp", "Ciudad", "Servicio solicitado", "Fuente", "Estado", "Prioridad", "Responsable", "Próximo contacto", "Última interacción", "Partner ID", "Notas"],
  Contactos: ["ID", "Organización o lead ID", "Nombre", "Cargo", "Email", "WhatsApp", "Contacto principal", "Notas"],
  Oportunidades: ["ID", "Prospecto ID", "Cliente ID", "Negocio", "Servicio", "Etapa", "Monto COP", "Probabilidad 0-100", "Fecha cierre prevista", "Responsable", "Partner ID", "Motivo pérdida", "Notas"],
  Actividades: ["ID", "Tipo", "Entidad vinculada", "Entidad ID", "Descripción", "Responsable", "Fecha", "Estado", "Próxima acción", "Notas"],
  Clientes: ["ID", "Fecha alta", "Razón social", "Contacto", "Email", "Teléfono", "NIT", "Sitio web", "Servicio", "Estado", "Prospecto origen ID", "Partner ID"],
  Propuestas: ["ID", "Fecha", "Cliente ID", "Oportunidad ID", "Título propuesta", "Estado", "Moneda", "Subtotal", "Descuento", "Impuestos", "Total", "Válida hasta", "Responsable", "Enlace PDF", "Horas estimadas", "Tarifa comercial COP/h", "Referencia subtotal horas COP"],
  Proyectos: ["ID", "Cliente ID", "Nombre", "Tipo", "Estado", "Fecha inicio", "Entrega prevista", "Responsable", "Presupuesto COP", "Costo previsto COP", "Gasto real COP", "Balance previsto COP", "Balance vs gasto COP", "Avance 0-100", "Enlace entregables"],
  Tareas: ["ID", "Proyecto ID", "Tarea", "Responsable", "Prioridad", "Estado", "Fecha límite", "Horas estimadas", "Horas ejecutadas", "Bloqueo", "Notas"],
  Horas: ["ID", "Fecha", "Proyecto ID", "Colaborador", "Horas", "Tarifa costo/hora COP", "Costo total COP", "Facturable", "Concepto"],
  Facturas: ["ID", "Fecha", "Cliente ID", "Proyecto ID", "Concepto", "Base COP", "Impuesto COP", "Total COP", "Vencimiento", "Estado", "Recaudado COP", "Saldo COP"],
  Referidos: ["Partner ID", "Nombre socio", "Código", "% comisión utilidad neta", "Ingresos cobrados COP", "Costos atribuidos COP", "Utilidad neta COP", "Comisión devengada COP", "Comisión pagada COP", "Saldo comisión COP", "Estado", "Notas"],
  Servicios: ["ID", "Servicio", "Categoría", "Ciclo", "Precio COP", "Costo previsto COP", "Margen %", "Estado"],
  Configuración: ["Parámetro", "Valor", "Observaciones"],
} as const;

export type DataSheetName = keyof typeof sheetHeaders;
export const dataSheetNames = Object.keys(sheetHeaders) as DataSheetName[];
export const importableDataSheetNames: DataSheetName[] = [
  "Prospectos", "Contactos", "Oportunidades", "Actividades", "Clientes",
  "Propuestas", "Proyectos", "Tareas", "Horas", "Servicios",
];
