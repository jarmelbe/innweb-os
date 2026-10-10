# INNweb OS — Opportunity Finder™

A bilingual, non-invasive website audit MVP for agencies. It evaluates public page signals across performance, SEO, security, accessibility, conversion, and infrastructure, then returns recommendations and an opportunity score.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The home page audits one public URL at a time. Automatic prospect discovery is not connected; sample buttons run real audits against the listed sample websites. The dashboard currently contains demonstration metrics.

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

1. Replace the in-memory request limit with durable rate limiting and add authentication and agency tenancy.
2. Run audits in isolated workers with an explicit egress policy.
3. Integrate an approved site-discovery source and performance/accessibility providers.
4. Add consent-aware prospect workflows, audit retention controls, observability, and a versioned scoring model.

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

El Agency Command Center está disponible en `/dashboard`. Incluye indicadores, pipeline, estado de infraestructura, oportunidades prioritarias y selector español/inglés. Los datos actuales son demostrativos hasta conectar PostgreSQL.
