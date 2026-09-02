export interface DefaultSubAccess {
    codigo: string;
    nombre: string;
    descripcion: string;
    icon: string;
    orden: number;
}

export interface DefaultAccessModule {
    codigo: string;
    nombre: string;
    descripcion: string;
    icon: string;
    color: string;
    orden: number;
    subAccesses: DefaultSubAccess[];
}

export const DEFAULT_ACCESS_STRUCTURE: DefaultAccessModule[] = [
    {
        codigo: '1',
        nombre: 'Procesos Estratégicos y Liderazgo',
        descripcion: 'Dirección estratégica, liderazgo, gestión comercial, calidad y riesgos.',
        icon: 'Compass',
        color: 'indigo',
        orden: 1,
        subAccesses: [
            {
                codigo: '1.1',
                nombre: 'Dirección y Liderazgo',
                descripcion: 'Manual de Calidad (MQ-40-01), Política de Calidad, Actas de Revisión por la Dirección (PG-93-01) y Formularios de Control de Cambios (FC-63-01), Organigrama de responsabilidades y autoridad y Matriz de Indicadores y Objetivos de Calidad.',
                icon: 'Crown',
                orden: 1,
            },
            {
                codigo: '1.2',
                nombre: 'Gestión Comercial',
                descripcion: 'Relevamientos de obras, presupuestos y contratos, informes financieros y documentos de Administración y finanzas.',
                icon: 'TrendingUp',
                orden: 2,
            },
            {
                codigo: '1.3',
                nombre: 'Gestión de Calidad y Riesgos',
                descripcion: 'Información Documentada (PG-75-01), Auditorías Internas (PG-92-01), No Conformidades (PG-102-01) e Informes de Análisis FODA/PESTEL, Mapa de Procesos, Matriz de partes interesadas y Lista Maestra de Documentos Externos.',
                icon: 'ShieldAlert',
                orden: 3,
            },
        ],
    },
    {
        codigo: '2',
        nombre: 'Procesos Operativos (Cadena de Valor)',
        descripcion: 'Pre-venta, compras, ejecución y control técnico, entrega y postventa.',
        icon: 'Layers',
        color: 'emerald',
        orden: 2,
        subAccesses: [
            {
                codigo: '2.1',
                nombre: 'Pre-venta y Planificación Técnica',
                descripcion: 'Criterios de aceptación técnica y layouts de obras.',
                icon: 'FileSpreadsheet',
                orden: 1,
            },
            {
                codigo: '2.2',
                nombre: 'Compras y Abastecimiento',
                descripcion: 'Procedimiento de compras (PG-84-01), Lista Maestra de Proveedores Homologados (FC-84-01) y Registros de Recepción de Materiales.',
                icon: 'ShoppingCart',
                orden: 2,
            },
            {
                codigo: '2.3',
                nombre: 'Ejecución y Control Técnico',
                descripcion: 'Planificación y Control de obra (PG-81-01), Producción y provisión de servicio PG-85-01), e Instructivos Técnicos de obra.',
                icon: 'Hammer',
                orden: 3,
            },
            {
                codigo: '2.4',
                nombre: 'Entrega y Postventa',
                descripcion: 'Protocolos de medición técnica, actas de cierre y encuestas de satisfacción del cliente.',
                icon: 'CheckCircle2',
                orden: 4,
            },
        ],
    },
    {
        codigo: '3',
        nombre: 'Procesos de Apoyo',
        descripcion: 'Talento humano, SST, infraestructura, mantenimiento y metrología.',
        icon: 'LifeBuoy',
        color: 'amber',
        orden: 3,
        subAccesses: [
            {
                codigo: '3.1',
                nombre: 'Talento Humano y SST',
                descripcion: 'Perfiles de puesto, Permisos de Trabajo Seguro (PTS), registros de entrega de EPP e inducciones (FR-712-01), Matriz de competencias (FR-74-01)',
                icon: 'Users',
                orden: 1,
            },
            {
                codigo: '3.2',
                nombre: 'Infraestructura y Mantenimiento',
                descripcion: 'Procedimiento de infraestructura (PG-71-01), programas de mantenimiento de flota y herramientas.',
                icon: 'Wrench',
                orden: 2,
            },
            {
                codigo: '3.3',
                nombre: 'Equipos de Medición (Metrología)',
                descripcion: 'Historial de calibraciones y registros de trazabilidad técnica (Ax1-PG75.01)',
                icon: 'Gauge',
                orden: 3,
            },
        ],
    },
];
