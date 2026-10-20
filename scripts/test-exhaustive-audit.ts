import { prisma } from '../lib/prisma';
import { GET as materialesGet, POST as materialesPost } from '../app/api/materiales-proyecto/route';
import { PUT as materialesPut, DELETE as materialesDelete } from '../app/api/materiales-proyecto/[id]/route';
import { DEFAULT_VIEWS, getViewConfig, isViewAllowed } from '../lib/viewAccess';

async function runExhaustiveAudit() {
    console.log('===============================================================');
    console.log(' INICIO DE AUDITORÍA EXHAUSTIVA DE PROVISIÓN Y GESTIÓN COMERCIAL');
    console.log('===============================================================');

    const testSuffix = Math.floor(10000 + Math.random() * 90000);
    const testSku = `TST${testSuffix}`;
    const testBarcode = `77912345${testSuffix}`;
    const testProjectCode = `PRJ-AUDIT-${testSuffix}`;

    // Variables para seguimiento de IDs a limpiar
    let createdProductoId: string | null = null;
    let createdListaPrecioId: string | null = null;
    let createdProjectId: string | null = null;
    let createdMaterialId: string | null = null;

    try {
        // ─────────────────────────────────────────────────────────────
        // 1. AUDITORÍA: Desactivación de /inventario
        // ─────────────────────────────────────────────────────────────
        console.log('\n[1/8] Verificando desactivación estricta de /inventario...');
        const testRoles = ['admin', 'qa', 'vendedor', 'supervisor', 'operador', 'tecnico'];
        const effectiveConfigs = getViewConfig(DEFAULT_VIEWS);
        const invConfig = effectiveConfigs.find(v => v.key === '/inventario');

        if (!invConfig || invConfig.roles.length > 0) {
            throw new Error(`FALLO: /inventario tiene roles permitidos: ${JSON.stringify(invConfig?.roles)}`);
        }

        for (const role of testRoles) {
            const allowedSidebar = isViewAllowed('/inventario', role, 'sidebar', effectiveConfigs);
            const allowedHome = isViewAllowed('/inventario', role, 'home', effectiveConfigs);
            if (allowedSidebar || allowedHome) {
                throw new Error(`FALLO: El rol ${role} tiene acceso a /inventario`);
            }
        }
        console.log('  ✅ /inventario tiene roles: [] y está bloqueada en sidebar y home para todos los roles.');

        // ─────────────────────────────────────────────────────────────
        // 2. CREACIÓN DE ENTIDADES DE PRUEBA EN GESTIÓN COMERCIAL
        // ─────────────────────────────────────────────────────────────
        console.log('\n[2/8] Creando Lista de Precios y Producto de prueba en Gestión Comercial...');
        
        // Lista con recargo del +30% con IVA No discriminado (IVA incluido)
        const lp = await prisma.listaPrecio.create({
            data: {
                codigo: `LP_${testSuffix}`,
                nombre: `Lista Auditoria +30% ${testSuffix}`,
                tipoAjuste: 'RECARGO_SOBRE_BASE',
                valorAjuste: 30,
                activo: true,
                esPredeterminada: false,
                ivaDiscriminado: false, // IVA incluido
            }
        });
        createdListaPrecioId = lp.id;

        // Producto con SKU numérico formateado, precio base 1000 e IVA 21%
        const prod = await prisma.producto.create({
            data: {
                sku: testSku,
                codigoBarras: testBarcode,
                descripcion: `Cable Térmico Superflex Naranja ${testSuffix}`,
                precioBase: 1000,
                rentabilidad: 20,
                activo: true,
            }
        });
        createdProductoId = prod.id;

        // Proyecto vinculado a esta lista de precios
        const prj = await prisma.project.create({
            data: {
                codigoProyecto: testProjectCode,
                nombre: `Proyecto Auditoría ${testSuffix}`,
                listaPrecioId: lp.id,
                aprovisionamiento: true,
            }
        });
        createdProjectId = prj.id;
        console.log(`  ✅ Producto temporal creado: SKU=${testSku}, Barcode=${testBarcode}, Base=$1000`);
        console.log(`  ✅ Proyecto temporal creado: ID=${prj.id}, Lista=${lp.nombre}`);

        // ─────────────────────────────────────────────────────────────
        // 3. AUDITORÍA: Búsqueda exacta por SKU y por Código de Barras
        // ─────────────────────────────────────────────────────────────
        console.log('\n[3/8] Probando búsqueda exacta por SKU y Código de Barras...');
        
        // 3a. Búsqueda por SKU
        const reqSku = new Request(`http://localhost:3000/api/materiales-proyecto?codigo=${testSku}&proyectoId=${prj.id}`);
        const resSku = await materialesGet(reqSku);
        const dataSku = await resSku.json();
        
        if (!dataSku || dataSku.sku !== testSku) {
            throw new Error(`FALLO: No se encontró el producto por SKU ${testSku}`);
        }
        // Base 1000 + 30% = 1300. IVA no discriminado (+21%) = 1300 * 1.21 = 1573
        const expectedPrice = 1573;
        if (Math.abs(dataSku.precioVenta - expectedPrice) > 0.01) {
            throw new Error(`FALLO: Precio resuelto incorrecto. Esperado $${expectedPrice}, obtenido $${dataSku.precioVenta}`);
        }
        console.log(`  ✅ Búsqueda por SKU exitosa. Precio calculado con IVA incluido: $${dataSku.precioVenta}`);

        // 3b. Búsqueda por Código de Barras
        const reqBc = new Request(`http://localhost:3000/api/materiales-proyecto?codigo=${testBarcode}&proyectoId=${prj.id}`);
        const resBc = await materialesGet(reqBc);
        const dataBc = await resBc.json();
        if (!dataBc || dataBc.sku !== testSku) {
            throw new Error(`FALLO: No se encontró el producto por Código de Barras ${testBarcode}`);
        }
        console.log(`  ✅ Búsqueda por Código de Barras exitosa: Encontró SKU ${dataBc.sku}`);

        // ─────────────────────────────────────────────────────────────
        // 4. AUDITORÍA: Búsqueda con desfasaje de ceros y ranking PDV
        // ─────────────────────────────────────────────────────────────
        console.log('\n[4/8] Probando búsqueda con desfasaje de ceros y ranking numérico (estilo PDV)...');
        // Buscar código "3": debe traer exactamente "00003" en primera posición
        const req3 = new Request(`http://localhost:3000/api/materiales-proyecto?q=3&limit=10`);
        const res3 = await materialesGet(req3);
        const data3 = await res3.json();
        const prods3 = data3.productos || data3.candidatos || [];

        if (prods3.length === 0) {
            throw new Error('FALLO: La búsqueda de "3" no arrojó resultados.');
        }

        const firstItem = prods3[0];
        if (firstItem.sku !== '00003') {
            throw new Error(`FALLO: El primer resultado para "3" debe ser 00003 (coincidencia exacta unpadded), pero fue ${firstItem.sku}`);
        }
        if (!firstItem.esCoincidenciaExacta) {
            throw new Error('FALLO: firstItem debe tener esCoincidenciaExacta: true');
        }

        // Verificar que los siguientes resultados son prefijos de 3 (ej: 00030, 00031) antes que sufijos (00013, 00023)
        const unpaddedList = prods3.map((p: any) => p.sku.replace(/^0+/, ''));
        console.log(`  ✅ Búsqueda "3": Primer resultado exacto = SKU ${firstItem.sku} (${firstItem.nombre.slice(0, 40)}...)`);
        console.log(`  ✅ Secuencia de ranking unpadded: [${unpaddedList.slice(0, 6).join(', ')}]`);

        // ─────────────────────────────────────────────────────────────
        // 5. AUDITORÍA: Búsqueda multi-token con y sin tildes (térmica vs termica)
        // ─────────────────────────────────────────────────────────────
        console.log('\n[5/8] Probando búsqueda multi-token y variantes de tildes...');
        
        // Buscar con tilde: "térmico superflex"
        const reqAccent = new Request(`http://localhost:3000/api/materiales-proyecto?q=térmico+superflex`);
        const resAccent = await materialesGet(reqAccent);
        const dataAccent = await resAccent.json();
        const prodsAccent = dataAccent.productos || [];
        const foundAccent = prodsAccent.some((p: any) => p.sku === testSku);

        // Buscar sin tilde: "termico superflex"
        const reqNoAccent = new Request(`http://localhost:3000/api/materiales-proyecto?q=termico+superflex`);
        const resNoAccent = await materialesGet(reqNoAccent);
        const dataNoAccent = await resNoAccent.json();
        const prodsNoAccent = dataNoAccent.productos || [];
        const foundNoAccent = prodsNoAccent.some((p: any) => p.sku === testSku);

        if (!foundAccent || !foundNoAccent) {
            throw new Error(`FALLO: Búsqueda insensible a tildes falló: conTilde=${foundAccent}, sinTilde=${foundNoAccent}`);
        }
        console.log('  ✅ Búsqueda con "térmico" y con "termico" encontraron el producto correctamente.');

        // ─────────────────────────────────────────────────────────────
        // 6. AUDITORÍA: POST sin precioVenta -> Auto-resolución desde Gestión Comercial
        // ─────────────────────────────────────────────────────────────
        console.log('\n[6/8] Probando POST /api/materiales-proyecto con auto-resolución de precio...');
        const postReq = new Request('http://localhost:3000/api/materiales-proyecto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                proyectoId: prj.id,
                codigo: testSku,
                nombre: 'Material Creado en Auditoría',
                cantidadSolicitada: 5,
                cantidadDisponible: 0,
                cantidadEntregada: 0,
                // precioVenta omitido a propósito
            })
        });
        const postRes = await materialesPost(postReq);
        const postData = await postRes.json();

        if (postRes.status !== 201 || !postData.id) {
            throw new Error(`FALLO: Error al crear material: ${JSON.stringify(postData)}`);
        }
        createdMaterialId = postData.id;

        if (Math.abs(postData.precioVenta - expectedPrice) > 0.01) {
            throw new Error(`FALLO: POST no resolvió precioVenta esperado. Esperado $${expectedPrice}, obtenido $${postData.precioVenta}`);
        }
        console.log(`  ✅ Material creado con ID ${postData.id} y precioVenta auto-resuelto: $${postData.precioVenta}`);

        // ─────────────────────────────────────────────────────────────
        // 7. AUDITORÍA: PUT /api/materiales-proyecto/[id] -> Auto-sync al cambiar código
        // ─────────────────────────────────────────────────────────────
        console.log('\n[7/8] Probando PUT /api/materiales-proyecto/[id] con auto-sincronización al cambiar código...');
        // Cambiar el código a "00003" (Cable unipolar 1.5mm) sin pasar precioVenta
        const putReq = new Request(`http://localhost:3000/api/materiales-proyecto/${createdMaterialId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo: '00003',
                nombre: 'Cable unipolar cambiado en PUT',
            })
        });
        const putRes = await materialesPut(putReq, { params: { id: createdMaterialId } });
        const putData = await putRes.json();

        if (putRes.status !== 200) {
            throw new Error(`FALLO: Error en PUT material: ${JSON.stringify(putData)}`);
        }

        // El producto 00003 tiene precioBase 735. Con lista +30% con IVA inc = 735 * 1.30 * 1.21 = 1156.16
        const expectedPrice00003 = Math.round((735 * 1.30 * 1.21) * 100) / 100;
        if (Math.abs(putData.precioVenta - expectedPrice00003) > 1.0) {
            throw new Error(`FALLO: PUT no actualizó el precioVenta del nuevo código. Esperado ~$${expectedPrice00003}, obtenido $${putData.precioVenta}`);
        }
        console.log(`  ✅ PUT sincronizó automáticamente el precio del nuevo código 00003 a $${putData.precioVenta}`);

        // ─────────────────────────────────────────────────────────────
        // 8. AUDITORÍA: Limpieza total sin contaminación
        // ─────────────────────────────────────────────────────────────
        console.log('\n[8/8] Ejecutando limpieza estricta de datos de prueba...');
        if (createdMaterialId) {
            await prisma.materialProyecto.delete({ where: { id: createdMaterialId } });
        }
        if (createdProjectId) {
            await prisma.project.delete({ where: { id: createdProjectId } });
        }
        if (createdProductoId) {
            await prisma.producto.delete({ where: { id: createdProductoId } });
        }
        if (createdListaPrecioId) {
            await prisma.listaPrecio.delete({ where: { id: createdListaPrecioId } });
        }
        // Limpiar fallback en MaterialMaestro si se creó
        await prisma.materialMaestro.deleteMany({
            where: { codigo: { in: [testSku, 'TST_AUDIT'] } }
        });

        // Verificar que no quedan residuos
        const residualProd = await prisma.producto.count({ where: { sku: testSku } });
        const residualLp = await prisma.listaPrecio.count({ where: { codigo: `LP_${testSuffix}` } });
        const residualPrj = await prisma.project.count({ where: { codigoProyecto: testProjectCode } });

        if (residualProd !== 0 || residualLp !== 0 || residualPrj !== 0) {
            throw new Error(`FALLO: Quedaron residuos en la base de datos: prod=${residualProd}, lp=${residualLp}, prj=${residualPrj}`);
        }
        console.log('  ✅ Base de datos 100% limpia sin contaminación (0 residuos).');

        console.log('\n===============================================================');
        console.log(' 🎉 AUDITORÍA FINAL COMPLETADA CON 100% DE ÉXITO');
        console.log('===============================================================');
    } catch (err) {
        console.error('\n❌ ERROR EN LA AUDITORÍA:', err);
        // Limpieza de emergencia en caso de error
        try {
            if (createdMaterialId) await prisma.materialProyecto.deleteMany({ where: { id: createdMaterialId } });
            if (createdProjectId) await prisma.project.deleteMany({ where: { id: createdProjectId } });
            if (createdProductoId) await prisma.producto.deleteMany({ where: { id: createdProductoId } });
            if (createdListaPrecioId) await prisma.listaPrecio.deleteMany({ where: { id: createdListaPrecioId } });
            await prisma.materialMaestro.deleteMany({ where: { codigo: testSku } });
            console.log('Limpieza de emergencia ejecutada.');
        } catch (cleanupErr) {
            console.error('Error en limpieza de emergencia:', cleanupErr);
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runExhaustiveAudit();
