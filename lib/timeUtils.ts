export function calculateHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);

    // Round Entry (start) UP to the next multiple of 30 minutes
    const startMinsTotal = h1 * 60 + m1;
    const roundedStartMins = Math.ceil(startMinsTotal / 30) * 30;

    // Round Exit (end) DOWN to the previous multiple of 30 minutes
    let endMinsTotal = h2 * 60 + m2;

    // Handle overnight shifts for the purpose of rounding
    if (endMinsTotal < startMinsTotal) {
        endMinsTotal += 24 * 60;
    }

    const roundedEndMins = Math.floor(endMinsTotal / 30) * 30;

    const diffHours = (roundedEndMins - roundedStartMins) / 60;
    return Math.max(0, Math.round(diffHours * 100) / 100);
}
