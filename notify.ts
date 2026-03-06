import { PrismaClient } from '@prisma/client';
import { sendPushNotification } from './lib/onesignal';

const prisma = new PrismaClient();

async function notify() {
  try {
    const ops = await prisma.operator.findMany({ where: { nombreCompleto: { contains: 'Gianluca' } } });
    if (ops.length > 0) {
      console.log('Sending push to:', ops[0].nombreCompleto, ops[0].id);
      await sendPushNotification({
         userIds: [ops[0].id],
         title: 'Actualización Completada',
         message: 'Los cambios pedidos han sido desplegados y ya se encuentran listos en Job Planner!',
      });
      console.log('Push sent!');
    } else {
      console.log('Gianluca not found.');
    }
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

notify();
