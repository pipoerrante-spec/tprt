#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const paymentsResult = await supabase
  .from("payments")
  .select(
    "id,booking_id,status,provider,amount_clp,currency,external_ref,authorization_code,card_last4,response_code,payment_type_code,transbank_status,transbank_buy_order,transbank_session_id,transbank_vci,transbank_transaction_date,created_at",
  )
  .eq("provider", "transbank_webpay")
  .order("created_at", { ascending: false })
  .limit(100);

if (paymentsResult.error) {
  console.error(paymentsResult.error);
  process.exit(1);
}

const paymentRows = paymentsResult.data ?? [];
const bookingIds = paymentRows.map((row) => row.booking_id);

const bookingsResult = bookingIds.length
  ? await supabase
      .from("bookings")
      .select("id,status,date,time,customer_name,email,service_id,commune_id")
      .in("id", bookingIds)
  : { data: [], error: null };

if (bookingsResult.error) {
  console.error(bookingsResult.error);
  process.exit(1);
}

const serviceIds = [...new Set((bookingsResult.data ?? []).map((row) => row.service_id))];
const communeIds = [...new Set((bookingsResult.data ?? []).map((row) => row.commune_id))];

const servicesResult = serviceIds.length
  ? await supabase.from("services").select("id,name").in("id", serviceIds)
  : { data: [], error: null };
const communesResult = communeIds.length
  ? await supabase.from("communes").select("id,name,region").in("id", communeIds)
  : { data: [], error: null };

if (servicesResult.error || communesResult.error) {
  console.error(servicesResult.error || communesResult.error);
  process.exit(1);
}

const bookingMap = new Map((bookingsResult.data ?? []).map((row) => [row.id, row]));
const serviceMap = new Map((servicesResult.data ?? []).map((row) => [row.id, row]));
const communeMap = new Map((communesResult.data ?? []).map((row) => [row.id, row]));

const report = paymentRows.map((payment) => {
  const booking = bookingMap.get(payment.booking_id) ?? null;
  const service = booking ? serviceMap.get(booking.service_id) ?? null : null;
  const commune = booking ? communeMap.get(booking.commune_id) ?? null : null;

  return {
    order: payment.transbank_buy_order ?? payment.id,
    paymentId: payment.id,
    bookingId: payment.booking_id,
    createdAt: payment.transbank_transaction_date ?? payment.created_at,
    amountClp: payment.amount_clp,
    status: payment.status,
    gatewayStatus: payment.transbank_status,
    responseCode: payment.response_code,
    authorizationCode: payment.authorization_code,
    cardLast4: payment.card_last4,
    paymentTypeCode: payment.payment_type_code,
    externalRef: payment.external_ref,
    customerName: booking?.customer_name ?? null,
    customerEmail: booking?.email ?? null,
    bookingDate: booking?.date ?? null,
    bookingTime: booking?.time ?? null,
    bookingStatus: booking?.status ?? null,
    service: service?.name ?? null,
    commune: commune?.name ?? null,
    region: commune?.region ?? null,
  };
});

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), count: report.length, items: report }, null, 2));
