export interface ChecklistTemplateItem {
    description: string;
}

export const CHECKLIST_TEMPLATES: Record<string, string[]> = {
    "Seguridad eléctrica": [
        "Uso de EPP dieléctrico verificado",
        "Ausencia de tensión comprobada antes de iniciar",
        "Bloqueo y etiquetado (LOTO) aplicado en tablero",
        "Verificación de puesta a tierra correcta",
        "Conexiones eléctricas firmes y aisladas",
        "Disyuntor diferencial y térmica probados",
        "Sin cables expuestos ni pelados al finalizar"
    ],
    "Trabajo en altura": [
        "Arnés de seguridad e inspección previa del mismo",
        "Punto de anclaje verificado y seguro",
        "Casco con barbijo colocado correctamente",
        "Línea de vida instalada y tensa (si aplica)",
        "Escalera o andamio nivelado y asegurado",
        "Perímetro de seguridad delimitado en suelo",
        "Herramientas aseguradas con cuerdas anticaídas"
    ],
    "Protocolo sanitario": [
        "Lavado de manos previo o sanitización con alcohol",
        "Uso de barbijo y guantes descartables según norma",
        "Desinfección de herramientas y zona de trabajo",
        "Limpieza de superficies de contacto en equipo",
        "Retiro de residuos patogénicos en bolsa cerrada",
        "Ventilación adecuada del espacio de trabajo"
    ],
    "Instalación dispenser": [
        "Ubicación nivelada y espacio de ventilación verificado",
        "Conexión a red de agua sin pérdidas ni goteos",
        "Filtros purificadores instalados y purgados",
        "Conexión eléctrica realizada con tierra operativa",
        "Prueba de temperatura (agua fría y caliente)",
        "Limpieza exterior del equipo realizada",
        "Instrucción de uso brindada al cliente"
    ],
    "Mantenimiento refrigeración": [
        "Limpieza de condensador y evaporador",
        "Medición de presión de gas refrigerante",
        "Control de fugas con detector o espuma",
        "Verificación de funcionamiento del motocompresor",
        "Control de termostato y corte automático",
        "Limpieza de bandeja de desagote",
        "Medición de consumo eléctrico en régimen"
    ]
};
