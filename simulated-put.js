const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateHours(start, end) {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);

    const startMinsTotal = h1 * 60 + m1;
    const roundedStartMins = Math.ceil(startMinsTotal / 30) * 30;

    let endMinsTotal = h2 * 60 + m2;
    if (endMinsTotal < startMinsTotal) endMinsTotal += 24 * 60;
    const roundedEndMins = Math.floor(endMinsTotal / 30) * 30;

    const diffHours = (roundedEndMins - roundedStartMins) / 60;
    return Math.max(0, Math.round(diffHours * 100) / 100);
}

async function run() {
  try {
    // Find an unconfirmed time entry
    const entry = await prisma.timeEntry.findFirst({
      where: {
        estadoConfirmado: false
      }
    });

    if (!entry) {
      console.log("No unconfirmed entries found.");
      return;
    }

    console.log("Found unconfirmed entry:", entry);

    // Simulate the PUT handler payload for confirming it
    const data = {
      id: entry.id,
      estadoConfirmado: true,
      requestUserId: "cmmf9qzvl003tw039xg6cdpzi", // Gianluca (Supervisor)
      requestUserRole: "supervisor"
    };

    const { id, projectId, causaRegistro, fecha, horaIngreso, horaEgreso, estadoConfirmado, isExtra, isDevolucion, descripcionDevolucion, requestUserId, requestUserRole } = data;

    // Simulate the existing check
    const existing = await prisma.timeEntry.findUnique({ where: { id } });
    console.log("Existing check:", !!existing);

    const oldProjectId = existing.projectId;
    const newCausa = causaRegistro !== undefined ? causaRegistro : existing.causaRegistro;
    const newProjectId = newCausa ? null : (projectId !== undefined ? projectId : oldProjectId);

    let horasTrabajadas = existing.horasTrabajadas;
    let newHoraIngreso = horaIngreso !== undefined ? horaIngreso : existing.horaIngreso;
    let newHoraEgreso = horaEgreso !== undefined ? horaEgreso : existing.horaEgreso;

    if (newHoraIngreso && newHoraEgreso) {
        horasTrabajadas = calculateHours(newHoraIngreso, newHoraEgreso);
    }

    const newIsDevolucion = isDevolucion !== undefined ? isDevolucion : existing.isDevolucion;
    const finalIsExtraForUpdate = newIsDevolucion ? false : (isExtra !== undefined ? isExtra : existing.isExtra);

    console.log("Updating timeEntry with:", {
        projectId: newProjectId,
        causaRegistro: newCausa || null,
        fecha: fecha !== undefined ? fecha : existing.fecha,
        horaIngreso: newHoraIngreso,
        horaEgreso: newHoraEgreso,
        horasTrabajadas,
        isExtra: finalIsExtraForUpdate,
        isDevolucion: newIsDevolucion,
        descripcionDevolucion: newIsDevolucion ? ((descripcionDevolucion !== undefined ? descripcionDevolucion?.trim() : existing.descripcionDevolucion) || null) : null,
        estadoConfirmado: estadoConfirmado !== undefined ? estadoConfirmado : existing.estadoConfirmado,
        confirmadoPorSupervisor: estadoConfirmado ? requestUserId : null
    });

    const updated = await prisma.timeEntry.update({
        where: { id },
        data: {
            projectId: newProjectId,
            causaRegistro: newCausa || null,
            fecha: fecha !== undefined ? fecha : existing.fecha,
            horaIngreso: newHoraIngreso,
            horaEgreso: newHoraEgreso,
            horasTrabajadas,
            isExtra: finalIsExtraForUpdate,
            isDevolucion: newIsDevolucion,
            descripcionDevolucion: newIsDevolucion ? ((descripcionDevolucion !== undefined ? descripcionDevolucion?.trim() : existing.descripcionDevolucion) || null) : null,
            estadoConfirmado: estadoConfirmado !== undefined ? estadoConfirmado : existing.estadoConfirmado,
            confirmadoPorSupervisor: estadoConfirmado ? requestUserId : null
        }
    });

    console.log("Updated timeEntry successfully.");

    const oldIsExtra = existing.isExtra;
    const newIsExtra = finalIsExtraForUpdate;
    const oldIsDevolucion = existing.isDevolucion;

    if (oldProjectId && newProjectId && oldProjectId === newProjectId) {
        const oldProjectImpact = oldIsDevolucion ? 0 : (oldIsExtra ? Math.ceil(existing.horasTrabajadas) * 2 : Math.ceil(existing.horasTrabajadas));
        const newProjectImpact = newIsDevolucion ? 0 : (newIsExtra ? Math.ceil(horasTrabajadas) * 2 : Math.ceil(horasTrabajadas));
        const deltaHours = newProjectImpact - oldProjectImpact;
        console.log(`Same project. deltaHours = ${deltaHours}`);
        if (deltaHours !== 0) {
            await prisma.project.update({
                where: { id: oldProjectId },
                data: { horasConsumidas: { increment: deltaHours } }
            });
        }
    } else {
        console.log("Project changed or switched");
        if (oldProjectId && existing.horasTrabajadas > 0 && !oldIsDevolucion) {
            const oldProjectImpact = oldIsExtra ? Math.ceil(existing.horasTrabajadas) * 2 : Math.ceil(existing.horasTrabajadas);
            await prisma.project.update({
                where: { id: oldProjectId },
                data: { horasConsumidas: { decrement: oldProjectImpact } }
            });
        }
        if (newProjectId && horasTrabajadas > 0 && !newIsDevolucion) {
            const newProjectImpact = newIsExtra ? Math.ceil(horasTrabajadas) * 2 : Math.ceil(horasTrabajadas);
            await prisma.project.update({
                where: { id: newProjectId },
                data: { horasConsumidas: { increment: newProjectImpact } }
            });
        }
    }

    console.log("Project hours adjusted successfully.");

  } catch (error) {
    console.error("SIMULATED PUT ERROR:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
