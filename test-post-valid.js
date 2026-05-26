const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const http = require('http');

async function main() {
    const project = await prisma.project.findFirst();
    const operator = await prisma.operator.findFirst();
    
    if (!project || !operator) {
        console.log("No valid project or operator found");
        process.exit(1);
    }

    const data = JSON.stringify({
      projectId: project.id,
      reporte: "Prueba error OS válida",
      operadores: [{ operadorId: operator.id, horas: 1, isExtra: false }],
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
}
main();
