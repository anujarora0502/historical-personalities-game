// Tiny Web Audio synthesiser for UI and world sound effects. No audio files
// are needed: every sound is generated on the fly.

let context = null;
let master = null;
let muted = false;
let noiseBuffer = null;

export function initAudio() {
  if (context) {
    if (context.state === 'suspended') context.resume();
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  context = new AudioCtx();
  master = context.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(context.destination);
  noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, context.currentTime, 0.05);
  return muted;
}

export const isMuted = () => muted;

function tone(frequency, { start = 0, duration = 0.2, type = 'sine', volume = 0.3, glide = null } = {}) {
  if (!context) return;
  const time = context.currentTime + start;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  if (glide) oscillator.frequency.exponentialRampToValueAtTime(glide, time + duration);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  oscillator.connect(gain).connect(master);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.05);
}

function noise({ start = 0, duration = 0.08, volume = 0.2, frequency = 900, q = 0.8 } = {}) {
  if (!context) return;
  const time = context.currentTime + start;
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = context.createGain();
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter).connect(gain).connect(master);
  source.start(time, Math.random() * 0.5);
  source.stop(time + duration + 0.02);
}

export const sfx = {
  click() { tone(660, { duration: 0.06, type: 'triangle', volume: 0.12 }); },
  hover() { tone(880, { duration: 0.04, type: 'sine', volume: 0.05 }); },
  open() { tone(392, { duration: 0.12, type: 'triangle', volume: 0.12 }); tone(587, { start: 0.06, duration: 0.14, type: 'triangle', volume: 0.1 }); },
  close() { tone(587, { duration: 0.1, type: 'triangle', volume: 0.1 }); tone(392, { start: 0.05, duration: 0.12, type: 'triangle', volume: 0.08 }); },
  collect() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { start: i * 0.07, duration: 0.5, type: 'sine', volume: 0.18 }));
    tone(2093, { start: 0.28, duration: 0.8, type: 'sine', volume: 0.05 });
  },
  objective() { tone(698.46, { duration: 0.18, type: 'triangle', volume: 0.14 }); tone(880, { start: 0.1, duration: 0.3, type: 'triangle', volume: 0.14 }); },
  success() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, { start: i * 0.11, duration: 0.35, type: 'triangle', volume: 0.16 }));
    tone(261.63, { duration: 0.9, type: 'sine', volume: 0.12 });
  },
  fanfare() {
    const melody = [[392, 0], [523.25, 0.15], [659.25, 0.3], [783.99, 0.45], [659.25, 0.7], [783.99, 0.85], [1046.5, 1.0]];
    melody.forEach(([f, t]) => tone(f, { start: t, duration: t === 1.0 ? 1.4 : 0.3, type: 'triangle', volume: 0.18 }));
    [261.63, 329.63, 392].forEach((f) => tone(f, { start: 1.0, duration: 1.6, type: 'sine', volume: 0.09 }));
  },
  correct() { tone(784, { duration: 0.12, type: 'triangle', volume: 0.14 }); tone(1047, { start: 0.08, duration: 0.25, type: 'triangle', volume: 0.14 }); },
  wrong() { tone(220, { duration: 0.28, type: 'sawtooth', volume: 0.07, glide: 160 }); },
  shutter() { noise({ duration: 0.05, volume: 0.35, frequency: 3000, q: 0.5 }); noise({ start: 0.07, duration: 0.07, volume: 0.25, frequency: 1800, q: 0.5 }); },
  step(surface = 'stone') {
    if (surface === 'grass') noise({ duration: 0.09, volume: 0.07, frequency: 700, q: 0.6 });
    else noise({ duration: 0.05, volume: 0.1, frequency: 1500 + Math.random() * 300, q: 1.4 });
  },
  whoosh() { noise({ duration: 0.6, volume: 0.12, frequency: 500, q: 0.4 }); },
};
