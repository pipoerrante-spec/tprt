# Checklist Transbank

Estado actual del proyecto:

- Integración Webpay Plus implementada con `transbank-sdk`.
- Creación de transacción server-side.
- Redirección a Webpay vía `/pago/webpay`.
- Commit del pago en `/api/webhooks/transbank`.
- Retorno normal y abortos soportados por `GET` y `POST`.
- Confirmación del pago y actualización de booking/pagos en Supabase.

## Pendientes externos al código

Se necesita del cliente o de Transbank:

- Código de comercio productivo.
- API Key Secret productiva, entregada por Transbank después de validación.
- Logo del comercio en formato base para exportar a `PNG` o `GIF` `130x59`.
- Dominio final público con `HTTPS`.
- Evidencias de pruebas solicitadas por Transbank.

## Variables de entorno para producción

En Vercel, al pasar a producción real:

- `TPRT_PAYMENTS_PROVIDER_ACTIVE=transbank_webpay`
- `TRANSBANK_ENV=production`
- `TRANSBANK_COMMERCE_CODE=<codigo_productivo>`
- `TRANSBANK_API_KEY=<api_key_secret_productiva>`
- `TRANSBANK_RETURN_SECRET=<secret_interno_opcional>`

## Casos que deben probarse antes de enviar validación

- Pago aprobado.
- Pago rechazado.
- Abandono antes de pagar.
- Timeout de sesión.
- Retorno sin `token_ws`.
- Confirmación correcta en `/confirmacion/[id]`.
- Estado `paid` en `payments`.
- Estado `confirmed` en `bookings`.

## Flujo operativo sugerido

1. Confirmar código de comercio productivo del cliente.
2. Preparar logo `130x59`.
3. Usar dominio final con `HTTPS`.
4. Probar flujo completo en integración.
5. Enviar evidencias a Transbank.
6. Recibir API Key Secret productiva.
7. Cargar variables de producción en Vercel.
8. Ejecutar prueba real en producción.

## Referencias oficiales

- https://www.transbankdevelopers.cl/documentacion/como_empezar
- https://www.transbankdevelopers.cl/documentacion/webpay-plus
- https://www.transbankdevelopers.cl/referencia/webpay
