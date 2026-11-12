# InnWeb OS — Google Gemini assistant (private MVP)

This feature was prepared for `jarmelbe/innweb-os` (Next.js 16, existing CRM session authentication). It adds a server-only Gemini call plus a standalone page. It does **not** modify or transmit existing CRM records automatically.

## Routes

- `/dashboard/ai` — sign-in required; Spanish-language private interface.
- `POST /api/crm/ai` — sign-in required; JSON request `{ "prompt": "..." }`; returns `{ "answer": "...", "model": "..." }`.

## Deployment requirements

1. Test changes in a protected Preview/staging environment before merging or releasing to production. PR #5 was already merged on 2026-10-26; its successful Preview build does not prove a working CRM or Gemini connection.
2. The confirmed host is Vercel, team `inn-web`, project `innweb-os`. In the project's Environment Variables settings, add the newly regenerated `GEMINI_API_KEY` as **Sensitive**, initially targeting **Preview only**. Never reuse a disclosed key or put one in source control, chat, a `NEXT_PUBLIC_*` variable, a command argument or logs. Obtain the key at https://aistudio.google.com/apikey.
3. Optionally set `GEMINI_MODEL=gemini-3.8-flash` (the current server default).
4. Configure Preview `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) using an isolated PostgreSQL test database. Verify that neither points to production. Preview builds intentionally skip migrations; initialize the schema and an authorized test account separately, only after verifying the database target.
5. Run `npm ci`, `npm run db:generate`, `npm test`, `npm run lint`, `npm run build -- --webpack`.
6. Build a fresh Preview after saving environment variables; existing deployments do not inherit later changes. Sign into the protected Preview site, open `/dashboard/ai` directly and test with a non-sensitive prompt.
7. Verify real session authorization, responses, quota, timeout and Google model/key availability before production release. A same-origin browser POST must reach session validation (401 without a session), while a foreign Origin must return 403; check this on the actual Vercel Preview hostname.

## Verified configuration and remaining blockers (2026-10-26)

- The PR #5 Preview deployment built successfully. Its `/api/crm/ai` route is present (GET returns 405), but a complete signed-in Gemini request has not been verified.
- Vercel metadata initially showed only `DATABASE_URL`, `DIRECT_URL` and `INNWEB_SETUP_TOKEN`, all scoped exclusively to Production. No Preview database variables or `GEMINI_API_KEY` were configured at that inspection.
- The regenerated Gemini key was subsequently entered in Vercel by the owner. Its scope was corrected to **Preview only**, retaining type **Sensitive**, without reading or transferring the value. A later metadata check still showed no Preview database connections, so a signed-in provider call remains unverified.
- The Production build for merge commit `f5063c2874343bd3ad89addb08a63f571703d620` failed during Prisma `migrate deploy` with P1001 because its database hostname was an example placeholder. Correct production connections in the secret manager separately; do not bypass migrations or copy production credentials into Preview.
- A regenerated Google key has not been independently validated. Confirm its presence via secret metadata, without decrypting or displaying it. Test the provider only through an authorized Preview session.

## Automated regression checks

`npm test` includes the actual Gemini route with only session lookup and provider fetch replaced by test doubles. It covers missing configuration, authentication, origin checks (including Next's internal hostname differing from Host), invalid input, provider request fields, token cap, five-per-minute limits and bounded limiter capacity, sanitized errors, timeouts, and malformed or non-completed responses. These tests use synthetic data and cannot contact Google or PostgreSQL. They complement the live Preview checks above.

## Safety, privacy and limitations

- The key never reaches the browser. API only accepts authenticated CRM users.
- Each request has a 4000-character limit, a 2048-token output cap, a per-process best-effort limit of five calls/minute per user and a 25-second deadline. The limiter retains at most 5000 user/agency windows and refuses new entries until space expires; it does not evict active limits.
- Every JSON response, including authentication failures, is marked `Cache-Control: no-store`. A successful provider response must have `status: completed` and valid text in `model_output` steps. Partial, failed and malformed responses return an error instead of appearing complete.
- Only the text explicitly entered by the user is sent to Gemini. No contacts, invoices, leads, customer records or patient data are fetched by this feature.
- Calls use `store: false` for stateless Interactions API behavior. This does not replace Google's other data handling obligations or a privacy review.
- Do not enter personal, medical, financial or confidential client information until the provider's terms and your privacy practices are reviewed.
- This MVP has **no durable rate limiting**: replace with shared quota storage, usage alerts and audit metadata before multi-instance production.
- The hosting router/reverse proxy must preserve the incoming `Host` and the public request scheme. Origin validation uses that host rather than Next's potentially internal request hostname; it rejects malformed hosts and ignores `X-Forwarded-Host`/`X-Forwarded-Proto` overrides. Confirm this on the actual Preview hostname before release. Restrict the module to authorized agency roles if team-wide access isn't desired.
- No Google account, API key or real Gemini API response can be validated from GitHub alone. This is a code integration ready for secret configuration, not an active Gemini connection.

Official API documentation:
- https://ai.google.dev/gemini-api/docs/interactions-overview
- https://ai.google.dev/api/interactions-api
- https://ai.google.dev/gemini-api/docs/models
