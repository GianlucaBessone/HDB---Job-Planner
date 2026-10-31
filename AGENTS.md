# AGENTS.md — HDB SGI

Guía para agentes que trabajen en este repositorio.

## Stack

- Next.js 15 (App Router), React 19, TypeScript, TailwindCSS.
- Prisma 5.22 + PostgreSQL.
- Electron opcional (`electron/`).
- API routes en `app/api/**`; la autenticación pasa por `middleware.ts` y deja `x-user-id` / `x-user-role`.
- Componentes compartidos en `components/`; lógica y catálogos en `lib/`.
- En este proyecto conviven `Operator` (usuarios), `Sugerencia` (ISO 9001) y `Ticket` (soporte técnico). No los mezcles.

## Comandos

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev        # http://localhost:3333
npx tsc --noEmit
npm run lint
```

> Este repo no trae archivo de configuración de ESLint, así que `npm run lint` puede pedir setup interactivo. La verificación confiable es `npx tsc --noEmit`. No agregues configuración de lint sin pedirlo.

No ejecutes `prisma migrate`, `db push`, commits, push ni deploy sin autorización explícita.

## Convenciones

- UI en español, tono directo. La fuente de verdad visual es `docs/DESIGN_SYSTEM.md` (tokens, componentes, reglas) y `docs/BRAND_GUIDELINES.md`.
- Componentes base en `@/components/ui` (`Button`, `Input`, `Badge`, `Panel`, `Dialog`, `EmptyState`, `Tabs`…). No escribas colores, radios ni sombras sueltos: usá tokens (`bg-card`, `text-muted-foreground`, `brand-*`, `success-*`, `danger-*`).
- Componentes de página: `'use client'`, `ModuleHeader` como único `h1`, `showToast` de `@/components/Toast`. Las vistas no agregan fondo ni relleno exterior (lo pone el layout).
- Antes de un PR que toque UI: `node scripts/design-system/migrate-classes.js --dry` debe informar 0 archivos.
- Las rutas de API validan con Zod y devuelven `NextResponse.json`.
- Los permisos de vistas se declaran en `lib/viewAccess.ts`; no hardcodees roles en el sidebar.
- Las acciones globales del buscador se registran con `useCommandStore` (`lib/store/useCommandStore.ts`).
- No introduzcas dependencias nuevas si se puede resolver con lo instalado.

## Tickets de soporte

Existe un sistema de tickets en `/tickets`. Los agentes lo usan por la API HTTP `/api/agente`, con un token que genera un gestor desde el ticket ("Copiar para agente").

Si te piden resolver un ticket:

1. Leé las instrucciones del link que te pasaron (`/api/agente/instrucciones`) y seguilas.
2. Tomá el ticket antes de tocar código y trabajá en la rama `ticket/{codigo}`, nunca en `main`.
3. Escalá en vez de resolver si el cambio toca auth, permisos, esquema, dependencias, configuración o datos sensibles.
4. Registrá la solución con rama, commit y PR: el ticket queda en `en_revision`. Resolverlo y publicarlo lo hace una persona.
5. No escribas el token en archivos, commits ni logs.

Si cambiás la API de agentes (`app/api/agente/**`, `lib/ticketsAgente.ts`), actualizá también las instrucciones que publica y `docs/sgi-tickets/FLUJO-AGENTE.md`.

Documentación: `docs/sgi-tickets/`.
