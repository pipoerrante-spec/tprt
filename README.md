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
- Endpoint externo seguro: `TPRT_EXTERNAL_API_TOKEN` habilita `/api/integrations/notion` para lectura (`GET`) y recepción (`POST`) de payloads desde Notion/Make/Zapier.
- Patente → marca/modelo/año: endpoint `/api/vehicle/lookup` (configurable con `VEHICLE_LOOKUP_PROVIDER=http|getapi_patente`).
  - Para `getapi_patente`, usa una API key real de getapi.cl (la key demo pública devuelve `403` fuera de su web).

## Pagos (producción)

- **Webpay (Transbank)**: configura `TRANSBANK_COMMERCE_CODE`, `TRANSBANK_API_KEY`, `TRANSBANK_ENV` (`qa`/`integration`/`production`) y opcional `TRANSBANK_RETURN_SECRET`.
  - El redirect se hace vía `/pago/webpay` (POST a Webpay con `token_ws`).
  - El retorno/commit se procesa en `/api/webhooks/transbank`.
  - La ruta soporta retorno normal y abortos por `GET` y `POST`, compatible con integración y producción.
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
  - `GET/POST /api/integrations/notion` expone reservas para integraciones externas y recibe payloads tipo webhook

## Endpoint externo seguro

Configura primero:

```env
TPRT_EXTERNAL_API_TOKEN=pon-un-token-largo-y-unico
```

Autenticación:

```http
Authorization: Bearer TU_TOKEN
```

o:

```http
x-tprt-token: TU_TOKEN
```

### Consumir reservas

```bash
curl -X GET "https://tprt.vercel.app/api/integrations/notion?status=confirmed&limit=20" \
  -H "Authorization: Bearer TU_TOKEN"
```

Query params soportados:
- `bookingId`
- `status=pending_payment|confirmed|canceled`
- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`
- `limit=1..100`

Respuesta:

```json
{
  "items": [
    {
      "booking": {
        "id": "uuid",
        "status": "confirmed",
        "date": "2026-03-02",
        "time": "09:30:00",
        "customerName": "Juan Perez",
        "email": "juan@email.com",
        "phone": "+56912345678",
        "address": "Av. Ejemplo 123",
        "notes": null,
        "vehicle": {
          "plate": "ABCD12",
          "make": "Toyota",
          "model": "Yaris",
          "year": 2020
        },
        "createdAt": "2026-03-01T22:00:00.000Z"
      },
      "service": {
        "id": "uuid",
        "name": "Revisión técnica inteligente",
        "base_price": 85000
      },
      "commune": {
        "id": "uuid",
        "name": "La Reina",
        "region": "Región Metropolitana"
      },
      "payment": {
        "id": "uuid",
        "booking_id": "uuid",
        "status": "paid",
        "provider": "transbank_webpay",
        "amount_clp": 85000,
        "currency": "CLP",
        "external_ref": "token",
        "created_at": "2026-03-01T22:01:00.000Z"
      }
    }
  ],
  "count": 1
}
```

### Enviar datos desde Notion / Make / Zapier

```bash
curl -X POST "https://tprt.vercel.app/api/integrations/notion" \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "page_updated",
    "source": "notion",
    "recordType": "lead",
    "externalId": "lead-123",
    "notionPageId": "abc123",
    "bookingId": "00000000-0000-0000-0000-000000000000",
    "payload": {
      "name": "Juan Perez",
      "status": "Nuevo",
      "comment": "Llamar en la tarde"
    }
  }'
```

Respuesta:

```json
{
  "ok": true,
  "webhookId": "uuid",
  "receivedAt": "2026-03-01T22:10:00.000Z"
}
```

Los payloads entrantes quedan registrados en `public.webhooks_log` para luego procesarlos desde Supabase, Make, Zapier o una automatización propia.

## Próximos pasos sugeridos

- Completar certificación Transbank con el comercio productivo y cargar credenciales de producción en Vercel
- Admin UI real `/admin` + Supabase Auth + claim `app_metadata.is_admin`
- Recordatorios (cron/queue) para email/SMS/WhatsApp
