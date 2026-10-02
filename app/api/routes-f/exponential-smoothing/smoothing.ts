export function exponentialSmooth(
  data: number[],
  alpha: number,
  forecastSteps: number
): { smoothed: number[]; forecast: number[] } {
  if (data.length === 0) {
    return { smoothed: [], forecast: Array.from({ length: forecastSteps }, () => 0) };
  }

  const smoothed: number[] = [data[0]];

  for (let i = 1; i < data.length; i += 1) {
    smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1]);
  }

  const lastLevel = smoothed[smoothed.length - 1];
  const forecast = Array.from({ length: forecastSteps }, () => lastLevel);

  return { smoothed, forecast };
}
