// audio.js — synthesized sound effects for SKYBLADE ARENA.
// Everything is generated with the Web Audio API (no audio files). The
// AudioContext is created lazily on the first user gesture so autoplay
// policies never block the game.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.padNodes = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startPad();
      return true;
    } catch (e) {
      return false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // Soft ambient pad: two detuned triangle oscillators + slow LFO.
  startPad() {
    if (!this.ctx || this.padNodes) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const o1 = this.ctx.createOscillator();
    o1.type = 'triangle'; o1.frequency.value = 110;
    const o2 = this.ctx.createOscillator();
    o2.type = 'triangle'; o2.frequency.value = 164.8;
    const o3 = this.ctx.createOscillator();
    o3.type = 'sine'; o3.frequency.value = 220;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    o1.connect(g); o2.connect(g); o3.connect(g);
    g.connect(this.master);
    o1.start(); o2.start(); o3.start(); lfo.start();
    this.padNodes = { g, o1, o2, o3, lfo };
  }

  _tone(freq, dur, type = 'sine', vol = 0.25, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol = 0.3, filterFreq = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = filterFreq; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  slash() { this._noise(0.14, 0.35, 2600); this._tone(720, 0.12, 'sawtooth', 0.10, 180); }
  bolt() { this._tone(880, 0.16, 'square', 0.14, 220); this._noise(0.08, 0.15, 3200); }
  hit() { this._tone(190, 0.09, 'triangle', 0.3, 90); this._noise(0.06, 0.2, 900); }
  enemyDie() { this._tone(520, 0.28, 'square', 0.16, 70); this._noise(0.2, 0.22, 700); }
  hurt() { this._tone(140, 0.25, 'sawtooth', 0.3, 60); this._noise(0.15, 0.25, 400); }
  dash() { this._noise(0.18, 0.2, 1800); this._tone(300, 0.18, 'sine', 0.12, 620); }
  waveClear() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.2, null, i * 0.09));
  }
  upgrade() { [392, 523, 659].forEach((f, i) => this._tone(f, 0.18, 'sine', 0.2, null, i * 0.07)); }
  bossRoar() {
    this._tone(70, 0.9, 'sawtooth', 0.35, 45);
    this._tone(105, 0.9, 'sawtooth', 0.22, 55, 0.05);
    this._noise(0.8, 0.2, 300, 0.05);
  }
  bossHit() { this._tone(120, 0.15, 'square', 0.25, 70); }
  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.3, 'triangle', 0.22, null, i * 0.11));
  }
  defeat() {
    [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.35, 'sawtooth', 0.16, null, i * 0.16));
  }
  click() { this._tone(660, 0.06, 'sine', 0.18); }
}
