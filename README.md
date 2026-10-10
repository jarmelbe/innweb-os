# INNweb OS — Opportunity Finder™

A bilingual, non-invasive website audit MVP for agencies. It evaluates public page signals across performance, SEO, security, accessibility, conversion, and infrastructure, then returns recommendations and an opportunity score.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## API

```bash
curl -X POST http://localhost:3000/api/v1/opportunity-finder/audit \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com","language":"en"}'
```

Change `language` to `es` for Spanish recommendations.

## Security and responsible use

- Scans only a single public page and public DNS records.
- Blocks localhost, link-local, and private network targets to reduce SSRF risk.
- Uses timeouts and a 3 MB HTML analysis cap.
- Does not bypass authentication, crawl private paths, exploit vulnerabilities, or infer whether backups/monitoring exist.
- Treat scores as directional indicators, not verified facts or revenue guarantees.
- Obtain appropriate permission before using results for intrusive testing or automated outreach.

## Production next steps

1. Add authentication, agency tenancy, rate limits, queues, and Postgres persistence.
2. Run audits in isolated workers with egress policy and DNS rebinding protection.
3. Integrate approved performance and accessibility providers.
4. Add consent-aware prospect workflows and audit retention controls.
5. Add tests, observability, signed reports, and a versioned scoring model.


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
