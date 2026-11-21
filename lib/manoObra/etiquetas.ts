/** Origen del valor hora según la regla de tarifas (P20). Sin dependencias de servidor: se usa en pantallas. */
export type OrigenTarifa = 'excepcion_persona' | 'cliente_categoria' | 'categoria' | 'por_defecto';

export const ETIQUETA_ORIGEN_TARIFA: Record<OrigenTarifa, string> = {
    excepcion_persona: 'Excepción del cliente',
    cliente_categoria: 'Valor del cliente',
    categoria: 'Categoría',
    por_defecto: 'Valor por defecto',
};
