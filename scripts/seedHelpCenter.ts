import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Help Center Data...');

  // Delete existing to avoid duplicates if re-run
  await prisma.helpFaq.deleteMany();
  await prisma.helpTag.deleteMany();
  await prisma.helpArticle.deleteMany();
  await prisma.helpCategory.deleteMany();

  // CATEGORIES
  const catOperaciones = await prisma.helpCategory.create({
    data: {
      slug: 'operaciones',
      title: 'Operaciones en Terreno',
      description: 'Guías para el trabajo en campo, registro de tiempos y control de ausencias.',
      iconName: 'Wrench',
      order: 1
    }
  });

  const catGestion = await prisma.helpCategory.create({
    data: {
      slug: 'gestion',
      title: 'Gestión y Seguimiento',
      description: 'Documentación sobre planificación, control de proyectos y métricas.',
      iconName: 'LayoutGrid',
      order: 2
    }
  });

  const catCalidad = await prisma.helpCategory.create({
    data: {
      slug: 'calidad',
      title: 'Calidad y Mejora Continua',
      description: 'Gestión ISO 9001, lectura de documentos, sugerencias y auditorías.',
      iconName: 'FileCheck',
      order: 3
    }
  });

  // ARTICLES

  // 1. Fichado
  await prisma.helpArticle.create({
    data: {
      slug: 'fichado-gps-qr',
      categoryId: catOperaciones.id,
      title: 'Fichado (GPS y QR)',
      description: 'Cómo registrar su ingreso y egreso en proyectos mediante geolocalización o código QR.',
      content: `El módulo de Fichado permite a los operadores registrar el inicio y fin de su jornada laboral, validando su ubicación mediante GPS o el escaneo de un código QR específico del proyecto.

### Proceso de Fichado
1. Seleccione el tipo de fichado: Ingreso o Egreso.
2. Si el proyecto requiere QR, presione **Escanear QR** y apunte la cámara al código proporcionado por el supervisor.
3. Si el proyecto requiere GPS, la aplicación validará que se encuentre dentro del radio permitido.
4. Presione **Confirmar Fichada**.

### Modo Offline
Si no tiene conexión a internet, la fichada se guardará localmente (Modo Offline) y se sincronizará automáticamente cuando recupere la conexión. Las fichadas offline se marcan como pendientes de validación.`,
      objetivo: 'Garantizar el registro preciso de asistencia y ubicación del personal en tiempo real.',
      comoAcceder: 'Desde el menú principal, seleccione "Fichado (GPS/QR)".',
      buenasPracticas: '- Asegúrese de tener el GPS encendido antes de abrir la aplicación.\n- Fiche su egreso al finalizar la jornada para evitar inconsistencias.',
      roles: ['operador', 'supervisor'],
      relatedModules: ['/fichado'],
      order: 1,
      faqs: {
        create: [
          { question: '¿Qué pasa si me olvido de fichar el egreso?', answer: 'El sistema marcará la fichada como incompleta y el supervisor deberá ajustarla manualmente en el Registro de Tiempos.' },
          { question: '¿Por qué me dice "Fichada Sospechosa"?', answer: 'Esto ocurre si su ubicación GPS está fuera del radio permitido del proyecto, o si el código QR escaneado no coincide con el del proyecto actual.' }
        ]
      }
    }
  });

  // 2. Registro de Tiempos
  await prisma.helpArticle.create({
    data: {
      slug: 'registro-tiempos-ausencias',
      categoryId: catOperaciones.id,
      title: 'Registro de Tiempos y Ausencias',
      description: 'Administración de horas trabajadas, ausencias justificadas y horas extra.',
      content: `El Registro de Tiempos permite llevar el control detallado de las horas trabajadas en cada proyecto o las ausencias del personal.

### Carga de Tiempos
1. Seleccione el proyecto y el operador.
2. Ingrese la Fecha, Hora de Ingreso y Hora de Egreso.
3. El sistema calculará automáticamente las horas trabajadas.

### Registro de Ausencias
Para registrar una ausencia (Carpeta Médica, Falta, Permiso, Administrativo):
1. Seleccione el tipo "Causa/Ausencia".
2. Al hacerlo, las horas se configurarán automáticamente en el rango estándar (ej. 08:00 a 17:00).
3. Si selecciona "Administrativo", deberá proveer una descripción detallada.

### Horas Extra
Si se superan las horas estándar de la jornada, marque la casilla "Hora Extra".`,
      objetivo: 'Centralizar el registro de horas consumidas por proyecto y justificar ausencias del personal.',
      comoAcceder: 'Vaya a la sección "Operaciones" en el menú lateral y haga clic en "Registro de Tiempos".',
      buenasPracticas: '- Revise las horas cargadas diariamente.\n- Los supervisores deben validar las horas extra antes de que finalice la semana.',
      roles: ['operador', 'supervisor', 'admin', 'qa'],
      relatedModules: ['/timesheets'],
      order: 2
    }
  });

  // 3. Gestión de Sugerencias
  await prisma.helpArticle.create({
    data: {
      slug: 'gestion-sugerencias-reclamos',
      categoryId: catCalidad.id,
      title: 'Gestión de Sugerencias y Reclamos',
      description: 'Portal para registrar ideas de mejora, sugerencias y reclamos según la norma ISO 9001.',
      content: `La Gestión de Sugerencias es el buzón digital donde cualquier usuario puede aportar ideas de mejora o notificar reclamos, manteniendo un ciclo de vida controlado por el equipo de QA.

### Cómo registrar una Sugerencia
1. Puede hacerlo de manera anónima o identificada.
2. Seleccione la categoría: Idea de Mejora, Sugerencia o Reclamo.
3. Escriba el detalle y adjunte evidencia fotográfica si aplica.
4. Presione Enviar.

### Ciclo de vida (QA)
- **Pendiente**: Recién creada.
- **En Progreso**: Asignada a un responsable para su análisis.
- **Completada**: Acciones aplicadas.
- **Cancelada**: Desestimada con justificación.

Las sugerencias aprobadas pueden derivar en una "Acción Correctiva".`,
      objetivo: 'Fomentar la participación del equipo en la mejora continua y cumplir con el requisito de gestión de no conformidades.',
      comoAcceder: 'Desde Calidad y Mejora Continua -> Gestión de Sugerencias. O usando el formulario público en la pantalla de inicio de sesión.',
      buenasPracticas: '- Aporte evidencia visual siempre que sea posible.\n- Sea claro y constructivo en las ideas de mejora.',
      roles: ['admin', 'qa', 'supervisor'],
      relatedModules: ['/gestion-sugerencias', '/ideas-sugerencias-reclamos'],
      order: 1
    }
  });

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
