alter table public.payments
  add column if not exists authorization_code text,
  add column if not exists card_last4 text,
  add column if not exists response_code integer,
  add column if not exists payment_type_code text,
  add column if not exists transbank_status text,
  add column if not exists transbank_buy_order text,
  add column if not exists transbank_session_id text,
  add column if not exists transbank_vci text,
  add column if not exists transbank_transaction_date timestamptz,
  add column if not exists gateway_response jsonb;
