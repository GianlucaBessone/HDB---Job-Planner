import { formatARS, parseARS } from '../lib/formatCurrency';
import { calculateSuggestedPrice, doesRuleApply } from '../lib/ventas/priceRules';

console.log('=== TEST FORMATO ARS ARGENTINA ===');

const testCases = [
  { input: 105000, expected: '$ 105.000,00' },
  { input: 1250.5, expected: '$ 1.250,50' },
  { input: 0, expected: '$ 0,00' },
  { input: '4500.99', expected: '$ 4.500,99' },
  { input: 1000000.25, expected: '$ 1.000.000,25' },
];

let allPassed = true;
testCases.forEach(({ input, expected }) => {
  const result = formatARS(input);
  const ok = result === expected;
  console.log(`formatARS(${input}) => "${result}" | Esperado: "${expected}" | ${ok ? '✅ OK' : '❌ FAIL'}`);
  if (!ok) allPassed = false;
});

console.log('\n=== TEST PARSE ARS ===');
const parseCases = [
  { input: '$ 1.250,50', expected: 1250.5 },
  { input: '105.000,00', expected: 105000 },
  { input: '1250.50', expected: 1250.5 },
];

parseCases.forEach(({ input, expected }) => {
  const result = parseARS(input);
  const ok = Math.abs(result - expected) < 0.001;
  console.log(`parseARS("${input}") => ${result} | Esperado: ${expected} | ${ok ? '✅ OK' : '❌ FAIL'}`);
  if (!ok) allPassed = false;
});

console.log('\n=== TEST REGLAS DE CÁLCULO DE PRECIOS ===');

// 1. % sobre costo
const listaPorcCosto = {
  id: 'lp_1',
  codigo: 'LISTA_COSTO_PLUS',
  nombre: 'Costo + 35%',
  orden: 1,
  tipoAjuste: 'PORCENTAJE_COSTO',
  valorAjuste: 35,
  aplicaA: 'TODOS',
};

const price1 = calculateSuggestedPrice(listaPorcCosto, { costo: 1000 }, {});
console.log('Costo 1000 + 35% =>', price1, price1 === 1350 ? '✅ OK' : '❌ FAIL');
if (price1 !== 1350) allPassed = false;

// 2. Margen sobre venta
const listaMargen = {
  id: 'lp_2',
  codigo: 'LISTA_MARGEN_30',
  nombre: 'Margen 30%',
  orden: 2,
  tipoAjuste: 'MARGEN_COSTO',
  valorAjuste: 30,
  aplicaA: 'TODOS',
};

const price2 = calculateSuggestedPrice(listaMargen, { costo: 700 }, {});
// 700 / (1 - 0.3) = 1000
console.log('Costo 700 con margen 30% =>', price2, price2 === 1000 ? '✅ OK' : '❌ FAIL');
if (price2 !== 1000) allPassed = false;

// 3. Descuento sobre base
const listaDesc = {
  id: 'lp_3',
  codigo: 'LISTA_DESC_15',
  nombre: 'Desc 15% sobre Lista 2',
  orden: 3,
  tipoAjuste: 'DESCUENTO_BASE',
  valorAjuste: 15,
  listaBaseId: 'lp_2',
  aplicaA: 'TODOS',
};

const price3 = calculateSuggestedPrice(listaDesc, { costo: 700 }, { lp_2: 1000 });
// 1000 - 15% = 850
console.log('Base 1000 con 15% descuento =>', price3, price3 === 850 ? '✅ OK' : '❌ FAIL');
if (price3 !== 850) allPassed = false;

// 4. Filtrado por familia
const listaFamilia = {
  id: 'lp_fam',
  codigo: 'SOLO_CABLES',
  nombre: 'Solo Cables',
  orden: 4,
  tipoAjuste: 'PORCENTAJE_COSTO',
  valorAjuste: 20,
  aplicaA: 'FAMILIA',
  familiaId: 'fam_cables',
};

const appliesCables = doesRuleApply(listaFamilia, { familiaId: 'fam_cables' });
const appliesIluminacion = doesRuleApply(listaFamilia, { familiaId: 'fam_ilum' });
console.log('Aplica a fam_cables:', appliesCables, appliesCables === true ? '✅ OK' : '❌ FAIL');
console.log('Aplica a fam_ilum:', appliesIluminacion, appliesIluminacion === false ? '✅ OK' : '❌ FAIL');

if (!appliesCables || appliesIluminacion) allPassed = false;

if (allPassed) {
  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE FORMATO ARS Y REGLAS DE PRECIOS PASARON EXITOSAMENTE!');
  process.exit(0);
} else {
  console.error('\n❌ Hubo errores en las pruebas.');
  process.exit(1);
}
