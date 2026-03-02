const { test, expect } = require("playwright/test");
const { createClient } = require("@supabase/supabase-js");

const BASE_URL = process.env.TBK_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function buildEmail(label) {
  return `qa-${label}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.com`;
}

function buildTestIp() {
  return `10.0.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
}

async function getAvailableSlots(request) {
  const servicesRes = await request.get(`${BASE_URL}/api/catalog/services`);
  expect(servicesRes.ok()).toBeTruthy();
  const servicesJson = await servicesRes.json();
  const serviceId = servicesJson.services?.[0]?.id;
  expect(serviceId).toBeTruthy();

  const communesRes = await request.get(`${BASE_URL}/api/catalog/communes?serviceId=${serviceId}`);
  expect(communesRes.ok()).toBeTruthy();
  const communesJson = await communesRes.json();
  const communeId = communesJson.communes?.[0]?.id;
  expect(communeId).toBeTruthy();

  const now = new Date();
  const dateFrom = now.toISOString().slice(0, 10);
  const dateTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const availabilityRes = await request.get(
    `${BASE_URL}/api/availability?serviceId=${serviceId}&communeId=${communeId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
  );
  expect(availabilityRes.ok()).toBeTruthy();
  const availabilityJson = await availabilityRes.json();
  const slots = (availabilityJson.slots ?? []).filter((item) => item.available === true && (item.remaining ?? 0) > 0);
  expect(slots.length).toBeGreaterThan(0);

  return { serviceId, communeId, slots };
}

async function createCheckout(request, label) {
  const { serviceId, communeId, slots } = await getAvailableSlots(request);
  const testIp = buildTestIp();

  for (const slot of slots.slice(0, 5)) {
    const holdRes = await request.post(`${BASE_URL}/api/holds`, {
      headers: {
        "x-real-ip": testIp,
      },
      data: {
        serviceId,
        communeId,
        date: slot.date,
        time: slot.time,
      },
    });
    if (holdRes.status() !== 201) {
      continue;
    }

    const holdJson = await holdRes.json();
    const holdId = holdJson.holdId;
    if (!holdId) {
      continue;
    }

    const checkoutRes = await request.post(`${BASE_URL}/api/checkout/start`, {
      headers: {
        "x-real-ip": testIp,
      },
      data: {
        holdId,
        customerName: `QA ${label}`,
        email: buildEmail(label),
        phone: "912345678",
        vehiclePlate: "SBGY61",
        vehicleMake: "OPEL",
        vehicleModel: "CORSA",
        vehicleYear: 2022,
        address: "Calle QA 123",
        notes: null,
        couponCode: null,
        provider: "transbank_webpay",
      },
    });
    if (!checkoutRes.ok()) {
      continue;
    }

    const checkoutJson = await checkoutRes.json();
    const redirectUrl = checkoutJson.redirectUrl;
    expect(redirectUrl).toContain("/pago/webpay");
    const absoluteRedirectUrl = new URL(redirectUrl, BASE_URL).toString();
    const tokenWs = new URL(absoluteRedirectUrl).searchParams.get("token_ws");
    expect(tokenWs).toBeTruthy();

    return { absoluteRedirectUrl, tokenWs };
  }

  throw new Error("unable_to_create_checkout");
}

async function loginBank(page) {
  await page.waitForURL(/authenticator\.cgi/, { timeout: 30_000 });
  await page.locator("#rutClient").fill("11.111.111-1");
  await page.locator("#passwordClient").fill("123");
  await page.getByRole("button", { name: "Aceptar" }).click();
}

async function acceptBankDecision(page) {
  await page.waitForURL(/authenticatorProcess\.cgi/, { timeout: 30_000 });
  const select = page.locator("#vci");
  if (await select.count()) {
    await select.selectOption({ label: "Aceptar" });
  }
  await page.getByRole("button", { name: "Continuar" }).click();
}

async function openCardForm(page) {
  await page.waitForURL(/webpay3gint\.transbank\.cl\/webpayserver\/dist/, { timeout: 30_000 });
  await page.getByRole("button", { name: /Tarjetas/ }).click();
  await expect(page.locator("#card-number")).toBeVisible({ timeout: 30_000 });
}

async function continueAfterCardNumber(page, cardNumber) {
  await page.locator("#card-number").fill(cardNumber);
  await page.getByRole("button", { name: "Continuar" }).click();
}

async function findPaymentByExternalRef(externalRef) {
  const result = await supabase
    .from("payments")
    .select(
      "id,booking_id,status,external_ref,response_code,payment_type_code,transbank_status,transbank_buy_order,transbank_session_id,authorization_code,card_last4,created_at",
    )
    .eq("provider", "transbank_webpay")
    .eq("external_ref", externalRef)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data;
}

test.describe.serial("generate missing transbank evidence", () => {
  test("credit no installments approved", async ({ page, request }) => {
    test.setTimeout(120_000);
    const { absoluteRedirectUrl, tokenWs } = await createCheckout(request, "credit-no-installments-approved");

    await page.goto(absoluteRedirectUrl);
    await openCardForm(page);
    await continueAfterCardNumber(page, "4051885600446623");
    await page.locator("#card-exp").fill("12/30");
    await page.locator("#card-cvv").fill("123");
    await page.getByRole("button", { name: "Pagar" }).click();

    await loginBank(page);
    await acceptBankDecision(page);
    await page.waitForURL(/\/confirmacion\//, { timeout: 30_000 });

    await expect.poll(async () => findPaymentByExternalRef(tokenWs), { timeout: 30_000 }).toBeTruthy();
    const payment = await findPaymentByExternalRef(tokenWs);
    expect(payment.status).toBe("paid");
    expect(payment.transbank_status).toBe("AUTHORIZED");
    expect(payment.payment_type_code).toBe("VN");

    console.log(
      JSON.stringify({
        case: "credit_no_installments_approved",
        token_ws: tokenWs,
        payment_type_code: payment.payment_type_code,
        buy_order: payment.transbank_buy_order,
        payment_id: payment.id,
      }),
    );
  });

  test("credit no installments rejected", async ({ page, request }) => {
    test.setTimeout(120_000);
    const { absoluteRedirectUrl, tokenWs } = await createCheckout(request, "credit-no-installments-rejected");

    await page.goto(absoluteRedirectUrl);
    await openCardForm(page);
    await continueAfterCardNumber(page, "5186059559590568");
    await page.locator("#card-exp").fill("12/30");
    await page.locator("#card-cvv").fill("123");
    await page.getByRole("button", { name: "Pagar" }).click();

    await loginBank(page);
    await acceptBankDecision(page);
    await page.waitForURL(/\/confirmacion\//, { timeout: 30_000 });

    await expect.poll(async () => findPaymentByExternalRef(tokenWs), { timeout: 30_000 }).toBeTruthy();
    const payment = await findPaymentByExternalRef(tokenWs);
    expect(payment.status).toBe("failed");
    expect(payment.payment_type_code).toBe("VN");

    console.log(
      JSON.stringify({
        case: "credit_no_installments_rejected",
        token_ws: tokenWs,
        payment_type_code: payment.payment_type_code,
        buy_order: payment.transbank_buy_order,
        payment_id: payment.id,
      }),
    );
  });

  test("credit with installments approved", async ({ page, request }) => {
    test.setTimeout(120_000);
    const { absoluteRedirectUrl, tokenWs } = await createCheckout(request, "credit-installments-approved");

    await page.goto(absoluteRedirectUrl);
    await openCardForm(page);
    await continueAfterCardNumber(page, "4051885600446623");
    await page.locator("#card-exp").fill("12/30");
    await page.locator("#card-cvv").fill("123");
    await page.locator("#botonlistacuotas0").click();
    await page.getByRole("button", { name: "3 cuotas" }).click();
    await page.getByRole("button", { name: "Pagar" }).click();

    await loginBank(page);
    await acceptBankDecision(page);
    await page.waitForURL(/\/confirmacion\//, { timeout: 30_000 });

    await expect.poll(async () => findPaymentByExternalRef(tokenWs), { timeout: 30_000 }).toBeTruthy();
    const payment = await findPaymentByExternalRef(tokenWs);
    expect(payment.status).toBe("paid");
    expect(payment.transbank_status).toBe("AUTHORIZED");
    expect(payment.payment_type_code).not.toBe("VN");

    console.log(
      JSON.stringify({
        case: "credit_with_installments_approved",
        token_ws: tokenWs,
        payment_type_code: payment.payment_type_code,
        buy_order: payment.transbank_buy_order,
        payment_id: payment.id,
      }),
    );
  });

  test("debit rejected", async ({ page, request }) => {
    test.setTimeout(120_000);
    const { absoluteRedirectUrl, tokenWs } = await createCheckout(request, "debit-rejected");

    await page.goto(absoluteRedirectUrl);
    await openCardForm(page);
    await continueAfterCardNumber(page, "5186008541233829");
    await page.getByRole("button", { name: "Pagar" }).click();

    await loginBank(page);
    await acceptBankDecision(page);
    await page.waitForURL(/\/confirmacion\//, { timeout: 30_000 });

    await expect.poll(async () => findPaymentByExternalRef(tokenWs), { timeout: 30_000 }).toBeTruthy();
    const payment = await findPaymentByExternalRef(tokenWs);
    expect(payment.status).toBe("failed");
    expect(payment.payment_type_code).toBe("VD");

    console.log(
      JSON.stringify({
        case: "debit_rejected",
        token_ws: tokenWs,
        payment_type_code: payment.payment_type_code,
        buy_order: payment.transbank_buy_order,
        payment_id: payment.id,
      }),
    );
  });

  test("debit approved", async ({ page, request }) => {
    test.setTimeout(120_000);
    const { absoluteRedirectUrl, tokenWs } = await createCheckout(request, "debit-approved");

    await page.goto(absoluteRedirectUrl);
    await openCardForm(page);
    await continueAfterCardNumber(page, "4511346660037060");
    await page.getByRole("button", { name: "Pagar" }).click();

    await loginBank(page);
    await acceptBankDecision(page);
    await page.waitForURL(/\/confirmacion\//, { timeout: 30_000 });

    await expect.poll(async () => findPaymentByExternalRef(tokenWs), { timeout: 30_000 }).toBeTruthy();
    const payment = await findPaymentByExternalRef(tokenWs);
    expect(payment.status).toBe("paid");
    expect(payment.transbank_status).toBe("AUTHORIZED");
    expect(payment.payment_type_code).toBe("VD");

    console.log(
      JSON.stringify({
        case: "debit_approved",
        token_ws: tokenWs,
        payment_type_code: payment.payment_type_code,
        buy_order: payment.transbank_buy_order,
        payment_id: payment.id,
      }),
    );
  });

  test("canceled on webpay form", async ({ page, request }) => {
    test.setTimeout(120_000);
    const { absoluteRedirectUrl } = await createCheckout(request, "canceled");
    let canceledRequest = null;

    page.on("request", async (req) => {
      if (!req.url().includes("/api/webhooks/transbank")) return;
      if (req.method() === "GET") {
        const url = new URL(req.url());
        canceledRequest = {
          tbkToken: url.searchParams.get("TBK_TOKEN"),
          tbkOrder: url.searchParams.get("TBK_ORDEN_COMPRA"),
          tbkSession: url.searchParams.get("TBK_ID_SESION"),
        };
        return;
      }
      const body = req.postData() || "";
      const params = new URLSearchParams(body);
      canceledRequest = {
        tbkToken: params.get("TBK_TOKEN"),
        tbkOrder: params.get("TBK_ORDEN_COMPRA"),
        tbkSession: params.get("TBK_ID_SESION"),
      };
    });

    await page.goto(absoluteRedirectUrl);
    await openCardForm(page);
    await page.getByRole("button", { name: "Anular compra y volver" }).click();
    await page.waitForURL(/\/(confirmacion|ayuda)/, { timeout: 30_000 });

    await expect.poll(() => canceledRequest, { timeout: 30_000 }).toBeTruthy();
    expect(canceledRequest.tbkToken).toBeTruthy();

    await expect.poll(async () => findPaymentByExternalRef(canceledRequest.tbkToken), { timeout: 30_000 }).toBeTruthy();
    const payment = await findPaymentByExternalRef(canceledRequest.tbkToken);
    expect(payment.status).toBe("failed");
    expect(payment.transbank_status).toBe("ABORTED");

    console.log(
      JSON.stringify({
        case: "canceled",
        tbk_token: canceledRequest.tbkToken,
        buy_order: canceledRequest.tbkOrder,
        session_id: canceledRequest.tbkSession,
        payment_id: payment.id,
      }),
    );
  });
});
