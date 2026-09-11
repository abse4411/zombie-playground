/* ============================================================
 * 剧情对话系统 —— 打字机效果
 * ============================================================ */
const STORY = {
  active: false, queue: [], cur: null, typing: false,
  charIdx: 0, typeT: 0, onDone: null, els: {},

  init() {
    const $ = id => document.getElementById(id);
    this.els = { overlay: $('story-overlay'), speaker: $('dialog-speaker'), text: $('dialog-text') };
    this.els.overlay.addEventListener('click', () => this.advance());
    document.addEventListener('keydown', e => {
      if (this.active && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        this.advance();
      }
    });
  },

  play(lines, onDone) {
    this.active = true;
    this.queue = [...lines];
    this.onDone = onDone || null;
    this.els.overlay.classList.remove('hidden');
    AUDIO.resume();
    if (typeof GAME !== 'undefined' && GAME) INPUT.releaseLock();
    this._next();
  },

  _next() {
    if (!this.queue.length) return this._finish();
    this.cur = this.queue.shift();
    this.charIdx = 0;
    this.typing = true;
    this.typeT = 0;
    this.els.speaker.textContent = this.cur.s;
    this.els.text.textContent = '';
  },

  advance() {
    if (!this.active) return;
    if (this.typing) {
      this.typing = false;
      this.els.text.textContent = this.cur.t;
    } else {
      this._next();
    }
  },

  update(dt) {
    if (!this.active || !this.typing) return;
    this.typeT += dt;
    while (this.typeT > 0.024 && this.typing) {
      this.typeT -= 0.024;
      this.charIdx++;
      this.els.text.textContent = this.cur.t.slice(0, this.charIdx);
      if (this.charIdx >= this.cur.t.length) this.typing = false;
    }
  },

  _finish() {
    this.active = false;
    this.els.overlay.classList.add('hidden');
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  },
};
