# Control de accesos

Cada usuario tiene un **rol** que define sus accesos por defecto. Sobre eso se le pueden
dar **permisos especiales**: accesos puntuales que amplían o recortan lo que le da el rol,
sin cambiarle el rol ni tocar la configuración del resto.

## Cómo se resuelve un acceso

1. Si el usuario tiene un permiso especial para ese acceso, gana el permiso especial:
   `permitir` lo habilita y `denegar` lo bloquea.
2. Si no tiene, rige el rol.

Hay dos tipos de acceso:

| Tipo | Qué controla | Accesos por defecto del rol | Clave |
|---|---|---|---|
| Vista | Una pantalla del menú | `lib/viewAccess.ts`, editable en Configuración | `vista:/ventas/pdv` |
| Función | Una acción dentro de una vista | `FUNCIONES` en `lib/permisos.ts` | `funcion:ventas.anular_venta` |

## Dónde se administra

**Gestión de Usuarios → botón de la llave** en cada usuario. Lo ve quien tiene la función
"Administrar accesos" (`usuarios.accesos`, por defecto solo `admin`). Cada acceso tiene tres
estados: *Según rol*, *Permitir* o *Denegar*. Los cambios quedan en Auditoría
(`OPERATOR_PERMISOS`) y aplican cuando el usuario vuelve a la pestaña o recarga.

Nadie puede cambiar su propio permiso de administrar accesos.

## Datos

Tabla `OperatorPermiso` (`prisma/schema.prisma`): una fila por usuario y acceso, con el
efecto y quién lo otorgó. Mientras la tabla no exista en la base rigen solo los roles
y el editor avisa que no puede guardar.

## Para desarrollar

- **API**: `const acceso = await getAcceso(req); if (!acceso.puede('ventas.anular_venta')) …`
  (`lib/permisosServer.ts`). Atajo: `await puede(req, funcion)`.
- **Pantalla**: `const { puede, puedeVer } = useAcceso()` (`lib/store/useAccessStore.ts`).
- **Función nueva**: agregala a `FUNCIONES` en `lib/permisos.ts` con sus roles por defecto.
  Aparece sola en el editor.
- **Vista nueva**: se declara en `lib/viewAccess.ts`, como siempre.
- No compares roles a mano (`role === 'admin'`): un permiso especial no lo vería.

## Alcance actual

Pasan por el control de accesos:

- Menú lateral, inicio y buscador global (vistas).
- Bloqueo de una vista denegada puntualmente, también si se entra por enlace directo.
- Acceso a Punto de Venta y Auditoría de IA.
- Funciones: gestionar usuarios, administrar accesos, control horario, anular ventas,
  modificar precios, anular comprobantes de cuenta corriente y las diez acciones de
  Almacén y stock.

Todavía dependen solo del rol, y hay que migrarlos por etapas:

- Las APIs que usan `requireSGIRole` (`lib/sgiAuth.ts`): calidad (`/api/sgi`), OKR/KPI,
  datasets y diccionario de datos. Otorgar esas vistas a un rol que no las tiene muestra
  la pantalla, pero la API responde 403.
- Chequeos de rol sueltos dentro de las pantallas (botones y acciones que se muestran
  según `role`).
- Una vista que el rol no tiene, sin denegación puntual, solo se oculta del menú: no se
  bloquea la URL directa (igual que antes de este módulo).
