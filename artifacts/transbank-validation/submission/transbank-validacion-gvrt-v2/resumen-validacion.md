# Validacion Webpay Plus GVRT

## Datos del comercio

- Nombre: GVRT Revision Tecnica
- URL publica: https://tprt.vercel.app
- Integracion evaluada: Webpay Plus con SDK/API
- Descripcion: integracion server-side con `transbank-sdk`, retorno a `/api/webhooks/transbank` y pagina final del comercio en `/confirmacion/[id]`.

## Archivos adjuntos

- `logo-gvrt-130x59.png`
- `22-approved-confirmation-fixed.png`
- `23-rejected-confirmation-fixed.png`
- `28-redcompra-confirmation.png`
- `32-amex-confirmation.png`
- `approved-final-db.json`
- `rejected-final-db.json`
- `redcompra-final-db.json`
- `amex-final-db.json`
- `casos-validacion.csv`

## Casos de prueba ejecutados

| Caso | Resultado | Orden de compra | Fecha transaccion | Monto | Ultimos 4 | Autorizacion | Gateway |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Visa | Aprobada | `Pc0ae8231c78a461eb5d2ae490` | `2026-03-01T23:10:32.676+00:00` | `$85.000 CLP` | `6623` | `1213` | `AUTHORIZED / 0` |
| AMEX | Aprobada | `Pd86426980c9d4610a4b383718` | `2026-03-01T23:24:06.545+00:00` | `$85.000 CLP` | `2032` | `1617` | `AUTHORIZED / 0` |
| Redcompra | Aprobada | `P2887340bc43348f191302cda9` | `2026-03-01T23:20:09.336+00:00` | `$85.000 CLP` | `7060` | `1819` | `AUTHORIZED / 0` |
| Mastercard | Rechazada | `P4fe1bd17eb624e7eb78a2277a` | `2026-03-01T23:11:50.504+00:00` | `$85.000 CLP` | `0568` | `000000` | `FAILED / -1` |

## Nota

La pagina final del comercio muestra el estado del pago directamente desde el backend del comercio, sin mostrar voucher de Transbank como pagina final.
