// Rastojanje za prikaz: "300 m", "1 km", "2,5 km"
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return meters + ' m';
  }

  const kilometers = meters / 1000;
  const text = Number.isInteger(kilometers) ? String(kilometers) : kilometers.toFixed(1);
  return text.replace('.', ',') + ' km';
}
