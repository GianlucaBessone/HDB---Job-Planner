const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const plannings = await prisma.planning.findMany();
    console.log(JSON.stringify(plannings, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
