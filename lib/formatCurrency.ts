/**
 * Formato de moneda ARS Argentina:
 * Punto (.) para separar miles y coma (,) para separar centavos.
 * Ejemplo: $ 1.250,50 o $ 105.000,00
 */
export function formatARS(
  val: number | string | null | undefined,
  includeSymbol: boolean = true
): string {
  if (val === null || val === undefined || val === '') {
    return includeSymbol ? '$ 0,00' : '0,00';
  }

  const num = typeof val === 'number' ? val : parseExcelNumber(val);
  if (isNaN(num) || !isFinite(num)) {
    return includeSymbol ? '$ 0,00' : '0,00';
  }

  const formatted = num.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return includeSymbol ? `$ ${formatted}` : formatted;
}

/**
 * Parsea un número proveniente de Excel, API o entrada de usuario.
 * Soporta de manera robusta:
 * - Números en formato flotante IEEE-754 con ruido binario (ej. 8096.199989474939 -> 8096.20)
 * - Formato anglosajón/US (ej. "$ 8,096.20" o "8,096.20")
 * - Formato hispano/argentino (ej. "$ 8.096,20" o "8.096,20")
 * - Formato plano con coma o punto (ej. "8096.20" o "8096,20")
 */
export function parseExcelNumber(val: any, decimals: number = 2): number {
  if (val === null || val === undefined || val === '') return 0;

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Number(val.toFixed(decimals));
  }

  let str = String(val).trim();
  // Limpiar signos monetarios y caracteres que no sean dígitos, puntos, comas o signo negativo
  str = str.replace(/[^0-9.,-]/g, '');
  if (!str) return 0;

  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      // Formato US: "8,096.20" -> la coma separa miles, el punto separa decimales
      str = str.replace(/,/g, '');
    } else {
      // Formato AR/ES: "8.096,20" -> el punto separa miles, la coma separa decimales
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma !== -1) {
    // Solo coma presente: "8096,20"
    str = str.replace(',', '.');
  } else if (lastDot !== -1) {
    // Solo punto presente: e.g. "8096.20" o "1.000.000"
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Number(num.toFixed(decimals));
}

/**
 * Parsea un string con formato numérico latino o estándar a float.
 */
export function parseARS(val: string | number | null | undefined): number {
  return parseExcelNumber(val, 2);
}
