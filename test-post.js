const http = require('http');

const data = JSON.stringify({
  projectId: "dummy_project",
  reporte: "Prueba error OS",
  operadores: [{ operadorId: "op_123", horas: 1, isExtra: false }],
  materiales: [],
  comentario: "Test"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/ordenes-servicio',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, '\nBody:', body));
});

req.on('error', (e) => console.error('Problem with request:', e.message));
req.write(data);
req.end();
