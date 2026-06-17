-- Allow 'pending_payment' status in subscriptions.
-- Required for the direct-pay flow where /payment/create is called and the
-- subscription is held in this state until the Flow webhook confirms payment.
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY[
    'active'::text,
    'cancelled'::text,
    'expired'::text,
    'trialing'::text,
    'pending_payment'::text
  ]));
