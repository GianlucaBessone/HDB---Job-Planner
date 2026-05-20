# 📋 HDB SGI - Sistema de Gestión Integral

Sistema de planificación diaria para equipos técnicos con generación automática de mensajes de WhatsApp.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwindcss)

---

## ✨ Características

- **Planificación diaria** — Crea bloques de trabajo asignando proyectos, horarios y operadores
- **Gestión de proyectos** — CRUD completo con seguimiento de horas estimadas vs. consumidas
- **Gestión de operadores** — Alta/baja de técnicos con etiquetas de especialidad (Electricista, CCTV, etc.)
- **Disponibilidad inteligente** — Detecta conflictos de horario entre bloques automáticamente
- **Bloques favoritos** — Guarda configuraciones frecuentes para reutilizar con un clic
- **WhatsApp integrado** — Genera el mensaje formateado del cronograma diario y lo envía directo a WhatsApp
- **Copiar planificación** — Copia el cronograma de un día anterior para agilizar la carga
- **Notas libres** — Agrega bloques de texto sin asignar proyecto ni operadores
- **Diseño mobile-first** — Navegación inferior, touch targets optimizados y soporte para dispositivos con notch

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Estilos** | TailwindCSS 3, tailwindcss-animate |
| **Base de Datos** | PostgreSQL (compatible con Neon, Supabase, etc.) |
| **ORM** | Prisma 5.22 |
| **Iconos** | Lucide React |
| **Fechas** | date-fns |

---

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+
- PostgreSQL (local o servicio cloud como [Neon](https://neon.tech))

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/GianlucaBessone/HDB---Job-Planner.git
cd HDB---Job-Planner

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu connection string de PostgreSQL
```

### Configuración de la base de datos

Editar el archivo `.env` con tu connection string:

```env
DATABASE_URL="postgresql://usuario:contraseña@host:5432/nombre_db?sslmode=require"
```

Luego aplicar las migraciones:

```bash
# Generar el cliente de Prisma
npx prisma generate

# Aplicar migraciones
npx prisma migrate dev

# (Opcional) Abrir Prisma Studio para ver los datos
npx prisma studio
```

### Ejecutar en desarrollo

```bash
npm run dev
```

La app estará disponible en [http://localhost:3000](http://localhost:3000)

---

## 📁 Estructura del Proyecto

```
├── app/
│   ├── layout.tsx              # Layout principal con navegación
│   ├── page.tsx                # Página de planificación diaria
│   ├── globals.css             # Estilos globales y utilidades
│   ├── operators/
│   │   └── page.tsx            # Gestión de operadores
│   ├── projects/
│   │   └── page.tsx            # Gestión de proyectos
│   └── api/
│       ├── operators/route.ts  # API REST de operadores
│       ├── projects/route.ts   # API REST de proyectos
│       ├── planning/route.ts   # API REST de planificación
│       └── favorites/route.ts  # API REST de bloques favoritos
├── lib/
│   ├── dataLayer.ts            # Capa de acceso a datos (Prisma)
│   └── whatsappFormatter.ts    # Generador de mensajes WhatsApp
├── components/
│   └── WhatsAppPreview.tsx     # Preview del mensaje WhatsApp
├── prisma/
│   ├── schema.prisma           # Esquema de base de datos
│   └── migrations/             # Migraciones SQL
└── package.json
```

---

## 📊 Modelo de Datos

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Project    │     │   Operator   │     │   Planning    │
├─────────────┤     ├──────────────┤     ├───────────────┤
│ id           │     │ id           │     │ id            │
│ nombre       │     │ nombreCompleto│    │ fecha (unique)│
│ activo       │     │ activo       │     │ blocks (JSON) │
│ observaciones│     │ etiquetas[]  │     │ createdAt     │
│ horasEstimadas│    │ createdAt    │     └───────────────┘
│ horasConsumidas│   └──────────────┘
│ createdAt    │     ┌───────────────┐
└─────────────┘     │ FavoriteBlock │
                    ├───────────────┤
                    │ id            │
                    │ name          │
                    │ projectId     │
                    │ projectName   │
                    │ startTime     │
                    │ endTime       │
                    │ operatorIds[] │
                    │ operatorNames[]│
                    │ isNoteOnly    │
                    └───────────────┘
```

---

## 📱 Capturas

| Planificación | Proyectos | Operadores |
|:---:|:---:|:---:|
| Bloques de trabajo con horarios y operadores | Cards con progreso de horas | Cards con etiquetas de especialidad |

---

## 📄 Scripts Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo en `localhost:3000` |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Linter de código |

---

## 🤝 Contribuir

1. Fork del repositorio
2. Crear una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -m 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir un Pull Request

---

## 📝 Licencia

Este proyecto es privado y de uso interno para HDB Servicios Eléctricos.

---

Desarrollado con ☕ por [Gianluca Bessone](https://github.com/GianlucaBessone)
