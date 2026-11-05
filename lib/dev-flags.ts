/**
 * Saklar khusus pengembangan untuk mensimulasikan database mati.
 * Tidak pernah aktif di production: semua fungsi langsung mengembalikan false.
 */

let simulateDbDown = false;

export function isDbSimulationOn(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return simulateDbDown;
}

export function setDbSimulation(on: boolean): void {
  if (process.env.NODE_ENV === "production") return;
  simulateDbDown = on;
}
