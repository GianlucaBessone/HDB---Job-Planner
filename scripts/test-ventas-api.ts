import 'dotenv/config';
import fetch from 'node-fetch';
import { encrypt } from '../lib/auth';

async function testVentasEndpoints() {
  const baseUrl = 'http://localhost:3333';
  console.log('Testing Ventas API endpoints on', baseUrl);

  // Generate test session cookie
  const token = await encrypt({
    id: 'test-admin',
    role: 'ADMIN',
    nombreCompleto: 'Test Admin',
  });

  const headers = {
    cookie: `sgi_session=${token}`,
    'Content-Type': 'application/json',
  };

  // 1. Meta
  const metaRes = await fetch(`${baseUrl}/api/ventas/meta`, { headers });
  if (!metaRes.ok) {
    const errorText = await metaRes.text();
    throw new Error(`Meta endpoint failed: ${metaRes.status} ${metaRes.statusText} - ${errorText}`);
  }
  const meta: any = await metaRes.json();
  console.log(`✔ Meta endpoint returned:`);
  console.log(`   - Marcas: ${meta.marcas?.length} (Expected >= 87)`);
  console.log(`   - Familias: ${meta.familias?.length} (Expected 11)`);
  const totalSubfamilias = meta.familias?.reduce((acc: number, f: any) => acc + (f.subfamilias?.length || 0), 0);
  console.log(`   - Total Subfamilias: ${totalSubfamilias} (Expected 185)`);
  console.log(`   - Proveedores Ventas: ${meta.proveedores?.length}`);
  console.log(`   - Listas de Precios: ${meta.listasPrecios?.length}`);

  if (meta.marcas.length < 87) {
    throw new Error(`Marcas count is ${meta.marcas.length}, expected >= 87`);
  }
  if (meta.familias.length < 11) {
    throw new Error(`Familias count is ${meta.familias.length}, expected >= 11`);
  }
  if (totalSubfamilias < 185) {
    throw new Error(`Subfamilias count is ${totalSubfamilias}, expected >= 185`);
  }

  // 2. Sample family check
  const cablesFam = meta.familias.find((f: any) => f.nombre === 'Cables y Conductores');
  console.log(`✔ Familia 'Cables y Conductores' has ${cablesFam?.subfamilias?.length} subfamilias (Expected 13)`);
  if (!cablesFam || cablesFam.subfamilias.length !== 13) {
    throw new Error(`Cables y Conductores subfamilias mismatch`);
  }

  // 3. Sample brand check
  const hasSchneider = meta.marcas.some((m: any) => m.nombre === 'Schneider Electric');
  const hasSiemens = meta.marcas.some((m: any) => m.nombre === 'Siemens');
  const hasBaw = meta.marcas.some((m: any) => m.nombre === 'BAW');
  console.log(`✔ Key brands verified: Schneider (${hasSchneider}), Siemens (${hasSiemens}), BAW (${hasBaw})`);

  // 4. Products endpoint & create test
  const testMarca = meta.marcas.find((m: any) => m.nombre === 'Schneider Electric');
  const testSubFam = cablesFam.subfamilias[0];
  const testProv = meta.proveedores[0];
  const testAlm = meta.almacenes[0];

  console.log('Creating test product with new commercial masters...');
  const createRes = await fetch(`${baseUrl}/api/ventas/productos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sku: 'API-TEST-SCH-001',
      codigoBarras: '7798889991112',
      descripcion: 'Cable Unipolar Schneider 2.5mm Normalizado',
      marcaId: testMarca.id,
      familiaId: cablesFam.id,
      subFamiliaId: testSubFam.id,
      proveedorId: testProv.id,
      skuProveedor: 'SCH-CAB-001',
      costo: 25000,
      ivaId: meta.alicuotasIva[0]?.id,
      rentabilidad: 40,
      precioBase: 42350,
      almacenId: testAlm.id,
      stockActual: 100,
      stockMinimo: 20,
      stockMaximo: 500,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Product create failed: ${createRes.status} ${errText}`);
  }
  const created: any = await createRes.json();
  console.log(`✔ Product created via API: ID=${created.id}, SKU=${created.sku}`);

  // 5. Test Quick Price Update on created product
  const quickPriceRes = await fetch(`${baseUrl}/api/ventas/precios/ajuste-rapido`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      cambios: [
        { productoId: created.id, precioBase: 45000 },
      ],
    }),
  });
  if (!quickPriceRes.ok) throw new Error('Quick price update failed');
  const qpData: any = await quickPriceRes.json();
  console.log(`✔ Quick price API updated: ${qpData.modificados} product(s) to $45.000`);

  // 6. Verify product in list
  const prodRes = await fetch(`${baseUrl}/api/ventas/productos?q=API-TEST-SCH-001`, { headers });
  if (!prodRes.ok) throw new Error(`Productos endpoint failed: ${prodRes.statusText}`);
  const prodData: any = await prodRes.json();
  console.log(`✔ Search for created product found ${prodData.productos?.length} item(s)`);
  const foundProd = prodData.productos?.[0];
  console.log(`   Found Product: SKU=${foundProd?.sku}, precioBase=${foundProd?.precioBase}, Marca=${foundProd?.marca}, Familia=${foundProd?.familia}, SubFamilia=${foundProd?.subFamilia}`);
  if (foundProd?.precioBase !== 45000) {
    throw new Error(`Expected precioBase 45000 but got ${foundProd?.precioBase}`);
  }

  // 7. Cleanup test product (soft delete via DELETE endpoint)
  const delRes = await fetch(`${baseUrl}/api/ventas/productos/${created.id}`, {
    method: 'DELETE',
    headers,
  });
  if (!delRes.ok) throw new Error('Delete product failed');
  console.log(`✔ Test product soft-deleted successfully.`);

  console.log('\n🎉 All API checks and lifecycle flows passed successfully!');
}

testVentasEndpoints().catch((err) => {
  console.error('❌ API test failed:', err);
  process.exit(1);
});
