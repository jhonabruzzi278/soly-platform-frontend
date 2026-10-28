# Stakeholders

## Extracted from repo evidence

| Stakeholder | Evidence | Confidence |
|---|---|---|
| Product owner / sole developer | Single git author across all 75 commits (`JONAHBRUZZI <jon.guerra@duocuc.cl>`), single personal GitHub remote (`jhonabruzzi278/soly-platform-frontend`) | High |
| End users: business owners (barbershops, spas, salons) | `owner`/`admin` roles in `memberships` table; billing/settings pages scoped to tenant owners | High |
| End users: staff / team members | `member`/`viewer` roles; `invite-member` Edge Function sends invitation emails | High |
| Flow.cl (payment processor, third party) | Full API client (`backend/supabase/functions/_shared/flow.ts`) built against Flow's OpenAPI spec; webhook handler `flow-webhook` | High |
| Supabase (infrastructure provider) | Entire backend (DB, Auth, Storage, Edge Functions, Realtime channel not yet used) | High |
| Vercel (hosting provider) | `frontend/vercel.json`, CI build step, `api/flow-return.js` deployed as a Vercel Serverless Function | High |
| Sentry (observability vendor) | `@sentry/react` dependency, `VITE_SENTRY_DSN` env var, CSP `connect-src` allowlists Sentry ingest | High |

## Not documented — pending validation

- ⚠️ No named external stakeholders (investors, advisory board, beta customers) appear anywhere in the repo.
- ⚠️ No support/success team — no helpdesk integration, no ticketing system reference found.
- ⚠️ Relationship to the "Logify" product (see [00_PROJECT_METADATA.md](../00_PROJECT_METADATA.md)) is unclear — same owner, same schema lineage, unknown whether it's a sibling product, white-label variant, or predecessor. **Requires product owner clarification.**

**Assumption for this audit:** treated as a solo-founder / small-team project with no external stakeholders beyond vendors, based on the single-author git history and absence of any collaboration artifacts (no CODEOWNERS, no issue templates, no PR review requirements beyond the one merged PR `#1`).
