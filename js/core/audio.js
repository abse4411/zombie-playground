/* ============================================================
 * 音频系统 —— 全部音效由 WebAudio 实时合成，零外部资源
 * ============================================================ */
const AUDIO = {
  ctx: null, master: null, noise: null, volume: 0.8,
  _ambient: null,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { console.warn('音频初始化失败（将静音运行）:', e); }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; },
  // 距离衰减
  _dist(d) { return clamp(1 / (1 + d * 0.1), 0.05, 1); },

  /* ---------- 枪声：噪声脉冲 + 低频体感 ---------- */
  shot(freq, dur, boom, dist = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = this._dist(dist);
    const n = this.ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass';
    fl.frequency.setValueAtTime(Math.min(freq * 4, 8000), t);
    fl.frequency.exponentialRampToValueAtTime(280, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(fl); fl.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + dur + 0.03);
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(boom > 0.8 ? 95 : 130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + dur * 1.3);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.35 * boom * v, t); g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.4);
    o.connect(g2); g2.connect(this.master);
    o.start(t); o.stop(t + dur * 1.5);
  },

  /* ---------- 通用短音 ---------- */
  tone(freq, dur, type = 'sine', vol = 0.15, slideTo = 0, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },

  _noiseHit(freq, dur, vol, dist = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = this._dist(dist);
    const n = this.ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(fl); fl.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + dur + 0.02);
  },

  /* ---------- 具体音效 ---------- */
  melee(heavy) { this._noiseHit(heavy ? 900 : 1600, heavy ? 0.16 : 0.09, heavy ? 0.4 : 0.25); this.tone(heavy ? 140 : 220, 0.08, 'triangle', 0.12, 60); },
  hitFlesh(dist = 0) { this._noiseHit(480, 0.07, 0.5, dist); },
  headshot() { this.tone(1500, 0.07, 'sine', 0.22); this.tone(2100, 0.1, 'sine', 0.16, 0, 0.05); },
  reloadStart() { this.tone(500, 0.05, 'square', 0.1); this.tone(700, 0.05, 'square', 0.1, 0, 0.09); },
  reloadEnd() { this.tone(900, 0.06, 'square', 0.14); this.tone(1200, 0.05, 'square', 0.1, 0, 0.07); },
  emptyClick() { this.tone(1400, 0.03, 'square', 0.12); },
  weaponSwitch() { this._noiseHit(2400, 0.06, 0.2); },
  throwPin() { this.tone(1700, 0.05, 'sine', 0.15); },
  explode(dist = 0) {
    this._noiseHit(900, 0.7, 1.0, 0);
    this.tone(70, 0.8, 'sine', 0.6 * this._dist(dist), 28);
    this.tone(45, 1.1, 'sine', 0.4, 24, 0.05);
  },
  fireIgnite() { this._noiseHit(1800, 0.5, 0.4); },
  acidSpit(dist = 0) { this.tone(300, 0.25, 'sawtooth', 0.2 * this._dist(dist), 120); this._noiseHit(800, 0.2, 0.2, dist); },
  growl(dist = 0, pitch = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = this._dist(dist) * 0.5;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    const f = rand(65, 115) * pitch;
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * rand(0.75, 1.25), t + 0.45);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(v, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.6);
  },
  scream(dist = 0) {
    const v = this._dist(dist) * 0.5;
    this.tone(1250, 0.7, 'sawtooth', v, 500);
    this.tone(1600, 0.55, 'square', v * 0.5, 700, 0.08);
    this._noiseHit(3000, 0.5, 0.3 * this._dist(dist));
  },
  zombieDie(dist = 0, pitch = 1) { this.tone(rand(120, 160) * pitch, 0.35, 'sawtooth', 0.25 * this._dist(dist), 45); },
  playerHurt() { this.tone(110, 0.2, 'sawtooth', 0.3, 60); this._noiseHit(600, 0.15, 0.3); },
  heartbeat() { this.tone(55, 0.12, 'sine', 0.4); this.tone(50, 0.1, 'sine', 0.3, 0, 0.18); },

  /* ---------- 场景音效 ---------- */
  step(sprint) {
    if (!this.ctx) return;
    this._noiseHit(sprint ? 500 : 380, sprint ? 0.09 : 0.07, sprint ? 0.16 : 0.09);
    this.tone(rand(70, 95), 0.05, 'sine', 0.05);
  },
  dash() {
    this._noiseHit(2200, 0.22, 0.3);
    this.tone(320, 0.18, 'sine', 0.12, 620);
  },
  kick() {
    this._noiseHit(900, 0.12, 0.3);
    this.tone(180, 0.12, 'triangle', 0.18, 80);
  },
  impact() {
    this._noiseHit(420, 0.1, 0.5);
    this.tone(85, 0.14, 'sine', 0.3, 45);
  },
  dummyHit() { this.tone(1250, 0.06, 'sine', 0.14); },
  streak() { [880, 1100, 1320, 1760].forEach((f, i) => this.tone(f, 0.09, 'sine', 0.16, 0, i * 0.06)); },
  hordeHorn() {
    this.tone(98, 1.1, 'sawtooth', 0.2, 62);
    this.tone(147, 1.0, 'square', 0.12, 98, 0.15);
    this._noiseHit(300, 1.2, 0.2);
  },
  // 地狱犬嚎叫（狼群来袭预警）
  howl(dist = 0) {
    const v = this._dist(dist) * 0.5;
    this.tone(420, 0.9, 'sawtooth', v, 690);
    this.tone(660, 0.7, 'sine', v * 0.7, 290, 0.25);
    this._noiseHit(500, 0.8, 0.12 * this._dist(dist));
  },
  // 幽影耳语（隐形敌预警）
  whisper(dist = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = this._dist(dist) * 0.3;
    const n = this.ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(v, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 1.3);
    this.tone(1950, 0.9, 'sine', v * 0.4, 2300);
  },

  /* ---------- 火焰环境声（火场期间循环） ---------- */
  _fire: null,
  startFireLoop() {
    if (!this.ctx || this._fire) return;
    const n = this.ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.7;
    const g = this.ctx.createGain(); g.gain.value = 0.09;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 7;
    const lg = this.ctx.createGain(); lg.gain.value = 0.05;
    lfo.connect(lg); lg.connect(g.gain);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(); lfo.start();
    this._fire = { n, lfo, g };
  },
  stopFireLoop() {
    if (!this._fire) return;
    try { this._fire.n.stop(); this._fire.lfo.stop(); } catch (e) { }
    this._fire = null;
  },

  /* ---------- 紧张度分层（随场上丧尸数量增强） ---------- */
  _tension: null,
  startTension() {
    if (!this.ctx || this._tension) return;
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.7;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o1.start(); o2.start();
    this._tension = { o1, o2, f, g };
  },
  setTension(level) {
    if (!this._tension) return;
    const v = clamp(level, 0, 1);
    this._tension.g.gain.value = 0.006 + v * 0.045;
    this._tension.f.frequency.value = 180 + v * 750;
  },
  stopTension() {
    if (!this._tension) return;
    try { this._tension.o1.stop(); this._tension.o2.stop(); } catch (e) { }
    this._tension = null;
  },
  purchase() { this.tone(880, 0.07, 'sine', 0.2); this.tone(1320, 0.12, 'sine', 0.2, 0, 0.08); },
  denied() { this.tone(170, 0.16, 'sawtooth', 0.2, 120); },
  waveHorn() { this.tone(196, 0.35, 'square', 0.16); this.tone(147, 0.5, 'square', 0.16, 0, 0.32); },
  waveClear() { this.tone(523, 0.12, 'sine', 0.18); this.tone(659, 0.12, 'sine', 0.18, 0, 0.1); this.tone(784, 0.2, 'sine', 0.18, 0, 0.2); },
  victory() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.2, 0, i * 0.16)); },
  defeat() { [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.16, 0, i * 0.28)); },
  uiClick() { this.tone(660, 0.04, 'sine', 0.12); },

  /* ---------- 环境低鸣 ---------- */
  startAmbient() {
    if (!this.ctx || this._ambient) return;
    const o1 = this.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 48;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 49.5;
    const g = this.ctx.createGain(); g.gain.value = 0.035;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = this.ctx.createGain(); lg.gain.value = 0.015;
    lfo.connect(lg); lg.connect(g.gain);
    o1.connect(g); o2.connect(g); g.connect(this.master);
    o1.start(); o2.start(); lfo.start();
    this._ambient = { o1, o2, lfo, g };
    this.startTension();
  },
  stopAmbient() {
    if (!this._ambient) return;
    try { this._ambient.o1.stop(); this._ambient.o2.stop(); this._ambient.lfo.stop(); } catch (e) { }
    this._ambient = null;
    this.stopTension();
  },
};
