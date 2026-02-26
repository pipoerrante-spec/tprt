# TPRT — Revisión técnica inteligente (Chile)

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + React Query + Supabase.

Incluye:
- Landing premium + wizard `/reservar` (servicio → comuna → calendario)
- HOLD de cupo con TTL (default 7 min) + liberación automática por expiración
- Checkout server-side + proveedor de pago `mock` E2E (con webhook local)
- Providers listos server-side: Transbank Webpay + Mercado Pago (sin llaves en frontend)
- Confirmación `/confirmacion/[id]` + email stub (console)
- Migraciones SQL listas para Supabase (`supabase/migrations`)

## Requisitos

- Node 20+
- pnpm
- Un proyecto Supabase (local o remoto)

## Setup rápido

1) Instala dependencias:

```bash
pnpm i
```

2) Crea `.env.local` desde `.env.example`:

```bash
cp .env.example .env.local
```

3) Aplica migraciones en Supabase:

- Opción A (recomendado): Supabase local con CLI
  - Inicia Postgres local (`supabase start`)
  - Ejecuta migraciones (`supabase db reset` o `supabase migration up`)
- Opción B: Supabase remoto
  - Copia/ejecuta los SQL en `supabase/migrations/` en el SQL Editor (en orden).

4) Corre el proyecto:

```bash
pnpm dev
```

## Rutas principales

- `/` landing
- `/reservar` wizard 3 pasos
- `/carrito?holdId=...` carrito con countdown
- `/checkout?holdId=...` datos + método de pago
- `/pago/mock?paymentId=...` simulador de pago local
- `/confirmacion/[id]` estado de reserva
- `/ayuda` FAQ + políticas
- `/admin` placeholder (opcional)

## Variables de entorno

Ver `.env.example`.

Notas:
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en backend (route handlers). No se expone al cliente.
- `TPRT_PAYMENTS_PROVIDER_ACTIVE=mock` habilita el flujo E2E local.
- `TPRT_MOCK_WEBHOOK_SECRET` (opcional) exige header `x-tprt-mock-secret` en `/api/webhooks/mock`.
- Emails reales: set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` y `OPERATIONS_EMAILS` (separados por coma).
- Recordatorio 24h: se encola como `notification_jobs` y se procesa vía `/api/cron/notifications` (proteger con `TPRT_CRON_SECRET`).
- Planilla: `TPRT_PLANILLA_WEBHOOK_URL` permite enviar un payload para Zapier/Make/Google Sheets al confirmar pago.
- Patente → marca/modelo/año: endpoint `/api/vehicle/lookup` (configurable con `VEHICLE_LOOKUP_PROVIDER=http` + `VEHICLE_LOOKUP_HTTP_URL`).

## Pagos (producción)

- **Webpay (Transbank)**: configura `TRANSBANK_COMMERCE_CODE`, `TRANSBANK_API_KEY`, `TRANSBANK_ENV` (`qa`/`integration`/`production`) y opcional `TRANSBANK_RETURN_SECRET`.
  - El redirect se hace vía `/pago/webpay` (POST a Webpay con `token_ws`).
  - El retorno/commit se procesa en `/api/webhooks/transbank`.
- **Mercado Pago**: configura `MERCADOPAGO_ACCESS_TOKEN`.
  - El checkout redirige a `init_point`.
  - La confirmación del pago se procesa por notificación en `/api/webhooks/mercadopago`.

## Walkthrough de pruebas manuales (obligatorias)

### 1) HOLD 7 min → expira y se libera
1. Ve a `/reservar`
2. Elige servicio y comuna
3. Selecciona una hora → redirige a `/carrito`
4. Espera 7 minutos
5. Verifica: countdown expira, botón “Pagar ahora” se deshabilita, y el slot vuelve a aparecer como disponible en `/reservar`.

### 2) HOLD → pagar → booking confirmado
1. En `/carrito`, entra a `/checkout`
2. Completa datos y elige `Mock (local)`
3. Pagar → redirige a `/pago/mock`
4. Click “Simular pago exitoso” → llama webhook y redirige a `/confirmacion/[id]`
5. Verifica: estado `Confirmada` y log de email en consola del server.

### 3) Doble usuario mismo slot → solo uno gana
1. Abre 2 ventanas/incógnito
2. En ambas, intenta seleccionar exactamente el mismo slot
3. Verifica: una obtiene hold; la otra recibe error `slot_full` (toast).

### 4) Webhook → marca `paid` y confirma booking
1. En `/pago/mock`, ejecuta “Simular pago exitoso”
2. Verifica en `/confirmacion/[id]` que el pago cambia a `paid` y booking a `confirmed`.

## Estructura de backend

- Holds y capacidad se validan a nivel DB (RPC + triggers) con advisory locks para evitar dobles reservas.
- Endpoints server-side:
  - `POST /api/holds` crea `booking_holds` con TTL
  - `POST /api/checkout/start` convierte hold → booking (pending) y crea `payments`
  - `POST /api/webhooks/mock` marca pago y confirma booking (E2E local)

## Próximos pasos sugeridos

- Implementar Webpay real (SDK oficial) dentro de `src/lib/payments/providers/transbank-webpay.ts`
- Admin UI real `/admin` + Supabase Auth + claim `app_metadata.is_admin`
- Recordatorios (cron/queue) para email/SMS/WhatsApp
