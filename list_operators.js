const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const operators = await prisma.operator.findMany();
    console.log(JSON.stringify(operators, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
