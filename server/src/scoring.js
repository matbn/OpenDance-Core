const RATINGS = [
  { min: 0.85, rating: "perfect", factor: 1 },
  { min: 0.6, rating: "good", factor: 0.75 },
  { min: 0.35, rating: "ok", factor: 0.5 },
  { min: 0, rating: "miss", factor: 0 }
];

function cosine(u, v) {
  let dot = 0, nu = 0, nv = 0;
  for (let i = 0; i < 3; i++) {
    dot += u[i] * v[i];
    nu += u[i] * u[i];
    nv += v[i] * v[i];
  }
  if (nu < 1e-9 || nv < 1e-9) return 0;
  return dot / Math.sqrt(nu * nv);
}

function windowFeatures(samples, windowDuration) {
  const n = samples.length;
  const meanA = [0, 0, 0];
  const meanG = [0, 0, 0];
  let sumSq = 0;
  for (const s of samples) {
    for (let i = 0; i < 3; i++) {
      meanA[i] += s.a[i];
      meanG[i] += s.g[i];
      sumSq += s.a[i] * s.a[i];
    }
  }
  for (let i = 0; i < 3; i++) {
    meanA[i] /= n;
    meanG[i] /= n;
  }
  const rms = Math.sqrt(sumSq / n);

  const variance = [0, 0, 0];
  for (const s of samples) {
    for (let i = 0; i < 3; i++) variance[i] += (s.a[i] - meanA[i]) ** 2;
  }
  const axis = variance.indexOf(Math.max(...variance));
  let crossings = 0;
  for (let i = 1; i < n; i++) {
    const prev = samples[i - 1].a[axis] - meanA[axis];
    const curr = samples[i].a[axis] - meanA[axis];
    if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) crossings++;
  }
  const crossingRate = crossings / Math.max(windowDuration, 0.1);
  return { meanA, meanG, rms, crossingRate };
}

export function scoreWindow(samples, signature, windowDuration) {
  if (samples.length < 3) return 0;
  const { meanA, meanG, rms, crossingRate } = windowFeatures(samples, windowDuration);
  if (rms < 0.3) return 0;

  const parts = [];
  if (signature.dir) parts.push((cosine(meanA, signature.dir) + 1) / 2);
  if (signature.gyro) parts.push((cosine(meanG, signature.gyro) + 1) / 2);
  parts.push(Math.min(1, rms / signature.minEnergy));
  if (signature.shake) parts.push(Math.min(1, crossingRate / 2));
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function ratingFor(score) {
  return RATINGS.find((r) => score >= r.min);
}