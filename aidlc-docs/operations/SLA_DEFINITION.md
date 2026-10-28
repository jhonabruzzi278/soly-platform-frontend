# SLA Definition

## Status: ⚠️ Not documented — genuinely missing, not just dispersed

No uptime target, latency target, RPO/RTO, or support-response-time commitment was found anywhere in the repo (no `SLA.md`, no mention in README/CLAUDE.md, no comment in code).

## What can be inferred as an implicit floor (not a real SLA)
- CI requires typecheck + lint + test + build to pass before merge — a *quality* gate, not an uptime commitment.
- The 14-day trial (migration `0023`) means a billing outage doesn't immediately lock out new users, giving some implicit slack, but this is a product decision, not an SLA.
- Vercel and Supabase each publish their own platform SLAs (not reproduced here — external vendor docs), which form the practical ceiling on what this app could ever promise, since it has no infrastructure outside those two vendors.

## Recommendation
If this product ever takes on a paying customer who asks for an SLA (uptime %, support response time), this needs to be defined explicitly before being promised — currently there is nothing to point to. **Pendiente validación humana / decisión del product owner.**
