# AGENTS.md — HDB SGI

Guía para agentes que trabajen en este repositorio.

## Stack

- Next.js 14 (App Router), React 18, TypeScript, TailwindCSS.
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

- UI en español, tono directo. Tailwind con tokens (`bg-card`, `text-muted-foreground`) y paleta slate/rose/indigo.
- Componentes de página: `'use client'`, `ModuleHeader`, `showToast` de `@/components/Toast`.
- Las rutas de API validan con Zod y devuelven `NextResponse.json`.
- Los permisos de vistas se declaran en `lib/viewAccess.ts`; no hardcodees roles en el sidebar.
- Las acciones globales del buscador se registran con `useCommandStore` (`lib/store/useCommandStore.ts`).
- No introduzcas dependencias nuevas si se puede resolver con lo instalado.

## Tickets de soporte

Existe un sistema de tickets en `/tickets` y un MCP llamado `sgi`.

Si te piden analizar o resolver un ticket:

1. Cargá el agente `sgi-ticket-fixer` o seguí su protocolo.
2. Leé `mcp/sgi-tickets/policy.json` antes de actuar.
3. No edites código si el riesgo no es bajo y el ticket no está en `listo_para_fix`.
4. Todo cambio automático debe ser ≤ 4 archivos y ≤ 150 líneas, y quedará respaldado en `.sgi-backups/`.
5. Dejá el ticket en `en_revision`; nunca lo cierres.

Documentación: `docs/sgi-tickets/`.
