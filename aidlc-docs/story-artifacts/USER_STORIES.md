# User Stories

Reconstructed from implemented features (see [requirements/REQUIREMENTS.md](../requirements/REQUIREMENTS.md)). No original story-writing artifact (Jira, Notion, issues) was found in the repo — these are derived, not copied from a source of truth. ⚠️ Pendiente validación humana on priority/sizing.

## Onboarding
- As a **new business owner**, I want to sign up with just my email so I can start using the CRM without friction.
- As a **new business owner**, I want a free trial so I can evaluate the product before paying.
- As a **tenant owner**, I want to invite my staff by email with a specific role so they can help manage customers/appointments without seeing billing.

## Daily CRM Use
- As a **staff member**, I want to add and look up customers quickly, including via search/pagination, so I'm not scrolling through hundreds of rows.
- As a **staff member**, I want to book and view appointments with the customer's name and assigned staff visible so I don't have to cross-reference IDs.
- As a **tenant owner**, I want to bulk-delete customers I no longer need (e.g., duplicates from a bad import) via checkbox selection.

## Migrating Existing Data
- As a **business owner switching from spreadsheets**, I want to upload my existing Excel/CSV customer and appointment list so I don't have to re-enter everything by hand.
- As a **business owner**, I want to preview the proposed column mapping before anything is written to the database, so a bad guess doesn't corrupt my data.
- As a **business owner**, I want duplicate customers/appointments to be automatically skipped on import so re-uploading the same file doesn't create duplicates.

## Reporting
- As a **tenant owner**, I want to see revenue by staff member and by service so I know what's driving income.
- As a **tenant owner**, I want a day-by-day appointment count for the last 30 days so I can spot busy/slow periods.

## Billing
- As a **tenant owner**, I want to subscribe and pay via a payment method familiar in Chile (Flow.cl) rather than a foreign card processor.
- As a **tenant owner**, I want my subscription to lapse gracefully (not silently keep charging or silently keep access) if payment fails or I cancel.

## Admin / Platform Operations
- As the **platform operator**, I want errors in production to reach me automatically (Sentry) instead of relying on user bug reports.
- As the **platform operator**, I want a way to manually verify error reporting works in a given deployment (Sentry test button in Settings).
