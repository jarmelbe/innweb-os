# InnWeb Intelligence — implementación por etapas, sin perder señal

**Fecha:** 26 de octubre de 2026  
**Destino principal:** `jarmelbe/innweb-os`  
**Sitio institucional:** `innweb.co` (proyecto separado; este repositorio NO lo edita directamente).  
**Publicación:** no desplegar automáticamente en producción sin pruebas de staging y revisión.

## 1. Principio editorial

> **Tecnología que propone. Personas que comprueban.**

Un buen producto no confunde una demostración con un servicio conectado. Cada pantalla muestra lo que hace, lo que no hace y qué datos faltan para tomar una decisión. Tono: directo, contemporáneo, sobrio y humano. No usamos superlativos sin evidencia; no prometemos el primer lugar en Google, resultados comerciales, precisión clínica ni retorno económico.

## 2. Arquitectura y distribución

### Administrador — `/dashboard/intelligence`

- **Acceso:** solo Owner y Admin, apoyado en el inicio de sesión existente del CRM.
- **Operación:** nueve flujos de *redacción y análisis preliminar*, mediante el endpoint de Gemini ya presente en el PR #5 fusionado. Los flujos incluyen instrucciones editoriales y advertencias específicas.
- **No realizan cambios:** no envían correos, no mueven oportunidades, no crean citas, no alteran datos de clientes.
- **Dependencias:** `DATABASE_URL` y `GEMINI_API_KEY` en el servidor; no se almacenan claves ni respuestas en el código.

### Visitantes — `/intelligence` (solo vista previa)

- **RankPulse:** enlace a la auditoría técnica pública existente. El algoritmo y las puntuaciones se mantienen tal cual.
- **BrandIA Express:** ejercicio editorial en el navegador, sin backend ni registro. El usuario escribe su marca, sector, audiencia, voz y objetivo; obtiene una orientación básica para copiar. No es generación de imágenes ni validación legal de marca.
- **Motion Lab y Voice Desk:** descripciones de servicio y ruta de consulta, no demos engañosas.
- **SEO:** la ruta está marcada `noindex, nofollow` hasta verificar alojamiento, canonical y publicar en el **proyecto original** de InnWeb.co. No modificar el sitemap ni robots.txt existentes durante esta etapa.

## 3. Catálogo: el estado visible importa

| Solución | Destinatario | Qué funciona ahora | Integración pendiente |
|---|---|---|---|
| RankPulse | Público / OS | Auditoría técnica existente y borradores de interpretación | Datos consentidos de Search Console, versiones comparables |
| BrandIA | Público / OS | Mapa de marca editorial local y borrador estratégico privado | Nano Banana, almacenamiento y watermark para imágenes |
| Sales Desk | CRM | Borrador comercial privado con Gemini | Lectura autorizada del pipeline, revisión/confirmación de envío |
| Knowledge | OS | Estructuración de texto aportado manualmente | Índice multimodal con acceso por cliente y fuentes citadas |
| Workspace Flow | OS | Diseño de flujos en borrador | Gmail / Calendar / Drive OAuth, logs y aprobación |
| Search & Social Signals | OS | Esquema de informes sin métricas inventadas | Search Console, plataformas y atribución con fuentes verificadas |
| Motion Lab | OS / Público | Guiones, escenas, voz y CTA en borrador | Generación/edición de video y créditos |
| Voice Desk | OS / Público | Guion conversacional en borrador | Audio en tiempo real, transferencias y consentimientos |
| Agent Gateway | OS | Diseño de permisos y controles | API Gateway/MCP por rol, scopes, trazabilidad |

Todos los textos se administran desde `lib/innweb-intelligence.ts`. Cada capacidad marcada como pendiente se mantiene desactivada hasta cumplir sus condiciones.

## 4. Conservación de las puntuaciones y el posicionamiento

**Invariantes de publicación:**

1. No modificar `app/api/v1/opportunity-finder/audit/route.ts` ni los cálculos existentes de `overallScore` y `opportunityScore`.
2. Los indicadores de Search Console se muestran por separado con **fuente**, **propiedad**, **periodo**, **última fecha de actualización** y **si son comparables**.
3. Un nuevo indicador GEO no se fusiona con el score histórico ni se presenta como posición en Google.
4. No alterar `innweb.co`, los enlaces externos, títulos, estructura de encabezados, datos estructurados ni rutas indexadas hasta contar con un inventario antes/después.
5. No publicar estadísticas ni casos de éxito que carezcan de evidencia y autorización.
6. Añadir eventos analíticos solo con consentimiento cuando aplique; no instrumentar este prototipo con píxeles adicionales.
7. Verificar las páginas públicas en móvil, teclado, lector de pantalla y métricas de rendimiento antes de vincularlas al menú oficial.
8. Mantener el diagnóstico gratuito actual y su CTA; añadir herramientas sin canibalizarlo.

### Control previo al lanzamiento en innweb.co

Guardar baseline con listado real de URL/sitemap, títulos, meta descriptions, indexación, schema, Search Console, Core Web Vitals y conversiones disponibles. Comparar tras la publicación a 7, 28 y 90 días; los resultados de SEO no son garantizables.

## 5. Seguridad de IA

- El prompt debe contener **solo datos autorizados**, nunca credenciales ni información médica/financiera o personal de clientes.
- El endpoint existente `/api/crm/ai` limita solicitudes por proceso (no límite durable distribuido); implementar Redis u otra cuota compartida antes de abrirlo a más usuarios.
- Añadir supervisión de gasto, registros sin prompts sensibles, protección anti-CSRF verificable detrás del proxy, revisión de términos de Google y DPA cuando proceda.
- Todo envío, publicación, modificación del CRM o creación de evento requiere permisos específicos y confirmación humana.
- Para cualquier búsqueda privada sobre documentos: partición por agencia, acceso por rol, fuente/versión, plazos de conservación y eliminación.

## 6. Próximas integraciones técnicas: criterios de aceptación

**Search Console:** OAuth con scopes mínimos, selector de propiedad, importación verificada; informes de AI Search y propiedades sociales dependen de disponibilidad real de datos/API. Ofrecer carga consentida de exportaciones cuando no haya endpoint. Nunca inferir cifras.

**Nano Banana:** confirmar API/modelo y costo vigente; cuota gratuita sostenible; logo/carga bajo consentimiento; distinguir pruebas de creación; marca de agua inamovible en el nivel gratuito; revisión humana para archivo final.

**Gmail/Calendar/Drive:** OAuth individual por cuenta, tokens cifrados, mínimos scopes, registro de qué objeto se leyó. Los envíos requieren aprobación explícita.

**Multimodal Knowledge:** embeddings y almacenamiento cifrado, aislamiento por agencia, referencias a documentos y controles de baja.

**Video y voz:** proveedor disponible, límites y costos, consentimiento para imágenes/voz, derechos de material, revisión antes de exportar o publicar. Nunca simular producción.

**Gateway/MCP:** solo rutas explícitamente permitidas, validación de identidad, autorización por acción, rate limits, logs, confirmación y abortos. No habilitar accesos a facturas, cobros o datos de pacientes por defecto.

## 7. QA de esta rama

- [ ] `npm ci`
- [ ] `npm run db:generate`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Sesión sin autenticar: `/dashboard/intelligence` redirige a login
- [ ] Usuario sin rol Owner/Admin: se redirige a dashboard
- [ ] Gemini sin clave: mensaje claro; ningún intento externo
- [ ] Gemini con clave y staging seguro: respuesta útil, cuota, errores, no persistencia
- [ ] `/intelligence` es accesible sin sesión y tiene meta robots noindex
- [ ] BrandIA Express actualiza vista previa sin enviar ninguna petición
- [ ] RankPulse: comparar fixture/criterios existentes, sin regresión
- [ ] `innweb.co` mantiene rutas, sitemap, schema y CTA actuales
- [ ] Verificación manual de contraste, mobile, tabulación y navegación

**Documentación oficial:**  
- https://ai.google.dev/gemini-api/docs/interactions-overview  
- https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports  
- https://developers.google.com/search/blog/2026/07/platform-properties-social-video-guide

*Esta rama prepara una fundación funcional en un repositorio de OS. NO equivale a completar ni publicar las integraciones de cada proveedor ni a editar el sitio institucional de InnWeb.co.*
