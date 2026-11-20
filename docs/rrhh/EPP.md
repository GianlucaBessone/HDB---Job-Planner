# Recursos Humanos — EPP (Elementos de Protección Personal)

Matriz de cobertura, catálogo y stock, entregas con firma, solicitudes de recambio y enlaces públicos para clientes.
Rutas: `/rrhh/personal/epp` (gestión), `/mis-epp` (portal del operario), `/public/epp-matriz/[token]` (matriz compartida, sin sesión).

## Seguridad (nov. 2026)

Antes todo EPP eran *server actions* (`app/rrhh/personal/epp/actions.ts`, `app/mis-epp/actions.ts`) sin control de sesión:
el middleware solo protege `/api/*`, así que cualquiera con el id de una acción podía ajustar stock, registrar entregas,
crear o revocar enlaces públicos, o leer y firmar los EPP de cualquier operario pasando su `operatorId`.

Ahora son API routes con Zod y control de accesos:

| Función (`lib/permisos.ts`) | Roles por defecto | Qué habilita |
|---|---|---|
| `rrhh.epp_ver` | admin, supervisor, qa | Matriz, catálogo, kardex, solicitudes, fichas de operarios, enlaces y clientes |
| `rrhh.epp_gestionar` | admin, supervisor, qa | Alta y edición del catálogo, ingreso y ajuste de stock, entregas, resolver solicitudes, crear y revocar enlaces |
| `rrhh.mis_epp` | operador, supervisor, admin, qa | Ver los EPP propios, firmar entregas propias y pedir recambios |

- Sin sesión: 401. Sin la función: 403.
- **Mis EPP** opera siempre sobre el usuario de la sesión; el cliente ya no envía `operatorId`. Un acta de otro operario responde 404.
- **Firma de entregas**: el servidor genera la firma con checksum (`DocumentSignatureAudit`, `lib/signature.ts`) con el nombre y DNI
  de la sesión, en la misma transacción que marca el acta. Antes el navegador pedía la firma a `/api/signatures/sign` con datos propios
  y la pasaba a la acción.
- **Responsables**: `registradoPor` (kardex), `resueltoPor`, `creadoPor` y la auditoría usan el usuario de la sesión. En una entrega,
  "Entregado por" sigue siendo editable (quien entregó físicamente) y por defecto es el usuario de la sesión; la auditoría registra
  igual quién la cargó.
- **Stock**: cantidades enteras positivas; el descuento por entrega es condicional (no deja stock negativo si dos entregas compiten)
  y el ingreso usa incremento atómico. Una solicitud ya resuelta no se puede volver a resolver.
- **Firma manuscrita**: solo se acepta una imagen `data:image/png|jpeg|webp;base64`, porque se inserta en la planilla de la Res. 299/11.

## Código

| Archivo | Qué hace |
|---|---|
| `lib/rrhh/epp.ts` | Esquemas Zod (cliente y servidor) |
| `lib/rrhh/eppSesion.ts` | `sesionEpp(req, funcion)`, `leerBody(req, schema)`, `responder(contexto, handler)` y `ErrorEpp` |
| `lib/rrhh/eppServer.ts` | Lógica (sin `'use server'`) |
| `lib/rrhh/eppCliente.ts` | Cliente `fetch` con los mismos nombres que las antiguas acciones y respuesta `{ success, data?, error? }` |

## API

| Método y ruta | Función |
|---|---|
| `GET /api/rrhh/epp/matriz` | ver |
| `GET /api/rrhh/epp/catalogo` · `POST` | ver · gestionar |
| `PATCH /api/rrhh/epp/catalogo/[id]` (con `ajusteStock` opcional) | gestionar |
| `POST /api/rrhh/epp/catalogo/[id]/stock` | gestionar |
| `GET /api/rrhh/epp/movimientos?eppItemId=` | ver |
| `POST /api/rrhh/epp/entregas` | gestionar |
| `GET /api/rrhh/epp/solicitudes` · `PATCH /api/rrhh/epp/solicitudes/[id]` | ver · gestionar |
| `GET /api/rrhh/epp/operadores/[id]` | ver |
| `GET /api/rrhh/epp/clientes` | ver |
| `GET /api/rrhh/epp/enlaces` · `POST` · `DELETE /api/rrhh/epp/enlaces/[id]` | ver · gestionar · gestionar |
| `GET /api/mis-epp` | mis_epp |
| `POST /api/mis-epp/entregas/[id]/firmar` | mis_epp |
| `POST /api/mis-epp/solicitudes` | mis_epp |
| `GET /api/public/epp-matriz/[token]` | pública (token de 32 hex, revocable) |

Respuesta: `{ data }` si sale bien; `{ error }` con 400, 401, 403, 404, 409 o 500 si no.

## Pendientes sugeridos

- La matriz pública incluye DNI, historial de entregas y la imagen de la firma manuscrita de cada operario (la usa la planilla
  Res. 299/11). Es el comportamiento previo; conviene confirmar que es lo que se quiere exponer a un cliente con el enlace.
- `/api/signatures/sign` sigue aceptando `userId`, nombre y DNI desde el cuerpo: cualquier usuario con sesión puede generar una firma
  a nombre de otro. EPP ya no lo usa, pero otros módulos sí.
- El código de acta (`EPP-ENT-AAAA-NNNN`) sale de contar las actas existentes: dos entregas simultáneas pueden chocar y una falla con 409.
