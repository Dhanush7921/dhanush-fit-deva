// Procedural, original sound design (no samples): low industrial drone, wind, impact, whoosh, riser.
// Muted by default; the AudioContext is only created after the user unmutes (a user gesture).
type Fn = () => void;

class SoundEngine {
  muted = true;
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private subs = new Set<Fn>();

  subscribe = (f: Fn) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  getMuted = () => this.muted;

  private ensure() {
    if (this.ctx) return;
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return;
    const ctx = (this.ctx = new C());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.drone();
  }

  private drone() {
    const ctx = this.ctx!, out = this.master!;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170;
    const g = ctx.createGain(); g.gain.value = 0.16;
    for (const f of [55, 55.35, 82.4]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    lp.connect(g).connect(out);
    const n = ctx.createBufferSource(); n.buffer = this.noise!; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 220; lfo.connect(lg).connect(bp.frequency); lfo.start();
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    n.connect(bp).connect(ng).connect(out); n.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!m) { this.ensure(); this.ctx?.resume(); }
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, t, 0.35);
    }
    this.subs.forEach((f) => f());
  }
  toggle = () => this.setMuted(!this.muted);

  private live() { return !this.muted && this.ctx && this.master ? this.ctx : null; }

  impact() {
    const ctx = this.live(); if (!ctx) return;
    const t = ctx.currentTime, out = this.master!;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(26, t + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(g).connect(out); o.start(t); o.stop(t + 1.7);
    const n = ctx.createBufferSource(); n.buffer = this.noise!;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(160, t + 1.0);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.7, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    n.connect(lp).connect(ng).connect(out); n.start(t); n.stop(t + 1.2);
  }

  whoosh(dur = 2.4) {
    const ctx = this.live(); if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = this.noise!; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.55); bp.frequency.exponentialRampToValueAtTime(320, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(bp).connect(g).connect(this.master!); n.start(t); n.stop(t + dur + 0.05);
  }

  riser(dur = 0.9) {
    const ctx = this.live(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(420, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(3000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.18, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    o.connect(lp).connect(g).connect(this.master!); o.start(t); o.stop(t + dur + 0.1);
  }
}

export const sound = new SoundEngine();
