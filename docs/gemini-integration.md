# InnWeb OS — Google Gemini assistant (private MVP)

This feature was prepared for `jarmelbe/innweb-os` (Next.js 16, existing CRM session authentication). It adds a server-only Gemini call plus a standalone page. It does **not** modify or transmit existing CRM records automatically.

## Routes

- `/dashboard/ai` — sign-in required; Spanish-language private interface.
- `POST /api/crm/ai` — sign-in required; JSON request `{ "prompt": "..." }`; returns `{ "answer": "...", "model": "..." }`.

## Deployment requirements

1. Review and merge the pull request only after testing in a private Preview/staging environment.
2. Add `GEMINI_API_KEY` as a **server-side secret** in the actual InnWeb OS deployment platform, never in source control, chat or client-side environment variables. Obtain the key at https://aistudio.google.com/apikey.
3. Optionally set `GEMINI_MODEL=gemini-3.8-flash` (the current server default).
4. Configure the existing CRM `DATABASE_URL` and `DIRECT_URL`, and ensure initial owner setup is complete.
5. Run `npm ci`, `npm run db:generate`, `npm test`, `npm run lint`, `npm run build`.
6. Sign into the private Preview site, open `/dashboard/ai` directly and test with a non-sensitive prompt.
7. Verify responses, authorization failures, quota and model availability before production release.

## Safety, privacy and limitations

- The key never reaches the browser. API only accepts authenticated CRM users.
- Each request has a 4000-character limit, a per-process best-effort limit of five calls/minute per user and a 25-second deadline.
- Only the text explicitly entered by the user is sent to Gemini. No contacts, invoices, leads, customer records or patient data are fetched by this feature.
- Calls use `store: false` for stateless Interactions API behavior. This does not replace Google's other data handling obligations or a privacy review.
- Do not enter personal, medical, financial or confidential client information until the provider's terms and your privacy practices are reviewed.
- This MVP has **no durable rate limiting**: replace with shared quota storage, usage alerts and audit metadata before multi-instance production.
- The cross-origin check should be tested behind the production reverse proxy. Restrict the module to authorized agency roles if team-wide access isn't desired.
- No Google account, API key or real Gemini API response can be validated from GitHub alone. This is a code integration ready for secret configuration, not an active Gemini connection.

Official API documentation:
- https://ai.google.dev/gemini-api/docs/interactions-overview
- https://ai.google.dev/api/interactions-api
- https://ai.google.dev/gemini-api/docs/models
