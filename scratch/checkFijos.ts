import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const fijos = await prisma.project.findMany({ where: { proyectoFijo: true } });
    console.log(`Found ${fijos.length} fijos`);
    if (fijos.length > 0) {
        console.log(fijos[0]);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
