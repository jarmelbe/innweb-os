# Reparación de Google Gemini — InnWeb OS

## Estado de verificación (26 oct 2026)
- Código fuente: `jarmelbe/innweb-os`.
- La API de Google es **Gemini Interactions API**: `https://generativelanguage.googleapis.com/v1beta/interactions`, con `store: false`.
- Modelo predeterminado: `gemini-3.8-flash` (Google ofrece este ID; el acceso concreto depende de la clave, proyecto y cuota).
- Se comprobó en Vercel que `GEMINI_API_KEY` estaba asignada **solo a Preview**; su alcance se amplió a **Preview + Production** sin revelar el secreto.
- El CRM de Vercel **no tiene un despliegue de producción correcto**: el último despliegue `main` falla durante `prisma migrate deploy` por PostgreSQL **P1001, conexión a Neon no disponible**.
- `DATABASE_URL` y `DIRECT_URL` se encuentran únicamente en Production; no copiar los datos de producción a Preview solo para una prueba.
- El Vercel project `innweb-os` no muestra un conector de base de datos gestionado y no tiene `crm.innweb.co` asociado a los dominios listados. Verifica el destino real de esa URL antes de considerarlo público.
- **No se probó todavía una respuesta real del modelo**; una clave existente no demuestra que sea válida, esté activa o tenga cuota.

## Cambios de código propuestos
- Acceso al asistente y su API restringido a roles Owner / Admin.
- Errores útiles y diferenciados: permisos de Google, modelo, cuota y problemas del proveedor.
- Plazo de 45 segundos, con `maxDuration=60`.
- Sin registrar prompts, claves ni respuestas de Google en los logs.
- Pruebas de contrato para evitar regresiones.
- No toca RankPulse, puntuaciones, sitemap, ni el sitio público.

## Pasos críticos para recuperar el OS
1. En Neon, verificar que el proyecto de Postgres se encuentre activo, hostname regional correcto, credenciales vigentes, y conectividad SSL por TCP 5432 desde Vercel. No usar valores de ejemplo de `.env.example`.
2. En Vercel → innweb-os → Environment Variables → Production, corregir con valores reales:
   - `DATABASE_URL` = URL **pooled** de Neon con usuario, contraseña y `sslmode=require`.
   - `DIRECT_URL` = URL **directa** al mismo proyecto Neon y base de datos, con `sslmode=require`.
3. No mostrar estas URL ni la API key en capturas públicas, incidencias, commits ni chats. Rotar las claves previamente divulgadas.
4. Si los certificados y DNS son válidos, ejecutar `npx prisma migrate deploy` en un entorno seguro que tenga acceso a la base de datos. El despliegue actual ejecuta migraciones en build; las migraciones fallan y bloquean la publicación.
5. Desplegar de nuevo la rama principal tras probarla; iniciar sesión como Owner/Admin.
6. Probar `/dashboard/ai` con un texto ficticio no sensible. Confirmar respuesta y revisar errores de cuota/autorización; ver consumo en Google AI Studio.
7. Estabilizar las cuotas compartidas, logs y cumplimiento antes de ampliar la IA a operadores o datos reales de clientes.

## Seguridad y calidad
El nivel gratuito de Google puede implicar uso de datos para mejorar productos. No introducir datos personales, confidenciales o médicos de clientes hasta configurar el plan y condiciones adecuados. La API actual utiliza un limitador en memoria por usuario y servidor; no es suficiente para equipos grandes.

Fuentes:
- https://ai.google.dev/gemini-api/docs/interactions-overview
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/pricing
- https://www.prisma.io/docs/orm/reference/error-reference#p1001
