export interface ChecklistTemplateItem {
    description: string;
}

export const CHECKLIST_TEMPLATES: Record<string, string[]> = {
    "Cableado": [
        "Canalización instalada correctamente",
        "Cable sin empalmes intermedios",
        "Fijación firme y ordenada",
        "Separación adecuada de líneas de potencia",
        "Curvaturas sin forzar cable",
        "Identificación en ambos extremos",
        "Prueba de continuidad realizada",
        "Prueba de red (si aplica)",
        "Sin cables expuestos"
    ],
    "Conexión Eléctrica": [
        "Térmica/disyuntor adecuado instalado",
        "Sección de cable correcta",
        "Conexiones firmes",
        "Borneras protegidas",
        "Puesta a tierra verificada",
        "Medición de tensión realizada",
        "Consumo dentro de rango",
        "Tablero cerrado y ordenado"
    ],
    "Configuración de Equipo": [
        "Equipo encendido correctamente",
        "Firmware actualizado",
        "IP configurada",
        "Usuario y contraseña creados",
        "Fecha y hora configuradas",
        "Grabación / almacenamiento activo",
        "Parámetros personalizados aplicados",
        "Test funcional realizado"
    ],
    "Instalación de Cámara": [
        "Soporte nivelado",
        "Tornillería firme",
        "Ángulo correctamente orientado",
        "Imagen enfocada",
        "IR / visión nocturna verificada",
        "Cable protegido contra agua",
        "Sellado realizado",
        "Vista confirmada con cliente"
    ],
    "Sistema de Alarma": [
        "Central correctamente alimentada",
        "Batería instalada",
        "Sensores vinculados",
        "Prueba de disparo realizada",
        "Sirena funcional",
        "Comunicación GSM/IP verificada",
        "Usuario capacitado",
        "Código de prueba eliminado"
    ],
    "Red / Internet": [
        "Router configurado",
        "DHCP operativo",
        "Dispositivos visibles en red",
        "Ping exitoso",
        "Acceso remoto probado",
        "WiFi configurado (SSID y clave)",
        "Señal dentro de rango aceptable"
    ],
    "Finalización de Trabajo": [
        "Área limpia",
        "Residuos retirados",
        "Equipos embalados",
        "Fotos finales tomadas",
        "Cliente notificado",
        "Observaciones cargadas"
    ],
    "Mantenimiento": [
        "Diagnóstico realizado",
        "Falla identificada",
        "Pieza reemplazada",
        "Ajustes realizados",
        "Sistema probado post intervención",
        "Informe cargado en sistema"
    ]
};
