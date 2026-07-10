import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templates = [
  {
    name: 'Relevamiento Técnico',
    description: 'Informe inicial para detectar estado de instalaciones, riesgos y oportunidades.',
    isActive: true,
    pdfConfig: { orientation: 'portrait' },
    schema: {
      sections: [
        {
          id: 'objetivos',
          title: 'Objetivo y Estado Actual',
          fields: [
            { id: 'objetivo', label: 'Objetivo del Relevamiento', type: 'textarea', required: true },
            { id: 'estado_actual', label: 'Estado Actual', type: 'textarea', required: true }
          ]
        },
        {
          id: 'hallazgos',
          title: 'Hallazgos',
          fields: [
            { id: 'riesgos', label: 'Riesgos Detectados', type: 'textarea', required: false },
            { id: 'observaciones', label: 'Observaciones', type: 'textarea', required: false }
          ]
        },
        {
          id: 'conclusiones',
          title: 'Conclusiones',
          fields: [
            { id: 'recomendaciones', label: 'Recomendaciones', type: 'textarea', required: false },
            { id: 'materiales', label: 'Materiales Sugeridos', type: 'textarea', required: false }
          ]
        }
      ]
    }
  },
  {
    name: 'Mantenimiento Preventivo',
    description: 'Checklist y mediciones programadas para prevención de fallas.',
    isActive: true,
    pdfConfig: { orientation: 'portrait' },
    schema: {
      sections: [
        {
          id: 'checklist',
          title: 'Checklist de Tareas',
          fields: [
            { id: 'limpieza', label: 'Limpieza', type: 'status-select' },
            { id: 'ajuste_borneras', label: 'Ajuste de borneras', type: 'status-select' },
            { id: 'protecciones', label: 'Verificación de protecciones', type: 'status-select' },
            { id: 'ventiladores', label: 'Estado de ventiladores', type: 'status-select' },
            { id: 'cables', label: 'Estado de cables', type: 'status-select' },
            { id: 'tableros', label: 'Estado de tableros', type: 'status-select' },
            { id: 'plc', label: 'Estado de PLC', type: 'status-select' },
            { id: 'hmi', label: 'Estado HMI', type: 'status-select' },
            { id: 'temperaturas', label: 'Temperaturas', type: 'status-select' },
            { id: 'lubricacion', label: 'Lubricación', type: 'status-select' }
          ]
        },
        {
          id: 'final',
          title: 'Conclusión',
          fields: [
            { id: 'observaciones', label: 'Observaciones Generales', type: 'textarea', required: false }
          ]
        }
      ]
    }
  },
  {
    name: 'Mantenimiento Correctivo',
    description: 'Informe de reparación ante falla inesperada.',
    isActive: true,
    pdfConfig: { orientation: 'portrait' },
    schema: {
      sections: [
        {
          id: 'diagnostico',
          title: 'Diagnóstico',
          fields: [
            { id: 'problema_informado', label: 'Problema informado', type: 'textarea', required: true },
            { id: 'diagnostico_tecnico', label: 'Diagnóstico', type: 'textarea', required: true },
            { id: 'causa_raiz', label: 'Causa Raíz', type: 'textarea', required: false }
          ]
        },
        {
          id: 'reparacion',
          title: 'Reparación',
          fields: [
            { id: 'reparacion_realizada', label: 'Reparación realizada', type: 'textarea', required: true },
            { id: 'repuestos', label: 'Repuestos utilizados', type: 'textarea', required: false },
            { id: 'tiempo_fuera_servicio', label: 'Tiempo fuera de servicio (Horas)', type: 'number', required: false }
          ]
        },
        {
          id: 'recomendaciones',
          title: 'Recomendaciones',
          fields: [
            { id: 'recomendaciones_post', label: 'Recomendaciones', type: 'textarea', required: false }
          ]
        }
      ]
    }
  },
  {
    name: 'Mediciones Eléctricas',
    description: 'Tabla dinámica para agregar mediciones eléctricas sin límite.',
    isActive: true,
    pdfConfig: { orientation: 'landscape' },
    schema: {
      sections: [
        {
          id: 'mediciones',
          title: 'Mediciones (Ilimitadas)',
          fields: [
            {
              id: 'tabla_mediciones',
              label: 'Mediciones Registradas',
              type: 'table',
              columns: [
                { id: 'variable', label: 'Variable', type: 'text' },
                { id: 'valor', label: 'Valor', type: 'number' },
                { id: 'unidad', label: 'Unidad', type: 'text' },
                { id: 'instrumento', label: 'Instrumento utilizado', type: 'text' },
                { id: 'tolerancia', label: 'Tolerancia', type: 'text' },
                { id: 'resultado', label: 'Resultado', type: 'select', options: ['Aprobado', 'Rechazado'] },
                { id: 'observaciones', label: 'Observaciones', type: 'text' }
              ]
            }
          ]
        }
      ]
    }
  }
];

async function main() {
  console.log('Seeding Technical Report Templates...');
  for (const template of templates) {
    await prisma.technicalReportTemplate.upsert({
      where: { name: template.name },
      update: {
        description: template.description,
        isActive: template.isActive,
        pdfConfig: template.pdfConfig,
        schema: template.schema
      },
      create: template
    });
    console.log(`- Upserted: ${template.name}`);
  }
  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
