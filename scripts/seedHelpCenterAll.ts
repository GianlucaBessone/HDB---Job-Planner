import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding extended Help Center Data...');

  const catOperaciones = await prisma.helpCategory.findUnique({ where: { slug: 'operaciones' } });
  const catGestion = await prisma.helpCategory.findUnique({ where: { slug: 'gestion' } });
  const catLogistica = await prisma.helpCategory.findFirst({ where: { slug: 'logistica' } });
  const catCalidad = await prisma.helpCategory.findUnique({ where: { slug: 'calidad' } });
  const catAdmin = await prisma.helpCategory.findFirst({ where: { slug: 'administracion' } });

  let adminCatId = catAdmin?.id;
  if (!adminCatId) {
    const newAdmin = await prisma.helpCategory.create({
      data: { slug: 'administracion', title: 'Administración', description: 'Configuraciones y Usuarios', iconName: 'Settings', order: 5 }
    });
    adminCatId = newAdmin.id;
  }

  let logisticaCatId = catLogistica?.id;
  if (!logisticaCatId) {
    const newLog = await prisma.helpCategory.create({
      data: { slug: 'logistica', title: 'Logística y Materiales', description: 'Inventario y herramientas', iconName: 'Package', order: 3 }
    });
    logisticaCatId = newLog.id;
  }

  const articlesToCreate = [
    // Operaciones
    { slug: 'mis-proyectos', categoryId: catOperaciones!.id, title: 'Mis Proyectos (Resp.)', description: 'Gestión de los proyectos a cargo del supervisor.', content: 'Módulo para que los supervisores vean el progreso de sus proyectos, gestionen materiales y horas.', roles: ['supervisor', 'admin'], relatedModules: ['/my-projects'] },
    { slug: 'demoras-cliente', categoryId: catOperaciones!.id, title: 'Demoras del Cliente', description: 'Registro de tiempos perdidos por causas externas.', content: 'Permite registrar cuando el operador está en pausa debido a demoras imputables al cliente.', roles: ['operador', 'supervisor'], relatedModules: ['/delays'] },

    // Gestión y Seguimiento
    { slug: 'panel-analisis', categoryId: catGestion!.id, title: 'Panel de Análisis', description: 'Métricas y KPIs del sistema.', content: 'Dashboard general con indicadores de horas, proyectos y rendimiento.', roles: ['supervisor', 'admin'], relatedModules: ['/dashboard'] },
    { slug: 'planificacion', categoryId: catGestion!.id, title: 'Planificación', description: 'Cronograma y agenda de operadores.', content: 'Permite asignar operadores a proyectos y turnos.', roles: ['supervisor', 'admin'], relatedModules: ['/planning'] },
    { slug: 'gestion-proyectos', categoryId: catGestion!.id, title: 'Gestión de Proyectos', description: 'Alta y baja de proyectos.', content: 'Administración del catálogo de proyectos, geovallas y presupuestos.', roles: ['admin'], relatedModules: ['/projects'] },
    { slug: 'ordenes-servicio', categoryId: catGestion!.id, title: 'Órdenes de Servicio', description: 'Firma y remitos de servicio.', content: 'Documentación digital con firma en campo para confirmar la prestación.', roles: ['supervisor', 'admin'], relatedModules: ['/ordenes-servicio'] },
    { slug: 'aprobaciones', categoryId: catGestion!.id, title: 'Aprobaciones', description: 'Validar horas y demoras.', content: 'Flujo de aprobación para fichadas manuales y horas extra.', roles: ['supervisor', 'admin'], relatedModules: ['/aprobaciones'] },
    { slug: 'monitoreo-fichadas', categoryId: catGestion!.id, title: 'Monitoreo de Fichadas', description: 'Control de GPS en tiempo real.', content: 'Mapa interactivo con la última ubicación de las fichadas.', roles: ['admin'], relatedModules: ['/monitoreo-fichadas'] },

    // Logística
    { slug: 'inventario-materiales', categoryId: logisticaCatId!, title: 'Inventario de Materiales', description: 'Stock de insumos.', content: 'Gestión de almacén central y depósitos.', roles: ['admin'], relatedModules: ['/inventario'] },
    { slug: 'provision-materiales', categoryId: logisticaCatId!, title: 'Provisión de Materiales', description: 'Asignación de insumos a proyectos.', content: 'Delegación y entrega de materiales a supervisores.', roles: ['supervisor', 'admin'], relatedModules: ['/provision-materiales'] },
    { slug: 'herramientas-carros', categoryId: logisticaCatId!, title: 'Herramientas y Carros', description: 'Seguimiento de activos físicos.', content: 'Préstamo y devolución de herramientas.', roles: ['operador', 'supervisor'], relatedModules: ['/herramientas'] },

    // Calidad
    { slug: 'calidad-documentacion', categoryId: catCalidad!.id, title: 'Calidad y Documentación', description: 'Repositorio ISO 9001.', content: 'Documentos controlados, versiones y lecturas obligatorias.', roles: ['admin', 'qa'], relatedModules: ['/calidad'] },
    { slug: 'formacion-integral', categoryId: catCalidad!.id, title: 'Formación Integral', description: 'Capacitaciones y exámenes.', content: 'LMS interno para asegurar la competencia del personal.', roles: ['operador', 'supervisor'], relatedModules: ['/capacitacion'] },
    { slug: 'auditoria-ia', categoryId: catCalidad!.id, title: 'Auditoría de IA', description: 'Verificaciones automáticas.', content: 'Logs de revisión de procesos ejecutados por la IA del sistema.', roles: ['admin'], relatedModules: ['/auditoria-ia'] },

    // Administración
    { slug: 'gestion-usuarios', categoryId: adminCatId!, title: 'Gestión de Usuarios', description: 'Alta de operadores.', content: 'Creación de cuentas, cambio de contraseñas y asignación de roles.', roles: ['admin'], relatedModules: ['/operators'] },
    { slug: 'gestion-clientes', categoryId: adminCatId!, title: 'Gestión de Clientes', description: 'Base de datos de clientes.', content: 'Contactos y perfiles de empresa.', roles: ['admin'], relatedModules: ['/clients'] },
    { slug: 'auditoria-sistema', categoryId: adminCatId!, title: 'Auditoría de Sistema', description: 'Trazabilidad de acciones.', content: 'Registro inmutable de quién hizo qué y cuándo.', roles: ['admin'], relatedModules: ['/auditoria'] },
    { slug: 'configuracion-sistema', categoryId: adminCatId!, title: 'Configuración', description: 'Ajustes globales.', content: 'Geovalla de empresa, variables globales y menús.', roles: ['admin'], relatedModules: ['/configuracion'] },
    { slug: 'notificaciones', categoryId: adminCatId!, title: 'Notificaciones', description: 'Alertas del sistema.', content: 'Buzón de avisos por horas extra, aprobaciones y vencimientos.', roles: ['operador', 'admin'], relatedModules: ['/notifications'] }
  ];

  for (const art of articlesToCreate) {
    const existing = await prisma.helpArticle.findUnique({ where: { slug: art.slug } });
    if (!existing) {
      await prisma.helpArticle.create({ data: { ...art, order: 99 } });
    }
  }

  console.log('Seeding extended complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
