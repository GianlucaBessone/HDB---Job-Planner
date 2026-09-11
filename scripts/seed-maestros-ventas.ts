import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MARCAS = [
  'Alic', 'Allen Bradley', 'Argeflex', 'Bael', 'BAW', 'Bellalux', 'Brother', 'Cambre',
  'Candil', 'Cellotti', 'Chint', 'Cobrhil', 'Commax', 'Conextube', 'CyG', 'Dahua',
  'Daisa', 'Diler', 'Diletta', 'Energizer', 'Epuyen', 'ETI', 'Famatel', 'Ferrolux',
  'Fibosa', 'Fischer', 'Forli', 'Fotovim', 'Gabexel', 'Genérico', 'Genrod', 'GLC',
  'Gralf', 'HellermannTyton', 'Hikvision', 'Inteck', 'Kalop', 'Keland', 'LCT', 'Ledvance',
  'Light House', 'Lucciola', 'Macroled', 'Marlew', 'Maxell', 'Megalite', 'Mercusys',
  'Narumi', 'Noga', 'Osram', 'Pampaco', 'Panasonic', 'Philips', 'Phoenix Contact',
  'Powerswitch', 'Prysmian', 'Qianji', 'Richi', 'Roker', 'Sahen', 'Samet', 'San Justo',
  'Scame', 'Schneider Electric', 'Siemens', 'Signotel', 'Steck', 'Sybyd', 'Tacsa',
  'Tbcin', 'TEA', 'Teclastar', 'Tecnobox', 'Tecnocom', 'Telemecanique', 'Toshiba',
  'Tubelectric', 'Uniview', 'Vini-Tape', 'Vinnic', 'Viyilant', 'Weg', 'Welt',
  'Western Digital', 'Würth', 'X-28', 'Zoloda',
];

const FAMILIAS_DATA: Record<string, string[]> = {
  'Automatización y Control': [
    'Accesorios Eléctricos Varios',
    'Arrancadores Suaves',
    'Artefactos Decorativos y Exterior',
    'Cajas Estancas',
    'Compensación de Potencia y Medición',
    'Contactores y Accesorios',
    'Guardamotores',
    'Interruptores Abiertos de Potencia',
    'Interruptores en Caja Moldeada',
    'Llaves Selectoras',
    'Pulsadores y Paradas de Emergencia',
    'Químicos y Consumibles de Taller',
    'Relés Auxiliares e Interfaces',
    'Relés Térmicos de Sobrecarga',
    'Señalización y Ojos de Buey',
    'Temporizadores y Relojes',
    'Variadores de Velocidad',
  ],
  'Cables y Conductores': [
    'Accesorios Eléctricos Varios',
    'Borneras y Repartidores',
    'Cable Chato',
    'Cable Desnudo',
    'Cable Paralelo',
    'Cable Subterráneo',
    'Cable TPR / Taller',
    'Cable Unipolar',
    'Cables de Red y Comunicación',
    'Conectores, Curvas y Accesorios de Caño',
    'Llaves de Luz y Módulos',
    'Sensores y Fines de Carrera',
    'Terminales y Conexiones Eléctricas',
  ],
  'Canalización y Conducción': [
    'Accesorios Eléctricos Varios',
    'Bandejas Portacables y Accesorios',
    'Borneras y Repartidores',
    'Cable Paralelo',
    'Cablecanales y Pisocanales',
    'Cables de Red y Comunicación',
    'Cajas de Medidor y Pilares',
    'Cajas de Paso y Derivación',
    'Caños Corrugados',
    'Caños Flexibles Metálicos',
    'Caños Rígidos (PVC / Hierro / Galv.)',
    'Conectores, Curvas y Accesorios de Caño',
    'Fijaciones y Accesorios',
    'Gabinetes y Armarios',
    'Llaves de Luz y Módulos',
    'Químicos y Consumibles de Taller',
    'Sensores y Detectores de Seguridad',
    'Tiras LED y Rieles Magnéticos',
  ],
  'Herramientas e Instrumentación': [
    'Herramientas Manuales',
    'Instrumentos de Medición',
  ],
  'Iluminación': [
    'Accesorios Eléctricos Varios',
    'Alumbrado Público y Vial',
    'Artefactos Decorativos y Exterior',
    'Bandejas Portacables y Accesorios',
    'Borneras y Repartidores',
    'Cable de Comando y Control',
    'Cable Subterráneo',
    'Cables de Red y Comunicación',
    'Cajas de Embutir',
    'Cajas de Paso y Derivación',
    'Cajas Estancas',
    'Cámaras CCTV e IP',
    'Caños Corrugados',
    'Caños Flexibles Metálicos',
    'Conectores, Curvas y Accesorios de Caño',
    'Contactores y Accesorios',
    'Dicroicas, AR111 y Spots',
    'Fichas y Tomas Industriales',
    'Fijaciones y Accesorios',
    'Fotocontroles y Control Crepuscular',
    'Gabinetes y Armarios',
    'Grabadores DVR y NVR',
    'Herramientas Manuales',
    'Iluminación de Emergencia',
    'Instrumentos de Medición',
    'Interruptores Diferenciales',
    'Interruptores Termomagnéticos',
    'Lámparas y Bulbos LED',
    'Llaves de Luz y Módulos',
    'Llaves Selectoras',
    'Paneles y Plafones LED',
    'Pilas y Baterías',
    'Proyectores y Reflectores LED',
    'Puesta a Tierra',
    'Pulsadores y Paradas de Emergencia',
    'Relés Auxiliares e Interfaces',
    'Relés Térmicos de Sobrecarga',
    'Terminales y Conexiones Eléctricas',
    'Tiras LED y Rieles Magnéticos',
    'Tubos y Listones LED',
  ],
  'Instalación y Conexión': [
    'Accesorios Eléctricos Varios',
    'Borneras y Repartidores',
    'Cable Chato',
    'Cable Unipolar',
    'Cables de Red y Comunicación',
    'Cajas de Embutir',
    'Cajas de Medidor y Pilares',
    'Cajas Estancas',
    'Cintas y Aislaciones',
    'Conectores, Curvas y Accesorios de Caño',
    'Fichas y Tomas Industriales',
    'Fijaciones y Accesorios',
    'Interruptores en Caja Moldeada',
    'Llaves de Luz y Módulos',
    'Pilas y Baterías',
    'Terminales y Conexiones Eléctricas',
  ],
  'Materiales Eléctricos Industriales': [
    'Accesorios Eléctricos Varios',
    'Artefactos Decorativos y Exterior',
    'Cables de Red y Comunicación',
    'Cajas Estancas',
    'Centrales y Kits de Alarma',
    'Compensación de Potencia y Medición',
    'Conectividad y Redes CCTV',
    'Conectores, Curvas y Accesorios de Caño',
    'Contactores y Accesorios',
    'Fijaciones y Accesorios',
    'Guardamotores',
    'Iluminación de Emergencia',
    'Interruptores en Caja Moldeada',
    'Interruptores Termomagnéticos',
    'Lámparas y Bulbos LED',
    'Llaves de Luz y Módulos',
    'Paneles y Plafones LED',
    'Porteros y Control de Acceso',
    'Puesta a Tierra',
    'Pulsadores y Paradas de Emergencia',
    'Químicos y Consumibles de Taller',
    'Seccionadores y Conmutadores',
    'Sensores y Detectores de Seguridad',
    'Sensores y Fines de Carrera',
    'Temporizadores y Relojes',
    'Tiras LED y Rieles Magnéticos',
  ],
  'Protección y Maniobra': [
    'Cable Unipolar',
    'Cables de Red y Comunicación',
    'Fusibles y Bases',
    'Guardamotores',
    'Interruptores Abiertos de Potencia',
    'Interruptores Diferenciales',
    'Interruptores en Caja Moldeada',
    'Interruptores Termomagnéticos',
    'Seccionadores y Conmutadores',
  ],
  'Seguridad y Comunicación': [
    'Accesorios Eléctricos Varios',
    'Almacenamiento y Discos',
    'Cable de Comando y Control',
    'Cables de Red y Comunicación',
    'Cajas Estancas',
    'Cámaras CCTV e IP',
    'Centrales y Kits de Alarma',
    'Conectividad y Redes CCTV',
    'Fotocontroles y Control Crepuscular',
    'Gabinetes y Armarios',
    'Grabadores DVR y NVR',
    'Herramientas Manuales',
    'Iluminación de Emergencia',
    'Interruptores Diferenciales',
    'Lámparas y Bulbos LED',
    'Llaves de Luz y Módulos',
    'Paneles y Plafones LED',
    'Pilas y Baterías',
    'Porteros y Control de Acceso',
    'Pulsadores y Paradas de Emergencia',
    'Químicos y Consumibles de Taller',
    'Sensores y Detectores de Seguridad',
    'Sensores y Fines de Carrera',
    'Señalización y Ojos de Buey',
    'Sirenas y Señalizadores de Alarma',
    'Teclados, Controles y Comunicadores',
    'Temporizadores y Relojes',
  ],
  'Servicios': [
    'Accesorios Eléctricos Varios',
    'Conectores, Curvas y Accesorios de Caño',
    'Fijaciones y Accesorios',
    'Llaves de Luz y Módulos',
    'Logística y Transporte',
    'Mano de Obra',
    'Paneles y Plafones LED',
    'Porteros y Control de Acceso',
  ],
  'Tableros y Envolventes': [
    'Accesorios Eléctricos Varios',
    'Cajas de Embutir',
    'Cajas de Medidor y Pilares',
    'Cajas de Paso y Derivación',
    'Cajas Estancas',
    'Conectores, Curvas y Accesorios de Caño',
    'Gabinetes y Armarios',
    'Interruptores en Caja Moldeada',
    'Llaves de Luz y Módulos',
  ],
};

const PROVEEDORES_VENTAS = [
  {
    codigo: 'PV-001',
    razonSocial: 'Distribuidora Eléctrica Central S.A.',
    nombreFantasia: 'ElectroCentral',
    cuit: '30-71234567-9',
    condicionIva: 'Responsable Inscripto',
    telefono: '011-4567-8900',
    email: 'ventas@electrocentral.com.ar',
    provincia: 'Buenos Aires',
    localidad: 'CABA',
    activo: true,
  },
  {
    codigo: 'PV-002',
    razonSocial: 'Schneider Electric Argentina S.A.',
    nombreFantasia: 'Schneider Electric',
    cuit: '30-50123456-4',
    condicionIva: 'Responsable Inscripto',
    provincia: 'Buenos Aires',
    activo: true,
  },
  {
    codigo: 'PV-003',
    razonSocial: 'Prysmian Cables y Metales de Argentina S.A.',
    nombreFantasia: 'Prysmian Group',
    cuit: '30-50456789-1',
    condicionIva: 'Responsable Inscripto',
    provincia: 'Buenos Aires',
    activo: true,
  },
];

async function seedMaestrosVentas() {
  console.log('--- Iniciando Carga de Maestros Comerciales (Ventas) ---');

  // 1. Cargar Marcas
  console.log(`Cargando ${MARCAS.length} marcas...`);
  let marcasCount = 0;
  for (const nombre of MARCAS) {
    await prisma.marca.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre, activo: true },
    });
    marcasCount++;
  }
  console.log(`✔ ${marcasCount} marcas aseguradas.`);

  // 2. Cargar Familias y Subfamilias
  const familiasEntries = Object.entries(FAMILIAS_DATA);
  console.log(`Cargando ${familiasEntries.length} familias y sus subfamilias...`);
  let subfamiliasTotal = 0;

  for (const [nombreFamilia, subfamilias] of familiasEntries) {
    const familia = await prisma.familia.upsert({
      where: { nombre: nombreFamilia },
      update: { activo: true },
      create: { nombre: nombreFamilia, activo: true },
    });

    for (const nombreSub of subfamilias) {
      await prisma.subFamilia.upsert({
        where: {
          familiaId_nombre: {
            familiaId: familia.id,
            nombre: nombreSub,
          },
        },
        update: { activo: true },
        create: {
          familiaId: familia.id,
          nombre: nombreSub,
          activo: true,
        },
      });
      subfamiliasTotal++;
    }
  }
  console.log(`✔ ${familiasEntries.length} familias y ${subfamiliasTotal} subfamilias aseguradas.`);

  // 3. Cargar ProveedoresVentas
  console.log(`Cargando ${PROVEEDORES_VENTAS.length} proveedores de ventas...`);
  for (const p of PROVEEDORES_VENTAS) {
    await prisma.proveedorVentas.upsert({
      where: { codigo: p.codigo },
      update: {
        razonSocial: p.razonSocial,
        nombreFantasia: p.nombreFantasia,
        cuit: p.cuit,
        condicionIva: p.condicionIva,
        activo: true,
      },
      create: p,
    });
  }
  console.log(`✔ Proveedores de Ventas asegurados.`);

  console.log('--- Maestros Comerciales cargados exitosamente (Idempotente) ---');
}

seedMaestrosVentas()
  .catch((e) => {
    console.error('Error al cargar maestros comerciales:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
