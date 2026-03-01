# Envio Validacion Transbank

## URL del comercio

- Produccion: `https://tprt.vercel.app`
- Integracion usada para pruebas: `https://tprt-nlv39xsyj-hhs-projects-ac833934.vercel.app`

## Descripcion breve de la integracion

GVRT integra Webpay Plus mediante `transbank-sdk` en backend. La aplicacion crea la transaccion server-side, redirige a Webpay desde `/pago/webpay`, procesa el commit en `/api/webhooks/transbank` y muestra la pagina final del comercio en `/confirmacion/[id]` con orden de compra, monto, fecha de transaccion, ultimos 4 digitos, codigo de autorizacion y estado final del pago.

## Evidencia lista para adjuntar

- Logo `130x59`: [logo-gvrt-130x59.png](/Users/hh/tprt/artifacts/transbank-validation/submission/logo-gvrt-130x59.png)
- Resumen para formulario: [resumen-validacion.md](/Users/hh/tprt/artifacts/transbank-validation/submission/resumen-validacion.md)
- Casos en CSV: [casos-validacion.csv](/Users/hh/tprt/artifacts/transbank-validation/submission/casos-validacion.csv)
- ZIP listo para envio: [transbank-validacion-gvrt.zip](/Users/hh/tprt/artifacts/transbank-validation/submission/transbank-validacion-gvrt.zip)

## Casos cerrados

- Visa aprobada
- AMEX aprobada
- Redcompra aprobada
- Mastercard rechazada

## Estado tecnico

- Sitio publico con HTTPS
- Pagina final del comercio operativa
- Evidencia Transbank persistida en base
- Confirmacion del comercio corregida y desplegada en produccion
