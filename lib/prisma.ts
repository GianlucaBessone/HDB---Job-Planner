import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

if (globalForPrisma.prisma && (!(globalForPrisma.prisma as any).producto || !(globalForPrisma.prisma as any).categoria || !(globalForPrisma.prisma as any).unidadMedida)) {
  try {
    globalForPrisma.prisma.$disconnect();
  } catch {}
  delete (globalForPrisma as any).prisma;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

