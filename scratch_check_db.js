const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const counts = await prisma.materialProyecto.groupBy({
        by: ['estado'],
        _count: {
            id: true
        }
    });
    console.log("Global states distribution:", counts);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
