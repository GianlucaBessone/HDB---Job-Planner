export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const expectedPhi = (lat2 - lat1) * Math.PI / 180;
    const expectedLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(expectedPhi / 2) * Math.sin(expectedPhi / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(expectedLambda / 2) * Math.sin(expectedLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
