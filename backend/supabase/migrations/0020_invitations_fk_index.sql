-- ============================================================================
-- Module 20: Covering index for invitations.invited_by FK
-- Fixes advisor `unindexed_foreign_keys` introduced by the invitations table.
-- ============================================================================

create index if not exists idx_invitations_invited_by on public.invitations (invited_by);
