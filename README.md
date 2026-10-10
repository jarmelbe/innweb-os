# INNweb OS — Opportunity Finder™

A bilingual, non-invasive website audit MVP for agencies. It evaluates public page signals across performance, SEO, security, accessibility, conversion, and infrastructure, then returns recommendations and an opportunity score.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The home page audits one public URL at a time. Automatic prospect discovery is not connected; sample buttons run real audits against the listed sample websites. The dashboard no longer presents invented customer or infrastructure metrics.

## CRM database foundation

The CRM data model is prepared for PostgreSQL with Prisma. It covers agency workspaces and roles, company accounts and contacts, sales opportunities and follow-ups, versioned website-audit evidence, a service catalog and proposals, project/task/time tracking, invoices and payments, referral commissions, and a change audit trail. The schema and initial migration are version-controlled in `prisma/`.

**Provider decision:** Neon is the planned PostgreSQL provider for development/pilot. No account, database, provider credentials, or Vercel environment variables have been created/configured, so the migration has **not** been applied and CRM records are not being stored. Authentication, workspace membership, and role checks are implemented, but the CRM is not production-ready until a database is provisioned, migration and end-to-end tests pass, backups are configured, and production secrets are set. The Google Sheet remains an auxiliary manual CSV source; automatic Google synchronization is not enabled.

To connect a Neon database after it has been explicitly provisioned:

1. Provision a PostgreSQL database with explicit authorization. Create a local `.env` from `.env.example` without overwriting an existing environment file, then set `DATABASE_URL` to the pooled connection string and `DIRECT_URL` to its direct connection string. Keep both credentials private and out of Git.
2. Run `npm run db:generate` and `npm run db:migrate:dev` to apply the versioned migration to the development database.
3. Set a long random `INNWEB_SETUP_TOKEN`, start the app, and use `/setup` once to create the first owner and agency. Remove the setup token afterward; never put database or setup secrets in browser code or chat.
4. Configure the pooled `DATABASE_URL`, direct `DIRECT_URL`, and a long random `INNWEB_SETUP_TOKEN` in Vercel's Production environment. Vercel's `vercel-build` applies Prisma migrations only for Production deploys, then builds Next.js; Preview builds do not run migrations. Keep Preview database credentials isolated from Production.
5. Verify login, agency isolation, role restrictions, CSV preview/import, and the full audit → opportunity → proposal → project → task/time-entry flow against the database before using live records.

`npm run db:studio` opens Prisma Studio for local database inspection. Without `DATABASE_URL`, the app shows the connection/setup state and does not invent CRM records.

## CRM features

- Private first-owner setup and password login with hashed passwords, secure HTTP-only sessions, agency membership, and role-guarded APIs.
- Real account/contact creation, opportunity pipeline updates, proposal creation and acceptance, project creation, task status, and time tracking.
- CSV export for all 14 workbook tabs. Owner/Admin can preview and atomically import validated rows for Prospectos, Contactos, Oportunidades, Actividades, Clientes, Propuestas, Proyectos, Tareas, Horas, and Servicios. Stable IDs make repeated imports update matching records. Facturas and Referidos are export-only because the workbook's aggregate payment/commission values do not provide enough evidence to safely create ledger entries.
- CSV import is limited to 5 MB / 500 rows, checks agency-scoped references and duplicates, and writes nothing if any row fails validation. Only Owner/Admin can import. Export permissions are scoped by sales, production, and finance roles.

The dashboard can issue invoices and record partial/full payments. Referral partners and commission approval/disbursement still need dedicated management endpoints and UI; commission rows remain export-only. No accounting module should be treated as production-verified until tested against a configured database and real source records.

## API

```bash
curl -X POST http://localhost:3000/api/v1/opportunity-finder/audit \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com","language":"en"}'
```

Change `language` to `es` for Spanish recommendations.

## Security and responsible use

- Scans only a single public page and public DNS records.
- Resolves and pins public IP addresses, revalidates every redirect, and blocks private, reserved, and non-standard-port targets.
- Uses a request timeout, a 3 MB HTML analysis cap, and a best-effort in-memory limit of 20 requests per minute per IP and server instance.
- Does not bypass authentication, crawl private paths, exploit vulnerabilities, or infer whether backups/monitoring exist.
- Treat scores as directional indicators, not verified facts or revenue guarantees.
- Obtain appropriate permission before using results for intrusive testing or automated outreach.

## Production next steps

1. Replace in-memory audit/login rate limits with durable rate limiting and add production observability.
2. Run audits in isolated workers with an explicit egress policy.
3. Integrate approved site-discovery and performance/accessibility providers.
4. Add consent-aware prospect workflows, audit retention controls, and a versioned scoring model.

## Public deployment

Import this repository into Vercel and deploy it as a Next.js project. To use `os.innweb.co`, add that hostname to the Vercel project and create the exact DNS record Vercel provides at the domain's DNS provider. Keep the existing `innweb.co` apex records unchanged. Set `NEXT_PUBLIC_SITE_URL=https://os.innweb.co` in the Vercel project for canonical metadata.


## Publicar en GitHub

macOS/Linux:
```bash
./publish-github.sh
```

Windows PowerShell:
```powershell
.\publish-github.ps1
```

Los scripts usan por defecto el repositorio `https://github.com/jarmelbe/innweb-os.git` y dejan la autenticación en manos de GitHub.


## Panel de Agencias

El panel está disponible en `/dashboard`. Sin PostgreSQL, muestra el estado de conexión y no presenta prospectos, ingresos ni métricas ficticias. Al conectar la base y crear la cuenta propietaria, habilita CRM, cotización, producción, tiempos y la transferencia CSV manual.
