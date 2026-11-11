import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "audio", "demo.wav");
mkdirSync(dirname(out), { recursive: true });

const RATE = 44100;
const DURATION = 64;
const BPM = 120;
const BEAT = 60 / BPM;
const N = RATE * DURATION;
const samples = new Float64Array(N);

function add(at, len, fn) {
  const start = Math.floor(at * RATE);
  const count = Math.min(Math.floor(len * RATE), N - start);
  for (let i = 0; i < count; i++) samples[start + i] += fn(i / RATE, i / count);
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

for (let t = 0; t < DURATION; t += BEAT) {
  add(t, 0.25, (s) => 0.55 * Math.sin(2 * Math.PI * (150 * Math.exp(-s * 18) + 45) * s) * Math.exp(-s * 14));
}
for (let t = BEAT / 2; t < DURATION; t += BEAT) {
  add(t, 0.06, (s) => 0.16 * (Math.random() * 2 - 1) * Math.exp(-s * 60));
}
for (let t = BEAT; t < DURATION; t += 2 * BEAT) {
  add(t, 0.12, (s) => 0.25 * (Math.random() * 2 - 1) * Math.exp(-s * 25) * Math.sin(2 * Math.PI * 1800 * s));
}

const bassLine = [36, 36, 43, 36, 34, 34, 41, 34, 39, 39, 46, 39, 34, 34, 41, 43];
for (let i = 0; i * BEAT < DURATION; i++) {
  const note = bassLine[i % bassLine.length];
  add(i * BEAT, BEAT * 0.9, (s) => 0.22 * Math.tanh(2.5 * Math.sin(2 * Math.PI * midi(note) * s)) * Math.min(1, s * 80) * Math.exp(-s * 3));
}

const melody = [72, 75, 79, 82, 79, 75, 72, 67, 70, 74, 77, 81, 77, 74, 70, 67];
for (let i = 0; i * BEAT < DURATION; i++) {
  if (i % 2 === 1) continue;
  const note = melody[(i / 2) % melody.length];
  const f = midi(note);
  add(i * BEAT, BEAT * 1.6, (s) =>
    0.12 * (Math.sin(2 * Math.PI * f * s) + 0.4 * Math.sin(2 * Math.PI * f * 2 * s)) * Math.min(1, s * 100) * Math.exp(-s * 2.2)
  );
}

for (let t = 16; t < DURATION; t += 8) {
  add(t, 1.5, (s, p) => 0.05 * (Math.random() * 2 - 1) * Math.sin(Math.PI * p));
}

const fade = Math.floor(1.5 * RATE);
for (let i = 0; i < N; i++) {
  if (i > N - fade) samples[i] *= (N - i) / fade;
  if (i < RATE * 0.2) samples[i] *= i / (RATE * 0.2);
}

const buf = Buffer.alloc(44 + N * 2);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 2, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(RATE, 24);
buf.writeUInt32LE(RATE * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
}
writeFileSync(out, buf);
console.log(`Wrote ${out} (${DURATION}s, ${RATE} Hz mono)`);