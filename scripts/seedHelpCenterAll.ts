import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding fully updated and comprehensive Help Center Data...');

  // 1. Clean up existing Help Center tables to avoid duplication and constraint errors
  await prisma.helpFaq.deleteMany();
  await prisma.helpTag.deleteMany();
  await prisma.helpArticle.deleteMany();
  await prisma.helpCategory.deleteMany();

  console.log('Existing Help Center data cleared.');

  // 2. Create Categories
  const catOperaciones = await prisma.helpCategory.create({
    data: {
      slug: 'operaciones',
      title: 'Operaciones en Terreno',
      description: 'Guías para el trabajo en campo, registro de tiempos, ausencias y gestión de proyectos asignados.',
      iconName: 'Wrench',
      order: 1
    }
  });

  const catGestion = await prisma.helpCategory.create({
    data: {
      slug: 'gestion',
      title: 'Gestión y Seguimiento',
      description: 'Documentación sobre planificación, control de proyectos, órdenes de servicio y métricas.',
      iconName: 'LayoutGrid',
      order: 2
    }
  });

  const catLogistica = await prisma.helpCategory.create({
    data: {
      slug: 'logistica',
      title: 'Logística y Materiales',
      description: 'Control de existencias de almacén, provisión de materiales para obras y control de herramientas.',
      iconName: 'Package',
      order: 3
    }
  });

  const catCalidad = await prisma.helpCategory.create({
    data: {
      slug: 'calidad',
      title: 'Calidad y Mejora Continua',
      description: 'Gestión ISO 9001:2015, biblioteca de documentos controlados, no conformidades, CAPA y checklists.',
      iconName: 'FileCheck',
      order: 4
    }
  });

  const catAdmin = await prisma.helpCategory.create({
    data: {
      slug: 'administracion',
      title: 'Administración y Sistema',
      description: 'Configuración global del sistema, geocercas, gestión de usuarios y auditorías.',
      iconName: 'Settings',
      order: 5
    }
  });

  console.log('Categories created successfully.');

  // 3. Define Articles Data
  const articles = [
    // --- CATEGORY: OPERACIONES ---
    {
      slug: 'fichado-gps-qr',
      categoryId: catOperaciones.id,
      title: 'Fichado (GPS y QR)',
      description: 'Cómo registrar su ingreso y egreso en proyectos mediante geolocalización o código QR.',
      content: `El módulo de Fichado permite a los operadores registrar el inicio y fin de su jornada laboral, validando su ubicación mediante GPS o el escaneo de un código QR específico del proyecto.

### Proceso de Fichado
1. Seleccione el tipo de fichado: **Ingreso** o **Egreso**.
2. Si el proyecto requiere QR, presione **Escanear QR** y apunte la cámara al código proporcionado por el supervisor o expuesto en el frente de obra.
3. Si el proyecto requiere GPS, la aplicación validará que se encuentre dentro del radio permitido (geovalla configurada).
4. Presione **Confirmar Fichada**.

### Modo Offline
Si no tiene conexión a internet en el sitio, la fichada se guardará localmente en la base de datos interna de su dispositivo (Modo Offline) y se sincronizará automáticamente cuando recupere la conexión. Las fichadas offline se marcan de color naranja y quedan pendientes de validación por el supervisor.`,
      objetivo: 'Garantizar el registro preciso de asistencia, tiempos de traslado y ubicación del personal en tiempo real.',
      comoAcceder: 'Desde el menú de navegación lateral o la pantalla de inicio del operador, seleccione "Fichado (GPS/QR)".',
      buenasPracticas: '- Asegúrese de tener el GPS activo y otorgar permisos de ubicación a la aplicación.\n- Fiche su egreso al finalizar la jornada para evitar inconsistencias en las liquidaciones.',
      roles: ['operador', 'supervisor', 'admin'],
      relatedModules: ['/fichado'],
      order: 1,
      faqs: [
        { question: '¿Qué pasa si me olvido de fichar el egreso?', answer: 'El sistema marcará la fichada como incompleta. El supervisor del proyecto deberá ajustar manualmente la hora de egreso en el Registro de Tiempos.', order: 1 },
        { question: '¿Por qué me dice "Fichada Sospechosa"?', answer: 'Esto ocurre si su ubicación GPS se encuentra fuera del radio permitido del proyecto, o si el código QR escaneado no coincide con el del proyecto actual.', order: 2 }
      ]
    },
    {
      slug: 'registro-tiempos-ausencias',
      categoryId: catOperaciones.id,
      title: 'Registro de Tiempos y Ausencias',
      description: 'Administración de horas trabajadas, ausencias justificadas y horas extra.',
      content: `El Registro de Tiempos permite llevar el control detallado de las horas trabajadas en cada proyecto o justificar las ausencias del personal técnico.

### Carga de Tiempos
1. Seleccione el proyecto de la lista y el operador correspondiente.
2. Ingrese la Fecha, la Hora de Ingreso y la Hora de Egreso.
3. El sistema calculará automáticamente las horas trabajadas descontando el tiempo de almuerzo reglamentario.

### Registro de Ausencias
Para registrar una ausencia justificada (Carpeta Médica, Falta, Permiso o Causa Administrativa):
1. Seleccione el tipo de registro como "Causa/Ausencia".
2. Al hacerlo, las horas se configurarán automáticamente en el rango estándar (ej. 08:00 a 17:00).
3. Si selecciona "Administrativo", deberá proveer una descripción detallada en el campo de texto explicativo.
4. En la planilla visual, estas ausencias se pintarán en color rojo para una rápida identificación.

### Horas Extra
Si el operador superó las horas estándar de la jornada laboral planificada y cuenta con la autorización correspondiente, marque la casilla **Hora Extra** para su procesamiento contable.`,
      objetivo: 'Centralizar el registro de horas consumidas por proyecto y justificar de forma auditable las ausencias del personal.',
      comoAcceder: 'Vaya a la sección "Operaciones" en el menú lateral y haga clic en "Registro de Tiempos".',
      buenasPracticas: '- Revise las horas cargadas diariamente.\n- Los supervisores deben validar las horas extra antes de que finalice la semana para la liquidación.',
      roles: ['operador', 'supervisor', 'admin', 'qa'],
      relatedModules: ['/timesheets'],
      order: 2,
      faqs: [
        { question: '¿Cómo justifico una ausencia por carpeta médica?', answer: 'Seleccione la causa "Carpeta Médica" en el tipo de registro. Las horas estándar (08:00 a 16:00 o 17:00) se auto-completarán automáticamente y se marcará de color rojo en la grilla.', order: 1 }
      ]
    },
    {
      slug: 'mis-proyectos',
      categoryId: catOperaciones.id,
      title: 'Mis Proyectos (Vista Supervisor)',
      description: 'Panel del supervisor para ver el progreso, gestionar frentes de obra y delegar materiales.',
      content: `El módulo **Mis Proyectos** está diseñado exclusivamente para los supervisores a cargo de la ejecución en terreno. Ofrece una vista consolidada de los proyectos activos bajo su responsabilidad.

### Funcionalidades Clave
- **Progreso del Proyecto**: Monitoreo en tiempo real de las horas de mano de obra acumuladas contra el presupuesto planificado.
- **Gestión de Personal**: Visualización del listado de operadores asignados al proyecto en el día actual.
- **Delegación de Materiales**: Si necesita delegar el retiro o devolución de materiales de un proyecto a un operador en campo, puede hacerlo mediante un flujo digital que requiere firma electrónica del operador en pantalla.
- **Checklists del Proyecto**: Acceso directo a las listas de verificación obligatorias (QMS) asociadas a las etapas del proyecto.`,
      objetivo: 'Facilitar al supervisor el control diario del estado de ejecución de sus obras y optimizar las delegaciones.',
      comoAcceder: 'Seleccione "Mis Proyectos" en el menú de navegación lateral.',
      buenasPracticas: '- Revise y firme digitalmente las delegaciones de materiales en el momento de la entrega física.\n- Asegúrese de que todos los operadores en su proyecto completen sus checklists antes del cierre de cada etapa.',
      roles: ['supervisor', 'admin', 'qa'],
      relatedModules: ['/my-projects'],
      order: 3,
      faqs: [
        { question: '¿Cómo delego materiales a un operador?', answer: 'Abra su proyecto asignado, vaya a la sección de Materiales, seleccione "Delegar Retiro/Devolución", seleccione el operador y solicite su firma electrónica en la pantalla táctil.', order: 1 }
      ]
    },
    {
      slug: 'demoras-cliente',
      categoryId: catOperaciones.id,
      title: 'Demoras del Cliente',
      description: 'Registro sistemático de tiempos muertos causados por factores externos al proyecto.',
      content: `El registro de **Demoras del Cliente** es la herramienta clave para documentar desvíos temporales en los cronogramas que son imputables al cliente y no a la operación de la empresa.

### Registro de Demoras
1. Ingrese al módulo y haga clic en **Registrar Demora**.
2. Seleccione el Proyecto afectado y el tipo de demora (ej. Falta de permisos, Frente no liberado, Falta de energía, Parada técnica por seguridad externa).
3. Escriba una descripción clara y detallada del motivo de la detención.
4. Indique la fecha y hora de inicio de la demora.
5. Una vez normalizada la situación, edite el registro para guardar la hora de finalización.
6. El sistema calcula las horas perdidas totales que se reportarán automáticamente en el reporte mensual de desvíos.`,
      objetivo: 'Proteger contractualmente a la empresa registrando de manera auditable los tiempos improductivos ajenos a nuestra operación.',
      comoAcceder: 'Menú lateral -> Operaciones -> Demoras del Cliente.',
      buenasPracticas: '- Registre la demora inmediatamente cuando se produzca.\n- Si es posible, tome fotografías del área bloqueada y adjúntelas en el detalle del registro.',
      roles: ['operador', 'supervisor', 'admin', 'qa'],
      relatedModules: ['/delays'],
      order: 4,
      faqs: [
        { question: '¿Las horas de demora se descuentan al operador?', answer: 'No. El operador mantiene sus horas cargadas con normalidad. Estas horas se marcan a nivel de proyecto como costo de demora imputable al cliente.', order: 1 }
      ]
    },

    // --- CATEGORY: GESTIÓN ---
    {
      slug: 'panel-analisis',
      categoryId: catGestion.id,
      title: 'Panel de Análisis',
      description: 'Visualización de métricas de rendimiento operativo, horas hombre y control de costos.',
      content: `El **Panel de Análisis** proporciona a los administradores y directores una visión holística del estado operativo y financiero de todos los proyectos activos.

### Principales Indicadores
- **Horas Totales Trabajadas**: Comparativa mensual de horas cargadas por proyecto y rol.
- **Desvío de Tiempos**: Horas planificadas vs. ejecutadas por frente de obra.
- **Índice de Demoras**: Impacto de los retrasos del cliente en el tiempo total del proyecto.
- **Eficiencia del Personal**: Gráficos de presentismo, ausentismo y distribución de tareas por operador.`,
      objetivo: 'Facilitar la toma de decisiones estratégicas a través de datos analíticos confiables y en tiempo real.',
      comoAcceder: 'Menú lateral -> Gestión y Seguimiento -> Panel de Análisis.',
      buenasPracticas: '- Utilice los filtros de fecha para analizar periodos específicos.\n- Exporte los gráficos para sus informes ejecutivos mensuales.',
      roles: ['supervisor', 'admin', 'qa'],
      relatedModules: ['/dashboard'],
      order: 1,
      faqs: []
    },
    {
      slug: 'planificacion',
      categoryId: catGestion.id,
      title: 'Planificación',
      description: 'Asignación de recursos humanos y materiales a los diferentes proyectos.',
      content: `El módulo de **Planificación** es el núcleo de la asignación del personal. Permite a los supervisores estructurar la agenda semanal o mensual de los operadores.

### Cómo Planificar
1. Visualice el calendario general del personal y sus disponibilidades.
2. Seleccione un operador y asígnelo a un proyecto en fechas específicas.
3. **Validación Automática**: El sistema validará automáticamente si el operador cuenta con las competencias requeridas o si algún curso obligatorio (LMS) ha vencido antes de confirmar la asignación.
4. Guarde los cambios para enviar notificaciones push automáticas a los operadores en sus dispositivos.`,
      objetivo: 'Optimizar la distribución de recursos humanos garantizando el cumplimiento de los perfiles requeridos para cada tarea.',
      comoAcceder: 'Menú lateral -> Gestión y Seguimiento -> Planificación.',
      buenasPracticas: '- Planifique con al menos una semana de anticipación.\n- Verifique la matriz de competencias antes de asignar operadores a frentes de trabajo de alto riesgo.',
      roles: ['supervisor', 'admin', 'qa'],
      relatedModules: ['/planning'],
      order: 2,
      faqs: []
    },
    {
      slug: 'gestion-proyectos',
      categoryId: catGestion.id,
      title: 'Gestión de Proyectos',
      description: 'Creación, edición y administración de la base de proyectos de la empresa.',
      content: `El módulo de **Gestión de Proyectos** permite a los administradores crear nuevos contratos, definir sus alcances, asignar geocercas GPS y configurar presupuestos de horas.

### Alta de un Proyecto
1. Haga clic en **Nuevo Proyecto**.
2. Ingrese Nombre, Código de Proyecto, Cliente y fechas de inicio y fin estimadas.
3. **Geocerca GPS**: Dibuje en el mapa interactivo el polígono del área de trabajo para que el sistema valide los fichados GPS.
4. **Tags y Checklist**: Asocie etiquetas de tipo de trabajo (ej. "Tendido Eléctrico") para vincular automáticamente las plantillas de checklist correspondientes.`,
      objetivo: 'Mantener un registro estructurado y geolocalizado de las obras para posibilitar el control operacional.',
      comoAcceder: 'Menú lateral -> Gestión y Seguimiento -> Gestión de Proyectos.',
      buenasPracticas: '- Configure siempre la geocerca de forma precisa para evitar falsos negativos en el fichado.\n- Defina el presupuesto de horas reales para habilitar el control de desvíos.',
      roles: ['admin', 'supervisor'],
      relatedModules: ['/projects'],
      order: 3,
      faqs: []
    },
    {
      slug: 'ordenes-servicio',
      categoryId: catGestion.id,
      title: 'Órdenes de Servicio',
      description: 'Generación de remitos digitales de servicios realizados y firma en terreno.',
      content: `Las **Órdenes de Servicio (OS)** son documentos legales firmados por el cliente que certifican que los trabajos planificados fueron completados satisfactoriamente.

### Flujo de la OS
1. Al concluir un servicio, el supervisor genera la Orden de Servicio desde la aplicación.
2. Selecciona las tareas completadas y detalla cualquier observación técnica.
3. Presenta la pantalla del dispositivo móvil al cliente para que aplique su firma digital.
4. El sistema genera un PDF firmado georreferenciado, que se envía automáticamente por correo al cliente y se archiva en la base de datos para facturación.`,
      objetivo: 'Digitalizar y agilizar la certificación de servicios prestados, eliminando el papel y reduciendo los plazos de facturación.',
      comoAcceder: 'Menú lateral -> Gestión y Seguimiento -> Órdenes de Servicio.',
      buenasPracticas: '- No cierre la Orden de Servicio hasta tener la firma de conformidad en pantalla.\n- Agregue comentarios detallados si hay desvíos aprobados por el cliente.',
      roles: ['supervisor', 'admin', 'qa'],
      relatedModules: ['/ordenes-servicio'],
      order: 4,
      faqs: []
    },
    {
      slug: 'aprobaciones',
      categoryId: catGestion.id,
      title: 'Aprobaciones',
      description: 'Validación de horas extra, fichadas manuales y desvíos de geocerca.',
      content: `El módulo de **Aprobaciones** permite a los supervisores y administradores revisar y autorizar desvíos de asistencia antes de que se consoliden en la liquidación de horas.

### ¿Qué requiere aprobación?
- **Fichadas de Riesgo (Fuera de Geocerca)**: Fichados realizados fuera de los límites GPS del proyecto.
- **Solicitudes de Modificación**: Peticiones enviadas por operadores para corregir una hora de ingreso o egreso.
- **Horas Extra**: Jornadas que excedan las horas diarias planificadas.`,
      objetivo: 'Garantizar la transparencia y control administrativo sobre la carga de tiempos del personal.',
      comoAcceder: 'Menú lateral -> Gestión y Seguimiento -> Aprobaciones.',
      buenasPracticas: '- Revise las solicitudes pendientes a diario para evitar retrasos.\n- Ingrese un motivo claro cuando rechace una solicitud.',
      roles: ['supervisor', 'admin', 'qa'],
      relatedModules: ['/aprobaciones'],
      order: 5,
      faqs: []
    },
    {
      slug: 'monitoreo-fichadas',
      categoryId: catGestion.id,
      title: 'Monitoreo de Fichadas',
      description: 'Control en tiempo real y geolocalización de las fichadas del personal.',
      content: `El **Monitoreo de Fichadas** es una herramienta de supervisión geográfica que muestra en un mapa las fichadas de ingreso y egreso a medida que ocurren.

### Características
- **Mapa en Vivo**: Visualización geográfica de todos los ingresos de la jornada.
- **Alertas Visuales**: Marcadores de color rojo para fichadas realizadas fuera de la geocerca.
- **Historial Diario**: Permite filtrar por operador para ver el recorrido de sus fichadas en el día.`,
      objetivo: 'Asegurar el cumplimiento geográfico de las asignaciones de trabajo y detectar anomalías de presencialidad.',
      comoAcceder: 'Menú lateral -> Gestión y Seguimiento -> Monitoreo de Fichadas.',
      buenasPracticas: '- Use esta pantalla al inicio del turno de la mañana para verificar que todo el equipo llegó a sus frentes de trabajo.',
      roles: ['admin'],
      relatedModules: ['/monitoreo-fichadas'],
      order: 6,
      faqs: []
    },

    // --- CATEGORY: LOGÍSTICA ---
    {
      slug: 'inventario-materiales',
      categoryId: catLogistica.id,
      title: 'Inventario de Materiales',
      description: 'Control de existencias, almacén central y movimientos de stock.',
      content: `El módulo de **Inventario** permite controlar el stock disponible de materiales e insumos en el almacén central y sub-depósitos.

### Operaciones
- **Ingreso de Stock**: Carga de materiales recibidos de proveedores con lote y fecha de vencimiento.
- **Ajustes de Inventario**: Corrección de diferencias de existencias físicas.
- **Trazabilidad**: Historial completo de entradas, salidas y transferencias entre depósitos.`,
      objetivo: 'Mantener el stock actualizado para evitar demoras en la ejecución por falta de insumos críticos.',
      comoAcceder: 'Menú lateral -> Logística y Materiales -> Inventario de Materiales.',
      buenasPracticas: '- Realice recuentos cíclicos mensuales.\n- Configure alertas de stock mínimo para compras automáticas.',
      roles: ['admin', 'qa'],
      relatedModules: ['/inventario'],
      order: 1,
      faqs: []
    },
    {
      slug: 'provision-materiales',
      categoryId: catLogistica.id,
      title: 'Provisión de Materiales',
      description: 'Solicitud, entrega y retiro de materiales asociados a proyectos.',
      content: `El módulo de **Provisión de Materiales** conecta el almacén con la ejecución de proyectos. Permite a los supervisores solicitar insumos específicos para las obras.

### Proceso de Entrega
1. El supervisor crea una solicitud detallando el material y la obra.
2. El encargado de depósito prepara el pedido y confirma la entrega en el sistema.
3. Si es necesario, el supervisor puede delegar el retiro del material a un operador asignado, quien firmará la entrega en terreno.`,
      objetivo: 'Garantizar la asignación correcta de materiales a cada proyecto para controlar costos reales.',
      comoAcceder: 'Menú lateral -> Logística y Materiales -> Provisión de Materiales.',
      buenasPracticas: '- Valide que la cantidad solicitada no supere el presupuesto inicial del proyecto.\n- Exija firma al operador que retira la mercadería.',
      roles: ['supervisor', 'admin', 'qa'],
      relatedModules: ['/provision-materiales'],
      order: 2,
      faqs: []
    },
    {
      slug: 'herramientas-carros',
      categoryId: catLogistica.id,
      title: 'Herramientas y Carros',
      description: 'Control de préstamo, devolución e inspección de herramientas operativas.',
      content: `El módulo de **Herramientas y Carros** asegura que los activos de la empresa estén identificados, asignados a un responsable y en condiciones seguras de uso.

### Préstamos y Devoluciones
- **Retiro de Herramientas**: El operador o supervisor solicita una herramienta mediante escaneo de su código de barras/QR. Se registra el estado físico inicial.
- **Devolución**: Al reintegrar el activo, se comprueba su integridad. En caso de rotura, se genera una notificación de desvío de calidad.
- **Inspección Pre-uso**: Checklists rápidos antes de operar herramientas de alta criticidad.`,
      objetivo: 'Minimizar pérdidas de activos y prevenir accidentes garantizando el mantenimiento oportuno de las herramientas.',
      comoAcceder: 'Menú lateral -> Logística y Materiales -> Herramientas y Carros.',
      buenasPracticas: '- No entregue herramientas que muestren desgaste peligroso.\n- Registre la devolución de forma inmediata para liberar el activo.',
      roles: ['operador', 'supervisor', 'admin'],
      relatedModules: ['/herramientas'],
      order: 3,
      faqs: []
    },

    // --- CATEGORY: CALIDAD ---
    {
      slug: 'calidad-documentacion',
      categoryId: catCalidad.id,
      title: 'Biblioteca Documental (SGI)',
      description: 'Repositorio centralizado de documentos controlados y procedimientos bajo la norma ISO 9001.',
      content: `La **Biblioteca Documental** es el repositorio estructurado de todos los procedimientos, instructivos de trabajo, políticas y manuales aprobados por el Sistema de Gestión Integrado (SGI).

### Funcionalidades
- **Documentos Controlados**: Control estricto de versiones con historial de cambios completo.
- **Lectura Obligatoria**: El sistema asocia documentos específicos a roles de usuarios. Éstos deben marcar el documento como "Leído y Entendido".
- **Firma de Conformidad**: Registro inmutable de la firma del operador que certifica que comprende la instrucción de trabajo.`,
      objetivo: 'Asegurar que todo el personal opera bajo las directrices y procedimientos vigentes del sistema de calidad.',
      comoAcceder: 'Menú lateral -> Calidad y Mejora Continua -> Calidad y Documentación.',
      buenasPracticas: '- Revise periódicamente la pestaña "Pendientes de Lectura".\n- No conserve copias físicas impresas de los documentos, ya que pueden quedar obsoletas.',
      roles: ['operador', 'supervisor', 'admin', 'qa'],
      relatedModules: ['/calidad'],
      order: 1,
      faqs: []
    },
    {
      slug: 'formacion-integral',
      categoryId: catCalidad.id,
      title: 'Formación Integral (LMS)',
      description: 'Plataforma de capacitación (LMS) para el cumplimiento de perfiles de competencia.',
      content: `El módulo de **Formación Integral (LMS)** permite diseñar e impartir capacitaciones internas de forma digital e interactiva.

### Estructura de Cursos
- **Contenido**: Videos, PDFs de procedimientos y instructivos técnicos interactivos.
- **Exámenes/Cuestionarios**: Diseñados para comprobar la asimilación del conocimiento.
- **Aprobación y Certificado**: Lograr el porcentaje mínimo de aprobación otorga una competencia válida para la planificación.`,
      objetivo: 'Automatizar el entrenamiento del personal y garantizar que el conocimiento técnico y de seguridad se distribuya eficazmente.',
      comoAcceder: 'Menú lateral -> Calidad y Mejora Continua -> Formación Integral.',
      buenasPracticas: '- Complete los cursos obligatorios en un ambiente silencioso.\n- Su desempeño en las evaluaciones impacta directamente en su habilitación para frentes de trabajo complejos.',
      roles: ['operador', 'supervisor', 'admin', 'qa'],
      relatedModules: ['/capacitacion'],
      order: 2,
      faqs: []
    },
    {
      slug: 'gestion-sugerencias-reclamos',
      categoryId: catCalidad.id,
      title: 'Gestión de Sugerencias y Reclamos',
      description: 'Portal para registrar ideas de mejora, sugerencias y reclamos según la norma ISO 9001.',
      content: `La Gestión de Sugerencias es el buzón digital donde cualquier usuario puede aportar ideas de mejora o notificar reclamos, manteniendo un ciclo de vida controlado por el equipo de QA.

### Cómo registrar una Sugerencia o Reclamo
1. Puede hacerlo de manera anónima o identificada.
2. Seleccione la categoría: **Idea de Mejora**, **Sugerencia** o **Reclamo**.
3. Escriba el detalle y adjunte evidencia fotográfica si aplica.
4. Presione **Enviar**.

### Ciclo de vida (QA)
- **Pendiente**: Recién creada.
- **En Progreso**: Asignada a un responsable para su análisis.
- **Completada**: Acciones aplicadas.
- **Cancelada**: Desestimada con justificación.

Las sugerencias aprobadas pueden derivar en una "Acción Correctiva/CAPA".`,
      objetivo: 'Fomentar la participación del equipo en la mejora continua y cumplir con el requisito de gestión de no conformidades.',
      comoAcceder: 'Desde Calidad y Mejora Continua -> Gestión de Sugerencias y Reclamos. O usando el formulario público en la pantalla de inicio de sesión.',
      buenasPracticas: '- Aporte evidencia visual siempre que sea posible.\n- Sea claro y constructivo en las ideas de mejora.',
      roles: ['admin', 'qa', 'supervisor'],
      relatedModules: ['/gestion-sugerencias', '/ideas-sugerencias-reclamos'],
      order: 3,
      faqs: [
        { question: '¿Qué pasa si me olvido de fichar el egreso?', answer: 'El sistema marcará la fichada como incompleta y el supervisor deberá ajustarla manualmente en el Registro de Tiempos.', order: 1 }
      ]
    },
    {
      slug: 'no-conformidades',
      categoryId: catCalidad.id,
      title: 'Gestión de No Conformidades (NC)',
      description: 'Ciclo de vida completo para la identificación, análisis y resolución de desvíos bajo ISO 9001:2015.',
      content: `El módulo de **No Conformidades (NC)** permite documentar y gestionar cualquier desvío de los procesos o requisitos normativos.

### Registro de una No Conformidad (NC)
1. Ingrese a **Calidad** y seleccione la pestaña **No Conformidades (NC)**.
2. Haga clic en **Nueva NC**.
3. Complete la Fecha de detección, Origen (Auditoría interna, Reclamo de cliente, etc.), Tipo (Mayor o Menor), Categoría, Criticidad, Área afectada y la Descripción detallada de la desviación junto con la evidencia (imágenes/documentos).
4. Defina un Responsable de tratamiento y una Fecha compromiso.

### Ciclo de vida y Análisis de Causa Raíz
Una vez creada la NC, el flujo incluye:
- **Análisis de Causa Raíz (RCA)**: Mediante metodologías estándar como 5 Porqués o diagrama de Ishikawa para identificar la causa fundamental del desvío.
- **Plan de Acción (CAPA)**: Vinculación a acciones correctivas y preventivas.
- **Reuniones de Calidad**: Registro de actas, compromisos y participantes.
- **Verificación de Eficacia**: El área de Calidad (QA) debe validar si las acciones tomadas eliminaron la causa raíz antes de proceder al Cierre de la NC.`,
      objetivo: 'Asegurar el tratamiento sistemático de las desviaciones y la aplicación de acciones para evitar su recurrencia.',
      comoAcceder: 'Pestaña "No Conformidades" en el módulo de Calidad.',
      buenasPracticas: '- Registrar la NC inmediatamente después de ser detectada.\n- Adjuntar fotos o registros objetivos como evidencia física.\n- Realizar análisis de causa raíz multidisciplinarios.',
      roles: ['supervisor', 'admin', 'qa'],
      relatedModules: ['/calidad'],
      order: 4,
      faqs: [
        { question: '¿Quién puede abrir una No Conformidad?', answer: 'Cualquier supervisor, auditor o miembro del equipo de calidad (QA) puede dar de alta una No Conformidad al detectar un desvío.', order: 1 },
        { question: '¿Qué es el Análisis de Causa Raíz (RCA)?', answer: 'Es la investigación metodológica (por ejemplo, usando los 5 Porqués) para determinar la causa original del desvío, evitando tratar únicamente el síntoma.', order: 2 }
      ]
    },
    {
      slug: 'sistema-capa',
      categoryId: catCalidad.id,
      title: 'Sistema CAPA y Acciones de Mejora',
      description: 'Gestión de Acciones Correctivas, Preventivas y de Mejora Continua para garantizar la calidad.',
      content: `El Sistema CAPA (Corrective and Preventive Action) permite administrar las acciones tomadas para eliminar las causas de no conformidades existentes o prevenir la ocurrencia de desvíos potenciales.

### Clasificación de Acciones
- **Acción Correctiva**: Para eliminar la causa de una No Conformidad ya detectada.
- **Acción Preventiva**: Para mitigar riesgos y evitar que ocurran desvíos potenciales.
- **Mejora Continua**: Propuestas de optimización de procesos.
- **Mitigación de Riesgo**: Derivadas de matrices de riesgo de la organización.

### Gestión del Ciclo de Vida
1. **Creación**: Detalle de la acción, origen, justificación y beneficio esperado.
2. **Planificación**: Asignación de prioridad, responsable de ejecución y fecha compromiso.
3. **Seguimiento (Avance %)**: El responsable actualiza el progreso y adjunta las evidencias de implementación.
4. **Verificación de Eficacia**: Tras la finalización de las tareas, un verificador independiente (QA o Supervisor) evalúa si la acción implementada fue realmente eficaz para resolver el problema original.`,
      objetivo: 'Implementar acciones efectivas que resuelvan problemas de raíz y fomenten la mejora continua de la organización.',
      comoAcceder: 'Pestaña "Sistema CAPA" en el módulo de Calidad.',
      buenasPracticas: '- No confundir una acción correctora (inmediata) con una acción correctiva (sobre la causa raíz).\n- Adjuntar evidencias claras (fotos, firmas, nuevos procedimientos) al completar la acción.',
      roles: ['supervisor', 'admin', 'qa'],
      relatedModules: ['/calidad'],
      order: 5,
      faqs: [
        { question: '¿Cuál es la diferencia entre Acción Correctiva y Preventiva?', answer: 'La Acción Correctiva actúa sobre la causa de un problema existente para que no vuelva a ocurrir, mientras que la Acción Preventiva actúa sobre un riesgo identificado para evitar que ocurra por primera vez.', order: 1 }
      ]
    },
    {
      slug: 'matriz-competencias',
      categoryId: catCalidad.id,
      title: 'Competencias y Matriz QMS',
      description: 'Control y seguimiento del nivel de capacitación, habilidades y autorizaciones del personal.',
      content: `La Matriz de Competencias consolida las habilidades, autorizaciones operativas y el estado de capacitación del personal técnico.

### Elementos de Competencia
- **Capacitaciones Internas (LMS)**: Cursos obligatorios sobre procedimientos vigentes del SGI. Incluye contenido en video/PDF y cuestionarios de evaluación.
- **Certificaciones Externas**: Registro de cursos fuera de la empresa (ej: Trabajo en altura, Altas tensiones). Permite subir certificados y la IA extrae automáticamente las horas y validez.
- **Auditorías de Seguridad**: Registros de auditorías en campo (EPP, protocolo LOTO).

### Funcionalidades
- **Alertas de Vencimiento**: Notificaciones automáticas cuando una competencia o curso obligatorio está por expirar o ya venció.
- **Asignación Basada en Competencias**: Los supervisores pueden comprobar el estado de capacitación del personal antes de asignarlos a proyectos críticos en la planificación.`,
      objetivo: 'Asegurar que cada tarea operativa sea ejecutada exclusivamente por personal calificado y autorizado.',
      comoAcceder: 'Pestañas "Capacitación LMS", "Matriz de Competencias" y "Vencimientos" en el módulo de Calidad.',
      buenasPracticas: '- Cargar los certificados de cursos externos apenas sean recibidos.\n- Realizar los cuestionarios de capacitación a conciencia, ya que impactan directamente en sus competencias autorizadas.',
      roles: ['operador', 'supervisor', 'admin', 'qa'],
      relatedModules: ['/calidad'],
      order: 6,
      faqs: [
        { question: '¿Qué ocurre si un curso obligatorio expira?', answer: 'El sistema marcará la competencia del operador como "Vencida" y el planificador mostrará una alerta de advertencia o bloqueará su asignación en proyectos que requieran dicha competencia.', order: 1 }
      ]
    },
    {
      slug: 'plantillas-checklist',
      categoryId: catCalidad.id,
      title: 'Plantillas de Checklist (QMS)',
      description: 'Estandarización de controles operacionales y técnicos mediante listas de verificación obligatorias.',
      content: `El módulo de Plantillas de Checklist permite estandarizar los controles y verificaciones técnicas y de seguridad antes del inicio, durante o al cierre de las Órdenes de Servicio y Proyectos.

### Creación y Asociación
1. El administrador de calidad define las plantillas con sus respectivos ítems de control.
2. Cada ítem puede marcarse como:
   - **Obligatorio**: Impide firmar la orden o cerrar el proyecto si no está verificado.
   - **Requiere Evidencia Fotográfica**: Solicita subir una foto georreferenciada para corroborar el estado.
   - **Requiere Firma**: Solicita firma digital de conformidad.
3. Las plantillas se asocian de forma automática a proyectos que tengan etiquetas de aplicabilidad (ej: "Tendido Eléctrico", "Montaje de Estructura").

### Ejecución en Campo
- Los operadores y supervisores completan los checklists desde su aplicación en campo, adjuntando la evidencia requerida.
- El sistema registra la ubicación GPS y el momento exacto de cada validación.`,
      objetivo: 'Estandarizar las inspecciones técnicas en terreno para asegurar la calidad final de la instalación o servicio.',
      comoAcceder: 'Pestaña "Plantillas de Checklist" en Calidad y dentro de cada Proyecto/Orden de Servicio asignada.',
      buenasPracticas: '- Completar el checklist en tiempo real mientras se realiza la inspección física.\n- Tomar fotografías nítidas y detalladas de los puntos críticos que requieren evidencia.',
      roles: ['supervisor', 'admin', 'qa'],
      relatedModules: ['/calidad'],
      order: 7,
      faqs: []
    },
    {
      slug: 'auditoria-ia',
      categoryId: catCalidad.id,
      title: 'Auditoría de IA',
      description: 'Logs de auditoría automatizada y validaciones inteligentes de la IA de HDB.',
      content: `El módulo de **Auditoría de IA** es el registro de las evaluaciones y validaciones automáticas que realiza el asistente de Inteligencia Artificial sobre los procesos y documentos cargados en el SGI.

### Acciones Realizadas por la IA
- **Análisis de Certificados Externos**: OCR inteligente y validación automática de campos como nombre, curso, fecha de emisión y vencimiento.
- **Revisión de Evidencia de Checklists**: Comparación visual automática de las fotografías adjuntas por el operador en campo contra los requisitos del ítem para detectar fraudes o mala calidad en las fotos.
- **Análisis Predictivo de Riesgos**: Advertencia de posibles retrasos o problemas de calidad basados en el registro de tiempos y demoras.`,
      objetivo: 'Garantizar la transparencia e integridad de las validaciones asistidas por inteligencia artificial.',
      comoAcceder: 'Menú lateral -> Calidad y Mejora Continua -> Auditoría de IA.',
      buenasPracticas: '- Revise las alertas de discrepancia generadas por la IA para auditar las validaciones automáticas.\n- Asegúrese de que el personal cargue imágenes claras para evitar rechazos erróneos.',
      roles: ['admin'],
      relatedModules: ['/auditoria-ia'],
      order: 8,
      faqs: []
    },
    {
      slug: 'centro-ayuda',
      categoryId: catCalidad.id,
      title: 'Centro de Ayuda y Formación',
      description: 'Portal de consulta y autoayuda sobre la plataforma y el Sistema de Gestión SGI.',
      content: `El Centro de Ayuda es el portal unificado para resolver dudas de uso sobre los módulos operativos, de logística, administración y calidad del sistema.

### Características Principales
- **Búsqueda Inteligente**: Buscador en la cabecera que filtra por palabras clave en títulos, resúmenes y contenidos de las guías.
- **Navegación por Categorías**: Separación en áreas temáticas como Operaciones, Logística, Gestión y Calidad.
- **Artículos Populares**: Acceso rápido a los temas más consultados por los usuarios.
- **Preguntas Frecuentes (FAQ)**: Respuestas directas a problemas y dudas frecuentes de cada módulo.
- **Ayuda Contextual**: En la parte superior de cada página del sistema, un icono de pregunta (?) permite desplegar un panel lateral con la guía resumida de esa vista sin salir del flujo de trabajo.`,
      objetivo: 'Proporcionar soporte continuo, documentación y resolución rápida de dudas para todos los usuarios del sistema.',
      comoAcceder: 'Desde el menú de navegación lateral "Centro de Ayuda" o a través de los iconos de ayuda (?) en la cabecera de las vistas.',
      buenasPracticas: '- Utilice el buscador global antes de contactar con soporte técnico.\n- Valore si un artículo le ha sido de ayuda pulsando el botón de utilidad al final del texto.',
      roles: ['operador', 'supervisor', 'admin', 'qa'],
      relatedModules: ['/centro-ayuda'],
      order: 9,
      faqs: []
    },

    // --- CATEGORY: ADMINISTRACIÓN ---
    {
      slug: 'gestion-usuarios',
      categoryId: catAdmin.id,
      title: 'Gestión de Usuarios',
      description: 'Creación de cuentas, restablecimiento de contraseñas y asignación de roles de acceso.',
      content: `El módulo de **Gestión de Usuarios** está reservado para los administradores y supervisores de la plataforma. Permite la administración de las credenciales y perfiles del personal.

### Registro de Operadores
1. Haga clic en **Nuevo Operador** o **Nuevo Usuario**.
2. Ingrese el Nombre Completo, DNI/Identificación, Correo y asigne un Rol (Operador, Supervisor, QA, Vendedor, Administrador).
3. Defina una contraseña inicial o envíe un enlace de restablecimiento.
4. **Roles y Permisos**: El sistema tiene Control de Acceso Basado en Roles (RBAC) centralizado. La modificación del rol de un usuario se refleja en sus vistas disponibles y permisos en tiempo real.`,
      objetivo: 'Controlar la seguridad de acceso a la plataforma garantizando que cada usuario tenga únicamente los privilegios adecuados a su función.',
      comoAcceder: 'Menú lateral -> Administración -> Gestión de Usuarios.',
      buenasPracticas: '- Desactive inmediatamente los usuarios que se desvinculen de la empresa.\n- Asigne contraseñas seguras y promueva el cambio periódico de las mismas.',
      roles: ['admin'],
      relatedModules: ['/operators'],
      order: 1,
      faqs: []
    },
    {
      slug: 'gestion-clientes',
      categoryId: catAdmin.id,
      title: 'Gestión de Clientes',
      description: 'Administración de la cartera de clientes de la empresa, contratos y contactos.',
      content: `El módulo de **Gestión de Clientes** permite mantener centralizada la información comercial y de contacto de las empresas contratantes.

### Alta de Cliente
1. Registre la Razón Social, CUIT/Identificador Fiscal y Dirección.
2. Ingrese los contactos autorizados (Nombres, correos electrónicos y teléfonos) para el envío de notificaciones de Órdenes de Servicio y PDFs.
3. Asocie proyectos activos para facilitar la categorización y reportabilidad.`,
      objetivo: 'Facilitar la comunicación y agilizar el envío de certificaciones y partes de trabajo firmados en terreno.',
      comoAcceder: 'Menú lateral -> Administración -> Gestión de Clientes.',
      buenasPracticas: '- Mantenga los correos electrónicos de los clientes actualizados para asegurar que las Órdenes de Servicio lleguen a destino.\n- Ingrese un contacto técnico y un contacto de facturación.',
      roles: ['admin', 'supervisor'],
      relatedModules: ['/clients'],
      order: 2,
      faqs: []
    },
    {
      slug: 'auditoria-sistema',
      categoryId: catAdmin.id,
      title: 'Auditoría del Sistema',
      description: 'Registro inmutable de transacciones y auditoría forense de operaciones.',
      content: `El registro de **Auditoría del Sistema** proporciona trazabilidad completa e inmutable de todas las acciones críticas realizadas dentro del Job Planner.

### Información Registrada
- **Quién**: Operador o administrador que ejecutó la acción.
- **Qué**: Tipo de operación (creación, edición, eliminación).
- **Cuándo**: Fecha y hora exacta con precisión de milisegundos.
- **Datos**: Cambios específicos aplicados (valores anteriores vs. nuevos).

Este módulo es de acceso exclusivo para administradores y auditores del SGI y sirve como evidencia primaria en auditorías de certificación ISO 9001.`,
      objetivo: 'Garantizar la integridad de los datos de la plataforma y posibilitar investigaciones en caso de incidentes o desvíos.',
      comoAcceder: 'Menú lateral -> Administración -> Auditoría.',
      buenasPracticas: '- Utilice los filtros por usuario o entidad para rastrear cambios específicos.\n- No comparta cuentas de administrador para mantener la validez individual de los registros de auditoría.',
      roles: ['admin'],
      relatedModules: ['/auditoria'],
      order: 3,
      faqs: []
    },
    {
      slug: 'configuracion-sistema',
      categoryId: catAdmin.id,
      title: 'Configuración del Sistema',
      description: 'Ajustes globales de geolocalización, parámetros del SGI y opciones del sistema.',
      content: `El módulo de **Configuración** permite parametrizar el comportamiento general del Job Planner para adaptarlo a las necesidades específicas de la organización.

### Ajustes Disponibles
- **Geocerca de Empresa (Base)**: Definición del perímetro de la sede central.
- **Límites GPS**: Umbral de tolerancia de distancia para el fichado en campo (ej. 100 metros).
- **Causas de Ausencia**: Parametrización de las opciones válidas para el registro de tiempos.
- **Categorías del SGI**: Definición de categorías de no conformidades, tipos de checklists y orígenes.`,
      objetivo: 'Flexibilizar el sistema mediante la centralización de parámetros de negocio sin requerir modificaciones en el código fuente.',
      comoAcceder: 'Menú lateral -> Administración -> Configuración.',
      buenasPracticas: '- Modifique los parámetros de geocerca con precaución, ya que impactan directamente en las validaciones automáticas de fichados en curso.',
      roles: ['admin'],
      relatedModules: ['/configuracion'],
      order: 4,
      faqs: []
    },
    {
      slug: 'notificaciones',
      categoryId: catAdmin.id,
      title: 'Notificaciones y Alertas',
      description: 'Configuración y buzón de avisos por horas extra, aprobaciones, vencimientos y SGI.',
      content: `El sistema cuenta con un motor de **Notificaciones** push (OneSignal) e internas para alertar en tiempo real a los usuarios sobre eventos críticos.

### Tipos de Alertas
- **Operativas**: Avisos a operadores sobre nuevas asignaciones de planificación.
- **Administrativas**: Solicitudes de aprobación pendientes de resolver para los supervisores.
- **Calidad/SGI**: Notificaciones sobre la asignación de una No Conformidad o la proximidad del vencimiento de un curso obligatorio o certificación externa.

### Configuración de Alertas
Cada usuario puede gestionar desde su perfil qué canales (Web, Móvil, Email) desea habilitar para cada tipo de evento.`,
      objetivo: 'Mantener a todo el equipo alineado y reaccionar de forma inmediata ante eventos y desvíos operativos.',
      comoAcceder: 'Icono de campana en el encabezado del sistema, o Menú lateral -> Administración -> Notificaciones.',
      buenasPracticas: '- Habilite los permisos de notificaciones push en su navegador o teléfono celular para recibir avisos en tiempo real.',
      roles: ['operador', 'supervisor', 'admin', 'qa'],
      relatedModules: ['/notifications'],
      order: 5,
      faqs: []
    }
  ];

  // 4. Insert Articles and associated FAQs
  for (const art of articles) {
    const { faqs, ...articleData } = art;
    
    await prisma.helpArticle.create({
      data: {
        ...articleData,
        roles: articleData.roles, // Will be serialized automatically by Prisma
        relatedModules: articleData.relatedModules, // Will be serialized automatically by Prisma
        faqs: {
          create: faqs
        }
      }
    });
  }

  console.log(`Seeded ${articles.length} articles with their FAQs successfully.`);
  console.log('Help Center database seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
