import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
console.log('PrismaClient exists and can be instantiated');
process.exit(0);
