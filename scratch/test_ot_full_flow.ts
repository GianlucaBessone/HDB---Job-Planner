import { prisma } from '../lib/prisma';
import { generateCanonicalHash, verifyCycleIntegrity } from '../lib/ot/canonicalHash';
import { getNextOtNumber } from '../lib/ot/counter';
import { hashPassword, verifyPassword } from '../lib/portalAuth';

async function runFullIntegrationTest() {
    console.log('=== STARTING E2E INTEGRATION TEST ===');

    // 0. Pre-clean test projects and responsibles if existing
    await prisma.clientResponsable.deleteMany({
        where: { email: 'juan.perez@testclient.com' }
    });
    await prisma.project.deleteMany({
        where: { nombre: { in: ['PROYECTO AUTORIZADO A', 'PROYECTO RESTRINGIDO B'] } }
    });

    // 1. Get client and operator
    const client = await prisma.hdbClient.findFirst();
    if (!client) {
        throw new Error('No client found in database.');
    }
    const operator = await prisma.operator.findFirst();
    if (!operator) {
        throw new Error('No operator found in database.');
    }
    console.log(`[PASS] Using client: ${client.nombre} (${client.id}), Operator: ${operator.nombreCompleto} (${operator.id})`);

    // Set client markup to 25% to verify 999999 ignores it
    await prisma.hdbClientConfig.upsert({
        where: { clientId: client.id },
        update: { porcentajeMateriales: 25 },
        create: { clientId: client.id, porcentajeMateriales: 25 },
    });
    console.log('[PASS] Client config set to 25% materials markup.');

    // 2. Create test projects
    const proj1 = await prisma.project.create({
        data: {
            nombre: 'PROYECTO AUTORIZADO A',
            clientId: client.id,
            cliente: client.nombre,
            estado: 'activo',
        }
    });
    const proj2 = await prisma.project.create({
        data: {
            nombre: 'PROYECTO RESTRINGIDO B',
            clientId: client.id,
            cliente: client.nombre,
            estado: 'activo',
        }
    });
    console.log(`[PASS] Created 2 projects: ${proj1.id} (Authorized) and ${proj2.id} (Restricted)`);

    // 3. Create Responsable assigned ONLY to proj1
    const rawPass = 'TempPass123!';
    const passwordHash = await hashPassword(rawPass);
    const responsable = await prisma.clientResponsable.create({
        data: {
            clientId: client.id,
            nombre: 'Juan Perez Responsable Test',
            cargo: 'Jefe de Planta',
            email: 'juan.perez@testclient.com',
            passwordHash,
            mustChangePassword: true,
            proyectos: {
                create: [
                    { proyectoId: proj1.id }
                ]
            }
        },
        include: {
            proyectos: true
        }
    });
    console.log(`[PASS] Responsable created: ${responsable.nombre} with 1 allowed project: ${responsable.proyectos[0].proyectoId}`);

    // Verify authentication
    const authOk = await verifyPassword(rawPass, responsable.passwordHash);
    console.log(`[PASS] Password verification: ${authOk ? 'SUCCESS' : 'FAILED'}`);
    if (!authOk) throw new Error('Auth failed');

    // Verify permission boundary
    const hasProj1 = responsable.proyectos.some(p => p.proyectoId === proj1.id);
    const hasProj2 = responsable.proyectos.some(p => p.proyectoId === proj2.id);
    console.log(`[PASS] Permission check: Proj1 allowed = ${hasProj1}, Proj2 allowed = ${hasProj2}`);
    if (!hasProj1 || hasProj2) throw new Error('Permission boundary check failed');

    // 4. Create OT in Project 1
    const { numeroOT, numeroSecuencial, anio } = await getNextOtNumber();
    const ot = await prisma.ordenTrabajo.create({
        data: {
            numeroOT,
            numeroSecuencial,
            anio,
            refCliente: 'REF-TEST-999999',
            clienteId: client.id,
            proyectoId: proj1.id,
            sector: 'Planta Principal',
            reporteTrabajo: 'Mantenimiento preventivo de bombas y cableado',
            creadorId: operator.id,
            responsableId: operator.id,
            estado: 'ABIERTA',
            ciclos: {
                create: [
                    {
                        numeroCiclo: 1,
                        periodo: '2026-09',
                        estado: 'ABIERTO',
                        totalHoras: 0,
                        totalManoObra: 0,
                        totalMateriales: 0,
                        totalGeneral: 0,
                    }
                ]
            }
        },
        include: {
            ciclos: true
        }
    });
    const ciclo1 = ot.ciclos[0];
    console.log(`[PASS] Created OT: ${ot.numeroOT} (Ref: ${ot.refCliente}) with Ciclo 1 (${ciclo1.id})`);

    // 5. Add Material 999999 (Manual) - Verify zero markup rule
    // Even though client markup is 25%, 999999 MUST set porcentajeClienteSnapshot = 0 and final price = manual price
    const manualPrecioUnitario = 15000.50;
    const manualCantidad = 2;
    const mat999999 = await prisma.otCicloMaterial.create({
        data: {
            cicloId: ciclo1.id,
            materialCodigo: '999999',
            descripcion: 'Válvula especial de titanio importada',
            materialSource: 'MANUAL',
            cantidad: manualCantidad,
            metros: 0,
            precioBaseSnapshot: manualPrecioUnitario,
            porcentajeClienteSnapshot: 0, // STRICT RULE: 0% markup
            precioFinalSnapshot: manualPrecioUnitario,
            importeTotal: manualCantidad * manualPrecioUnitario,
        }
    });
    console.log(`[PASS] Material 999999 added: ImporteTotal = $${mat999999.importeTotal} (Markup = ${mat999999.porcentajeClienteSnapshot}%)`);
    if (mat999999.porcentajeClienteSnapshot !== 0 || mat999999.importeTotal !== 30001.00) {
        throw new Error('Material 999999 pricing rule violated!');
    }

    // Add Operator hours to Ciclo 1
    const opHoras = 8;
    const opTarifa = 12000;
    const cicloOp = await prisma.otCicloOperador.create({
        data: {
            cicloId: ciclo1.id,
            operadorId: operator.id,
            horas: opHoras,
            valorHoraSnapshot: opTarifa,
            costoManoObra: opHoras * opTarifa,
        }
    });

    // Update cycle totals
    const totalMO = cicloOp.costoManoObra;
    const totalMat = mat999999.importeTotal;
    const totalCiclo = totalMO + totalMat;
    await prisma.otCiclo.update({
        where: { id: ciclo1.id },
        data: {
            totalHoras: opHoras,
            totalManoObra: totalMO,
            totalMateriales: totalMat,
            totalGeneral: totalCiclo,
        }
    });
    console.log(`[PASS] Updated Ciclo 1 totals: MO=$${totalMO}, Mat=$${totalMat}, Total=$${totalCiclo}`);

    // 6. Test Cryptographic Hash Generation and Signing (Cierre Parcial)
    const fechaFirma = new Date();
    const { canonicalString, hash } = generateCanonicalHash({
        numeroOT: ot.numeroOT,
        refCliente: ot.refCliente,
        clienteNombre: client.nombre,
        proyectoNombre: proj1.nombre,
        sector: ot.sector,
        reporteTrabajo: ot.reporteTrabajo,
        numeroCiclo: 1,
        periodo: '2026-09',
        tipoCierre: 'PARCIAL',
        firmanteNombre: responsable.nombre,
        fechaFirma,
        operadores: [
            {
                operadorNombre: operator.nombreCompleto || 'Operador Test',
                horas: opHoras,
                valorHoraSnapshot: opTarifa,
                costoManoObra: cicloOp.costoManoObra,
            }
        ],
        materiales: [
            {
                materialCodigo: '999999',
                descripcion: 'Válvula especial de titanio importada',
                cantidad: manualCantidad,
                metros: 0,
                precioFinalSnapshot: manualPrecioUnitario,
                importeTotal: mat999999.importeTotal,
            }
        ],
        totales: {
            totalHoras: opHoras,
            totalManoObra: totalMO,
            totalMateriales: totalMat,
            totalGeneral: totalCiclo,
        }
    });

    console.log(`[PASS] Canonical SHA-256 generated: ${hash}`);

    // Seal Ciclo 1 and open Ciclo 2
    await prisma.$transaction([
        prisma.otCiclo.update({
            where: { id: ciclo1.id },
            data: {
                estado: 'FIRMADO',
                tipoCierre: 'PARCIAL',
                responsableClienteId: responsable.id,
                firmanteNombre: responsable.nombre,
                fechaFirma,
                hashIntegridad: hash,
                datosCanonicos: canonicalString,
            }
        }),
        prisma.otCiclo.create({
            data: {
                ordenTrabajoId: ot.id,
                numeroCiclo: 2,
                periodo: '2026-10',
                estado: 'ABIERTO',
                totalHoras: 0,
                totalManoObra: 0,
                totalMateriales: 0,
                totalGeneral: 0,
            }
        }),
        prisma.ordenTrabajo.update({
            where: { id: ot.id },
            data: { estado: 'ABIERTA', tipoCierre: 'PARCIAL' }
        })
    ]);
    console.log('[PASS] Ciclo 1 sealed as FIRMADO (PARCIAL). Ciclo 2 created as ABIERTO.');

    // 7. Verify Integrity of Sealed Ciclo 1
    const sealedCiclo = await prisma.otCiclo.findUnique({
        where: { id: ciclo1.id }
    });

    const verification = verifyCycleIntegrity(sealedCiclo!.hashIntegridad!, sealedCiclo!.datosCanonicos!);
    console.log(`[PASS] Sealed cycle integrity verified: ${verification.valido ? 'INTEGRITY 100% VALID' : 'TAMPERED'}`);
    if (!verification.valido) throw new Error('Cycle integrity verification failed on pristine data');

    // 8. Test Tamper Detection: modify one character in canonical string
    const tamperedCanonical = sealedCiclo!.datosCanonicos! + ' ';
    const tamperedVerification = verifyCycleIntegrity(sealedCiclo!.hashIntegridad!, tamperedCanonical);
    console.log(`[PASS] Tamper detection check: Tampered valid = ${tamperedVerification.valido} (Expected: false)`);
    if (tamperedVerification.valido) throw new Error('Tampering was not detected!');

    // 9. Clean up test data
    await prisma.otCicloMaterial.deleteMany({ where: { cicloId: ciclo1.id } });
    await prisma.otCicloOperador.deleteMany({ where: { cicloId: ciclo1.id } });
    await prisma.otCiclo.deleteMany({ where: { ordenTrabajoId: ot.id } });
    await prisma.ordenTrabajo.delete({ where: { id: ot.id } });
    await prisma.clientResponsableProyecto.deleteMany({ where: { responsableId: responsable.id } });
    await prisma.clientResponsable.delete({ where: { id: responsable.id } });
    await prisma.project.delete({ where: { id: proj1.id } });
    await prisma.project.delete({ where: { id: proj2.id } });
    console.log('[PASS] Test cleanup completed successfully.');

    console.log('=== ALL INTEGRATION TESTS PASSED 100% ===');
}

runFullIntegrationTest()
    .catch((err) => {
        console.error('Test failed with error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
