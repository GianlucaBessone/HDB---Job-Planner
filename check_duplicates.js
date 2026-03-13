const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const operators = await prisma.operator.findMany({
        orderBy: { nombreCompleto: 'asc' }
    });
    
    console.log('--- All Operators ---');
    operators.forEach(o => {
        console.log(`${o.id} | ${o.nombreCompleto} | ${o.role}`);
    });

    console.log('\n--- Duplicate Names Check ---');
    const names = {};
    operators.forEach(o => {
        const name = o.nombreCompleto.toLowerCase().trim();
        if (!names[name]) names[name] = [];
        names[name].push(o.id);
    });

    for (const name in names) {
        if (names[name].length > 1) {
            console.log(`Duplicate found: "${name}" IDs: ${names[name].join(', ')}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
