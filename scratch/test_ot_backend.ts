import { prisma } from '../lib/prisma';
import { generateOtNumber } from '../lib/ot/counter';
import { generateCanonicalHash, verifyCycleIntegrity } from '../lib/ot/canonicalHash';
import { generateInitialPassword, hashPassword, verifyPassword } from '../lib/portalAuth';

async function testBackend() {
  console.log('=== TEST 1: Counter ===');
  const { numeroOT, numeroSecuencial, anio } = await generateOtNumber();
  console.log('Generated OT number:', { numeroOT, numeroSecuencial, anio });

  console.log('=== TEST 2: Password hashing ===');
  const initialPass = generateInitialPassword(8);
  console.log('Generated initial password:', initialPass);
  const hash = await hashPassword(initialPass);
  const passValid = await verifyPassword(initialPass, hash);
  console.log('Password valid:', passValid);

  console.log('=== TEST 3: Canonical Hash and Verification ===');
  const testData = {
    numeroOT: 'OT-2026-0001',
    refCliente: 'OS-45872',
    clienteNombre: 'Arcor S.A.',
    proyectoNombre: 'Mantenimiento Central',
    sector: 'Planta Producción',
    reporteTrabajo: 'Reparación de tablero principal',
    numeroCiclo: 1,
    periodo: '2026-09',
    tipoCierre: 'PARCIAL',
    firmanteNombre: 'Juan Pérez',
    fechaFirma: new Date('2026-09-18T10:00:00Z'),
    operadores: [
      { operadorNombre: 'Carlos Gómez', horas: 4.5, valorHoraSnapshot: 10000, costoManoObra: 45000 },
      { operadorNombre: 'Ana López', horas: 2.0, valorHoraSnapshot: 12000, costoManoObra: 24000 },
    ],
    materiales: [
      { materialCodigo: '999999', descripcion: 'Fuente 24V switching', cantidad: 1, metros: null, precioFinalSnapshot: 85000, importeTotal: 85000 },
    ],
    totales: {
      totalHoras: 6.5,
      totalManoObra: 69000,
      totalMateriales: 85000,
      totalGeneral: 154000,
    },
  };

  const { canonicalString, hash: canonHash } = generateCanonicalHash(testData);
  console.log('Canonical Hash:', canonHash);
  const integrityResult = verifyCycleIntegrity(canonHash, canonicalString);
  console.log('Integrity verification (clean):', integrityResult.valido);

  const tamperedString = canonicalString.replace('154000.00', '154000.01');
  const tamperedResult = verifyCycleIntegrity(canonHash, tamperedString);
  console.log('Integrity verification (tampered - must be false):', tamperedResult.valido);

  console.log('ALL TESTS PASSED SUCCESSFULLY!');
}

testBackend()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
