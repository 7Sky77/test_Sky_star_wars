export function formatDiameterKm(km: number): string {
  return `${Math.floor(km).toLocaleString("ru-RU")} км`;
}

export function formatTemperatureRange(min: number, max: number): string {
  return `${min}…${max} °C`;
}
