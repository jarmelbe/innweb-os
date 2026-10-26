# InnWeb OS — Gemini private assistant MVP

Status: **code prepared for review; not live, no Google credentials configured**.

This change adds:
- A protected page at `/dashboard/ai`
- A POST endpoint at `/api/crm/ai` using the Gemini Interactions API
- No automatic access to CRM records, no CRM schema migration, and no changes to billing or existing pipelines

## Configuration (staging first)

1. Obtain a **new** Gemini API key at https://aistudio.google.com/apikey.
2. Set `GEMINI_API_KEY` as a private server-side secret in the actual InnWeb OS hosting environment. Never commit it to Git, share it in chat, or expose it through `NEXT_PUBLIC_` variables. Optionally set `GEMINI_MODEL=gemini-3.8-flash`. Confirm this model is available to your Google project.
3. Preserve existing `DATABASE_URL` and `DIRECT_URL`. Use separate, isolated staging credentials.
4. Run `npm ci && npm run db:generate && npm test && npm run lint && npm run build` and resolve any errors.
5. Deploy to staging, log in to the CRM and navigate to `/dashboard/ai`. Send a non-sensitive test prompt and confirm response and quota usage. Confirm anonymous and cross-origin requests are rejected.
6. Review before merging and deploying. Approval of a PR does not by itself mean that production is linked to this repository.

## Privacy and security

- Only the text explicitly entered into the prompt is sent to Google; the code does not query CRM customers or send CRM records.
- The API key is server-side only; it is never sent to the browser.
- `store: false` opts out of optional Gemini Interactions conversation storage; it does not override Google service processing and data-handling terms.
- Initial MVP rate limit is **5 requests/min/user+agency in process memory**, not durable across server instances. Before wider use, add shared rate limiting, budgets, logs without prompt contents, monitoring, alerts, and a written incident response.
- API inputs are limited to 2–4000 characters. Cross-origin requests are checked using the Origin header; verify proxy configuration in staging.
- This assistant only generates text and does not change CRM records. Do not paste confidential, medical, financial, or personal client data into the assistant until a compliant data protection process has been implemented.
- No secrets, client records, migrations, or deployment changes are included in this branch.

References:
- https://ai.google.dev/gemini-api/docs/interactions-overview
- https://ai.google.dev/gemini-api/docs/models
