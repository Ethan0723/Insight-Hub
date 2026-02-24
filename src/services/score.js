export function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function combineFinalScore(baseline, delta) {
  return {
    subscription: clampScore(baseline.subscription + delta.subscription),
    commission: clampScore(baseline.commission + delta.commission),
    payment: clampScore(baseline.payment + delta.payment),
    ecosystem: clampScore(baseline.ecosystem + delta.ecosystem),
    overall: clampScore(baseline.overall + delta.overall)
  };
}
