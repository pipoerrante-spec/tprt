# Validación Transbank

## Estado actual del proyecto

- Integración Webpay Plus implementada con `transbank-sdk`.
- Creación de transacción server-side.
- Redirección a Webpay vía `/pago/webpay`.
- Commit del pago en `/api/webhooks/transbank`.
- Retorno normal y abortos soportados por `GET` y `POST`.
- Confirmación del pago y actualización de `bookings`/`payments` en Supabase.
- Persistencia de evidencia Transbank en `payments`:
  - `transbank_buy_order`
  - `authorization_code`
  - `card_last4`
  - `response_code`
  - `payment_type_code`
  - `transbank_status`
  - `transbank_transaction_date`
  - `gateway_response`
- Página de resultado del comercio en `/confirmacion/[id]` con datos visibles de la transacción.

## Referencias oficiales

- Cómo empezar y validar integración: https://www.transbankdevelopers.cl/documentacion/como_empezar
- Webpay Plus: https://transbankdevelopers.cl/documentacion/webpay-plus
- Referencia API y ambientes: https://www.transbankdevelopers.cl/referencia

## Lo que Transbank exige sí o sí

- Sitio público con `HTTPS`.
- Flujo completo del comercio, sin mostrar voucher de Transbank como página final.
- Validación por formulario online desde Transbank Developers para Webpay Plus con SDK/API.
- Logo del comercio en `PNG` o `GIF` `130x59`.
- Evidencias consistentes con lo registrado por Webpay.

## Variables de entorno

### Integración

- `TPRT_PAYMENTS_PROVIDER_ACTIVE=transbank_webpay`
- `TRANSBANK_ENV=integration`
- `TRANSBANK_COMMERCE_CODE=<codigo_integracion>`
- `TRANSBANK_API_KEY=<api_key_secret_integracion>`
- `TRANSBANK_RETURN_SECRET=<secreto_interno_opcional>`

### Producción

- `TPRT_PAYMENTS_PROVIDER_ACTIVE=transbank_webpay`
- `TRANSBANK_ENV=production`
- `TRANSBANK_COMMERCE_CODE=<codigo_productivo>`
- `TRANSBANK_API_KEY=<api_key_secret_productiva>`
- `TRANSBANK_RETURN_SECRET=<secreto_interno_opcional>`

## Casos que deben ejecutarse y guardar

### Aprobadas

- Visa aprobada.
- Amex aprobada.
- Redcompra aprobada.
- Distintos montos.

### Rechazadas o abortadas

- Mastercard rechazada.
- Redcompra rechazada.
- Abandono antes del pago.
- Timeout o retorno sin `token_ws`.

## Evidencias mínimas a entregar

Por cada caso:

- Orden de compra (`transbank_buy_order` o ID interno asociado).
- Fecha y hora.
- Monto.
- Tipo de tarjeta.
- Últimos 4 dígitos.
- Resultado.
- Token o referencia externa.
- Código de autorización si aplica.
- Captura de la página final del comercio.

Archivos adicionales:

- Logo `130x59`.
- URL pública del sitio.
- Breve descripción de la integración.

## Qué ya puedes extraer del sistema

Desde `payments` quedan guardados:

- Estado del pago.
- Monto.
- Referencia externa.
- Orden de compra.
- Código de autorización.
- Últimos 4 dígitos.
- Código de respuesta.
- Estado devuelto por Transbank.
- Fecha de transacción.

Desde `/confirmacion/[id]` se muestra al usuario:

- Estado del pago.
- Monto.
- Fecha de transacción.
- Orden de compra.
- Código de autorización.
- Últimos 4 dígitos.

## Generar evidencia desde base

Con `.env.local` cargado:

```bash
set -a && source .env.local && node scripts/transbank-validation-report.mjs
```

Opcional:

```bash
set -a && source .env.local && node scripts/transbank-validation-report.mjs > transbank-validation-report.json
```

## Brechas reales que aún dependen de operación

- Ejecutar la matriz completa en ambiente de integración con tarjetas de prueba.
- Tomar capturas finales de:
  - pago aprobado
  - pago rechazado
  - abortado/timeout
- Preparar logo `130x59`.
- Completar y enviar el formulario de validación de Transbank Developers.
- Si hoy `tprt.vercel.app` está en `TRANSBANK_ENV=production`, no mezclar esas pruebas con comercio real.

## Recomendación operativa

1. Dejar un entorno de integración aislado con credenciales de integración.
2. Ejecutar la matriz completa de tarjetas y montos.
3. Exportar `transbank-validation-report.json`.
4. Adjuntar capturas + logo + URL en el formulario de validación.
5. Tras aprobación, mantener producción con credenciales productivas y hacer la transacción real final exigida por Transbank.
