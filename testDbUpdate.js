const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { recalcularAvanceOkr } = require('./lib/okrKpiEngine.ts'); // NO, cannot require TS directly like this in Node.
