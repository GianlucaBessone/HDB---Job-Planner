async function testAjusteLotes() {
  const url = 'http://localhost:3333/api/ventas/precios/ajuste-lotes';

  // Test 1: Preview COSTO +10%
  console.log('--- Testing Preview COSTO +10% ---');
  const resPreview = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filtros: { q: '00003' },
      porcentaje: 10,
      tipoAjuste: 'COSTO',
      preview: true
    })
  });

  const dataPreview = await resPreview.json();
  console.log('Preview Result:', {
    cantidadProductos: dataPreview.cantidadProductos,
    tipoAjuste: dataPreview.tipoAjuste,
    sample: dataPreview.previsualizacion?.[0]
  });

  // Verify calculation:
  // costoActual = 599
  // +10% => nuevoCosto = 658.9
  // rentabilidad = 41.5% => nuevoPrecio = 658.9 * 1.415 = 932.34
  if (dataPreview.previsualizacion?.[0]) {
    const item = dataPreview.previsualizacion[0];
    console.log(`Costo: ${item.costoActual} -> ${item.nuevoCosto}`);
    console.log(`Rentabilidad: ${item.rentabilidad}%`);
    console.log(`Precio: ${item.precioActual} -> ${item.nuevoPrecio}`);
    console.log(`Expected nuevoPrecio: ${Math.round(item.nuevoCosto * 1.415 * 100) / 100}`);
  }
}

testAjusteLotes().catch(console.error);
