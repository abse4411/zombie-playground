/* ============================================================
 * 输入系统 —— 键鼠 + 指针锁定
 * ============================================================ */
const INPUT = {
  keys: {},            // 按住状态 { code: true }
  _pressed: {},        // 本帧刚按下 { code: true }
  dx: 0, dy: 0,        // 本帧鼠标位移
  lmb: false, rmb: false, lmbEdge: false,
  wheel: 0,
  locked: false,

  init(canvas) {
    this.canvas = canvas;

    document.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this._pressed[e.code] = true;
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      // 对局中拦截刷新/关闭快捷键（v7.1）：F5/Ctrl+R 可真正拦截；Ctrl+W 是浏览器保留键尽力拦截
      if (typeof GAME !== 'undefined' && GAME && (GAME.state === 'playing' || GAME.state === 'paused')) {
        if (e.code === 'F5' || ((e.ctrlKey || e.metaKey) && (e.code === 'KeyR' || e.code === 'KeyW'))) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });
    document.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.lmb = false; this.rmb = false; });

    document.addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) { this.lmb = true; this.lmbEdge = true; }
      if (e.button === 2) this.rmb = true;
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) this.lmb = false;
      if (e.button === 2) this.rmb = false;
    });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.dx += e.movementX || 0;
      this.dy += e.movementY || 0;
    });
    document.addEventListener('wheel', e => {
      if (this.locked) this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('contextmenu', e => {
      if (this.locked) e.preventDefault();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.lmb = false; this.rmb = false; }
      if (typeof GAME !== 'undefined' && GAME) GAME.onPointerLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      console.warn('指针锁定失败');
    });
  },

  requestLock() {
    if (this.canvas && !this.locked) {
      try { this.canvas.requestPointerLock(); } catch (e) { }
    }
  },
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); },

  isDown(code) { return !!this.keys[code]; },
  justPressed(code) { return !!this._pressed[code]; },
  consumeMouse() { const r = { dx: this.dx, dy: this.dy }; this.dx = 0; this.dy = 0; return r; },
  consumeLmb() { const v = this.lmbEdge; this.lmbEdge = false; return v; },
  consumeWheel() { const v = this.wheel; this.wheel = 0; return v; },
  endFrame() { this._pressed = {}; },
};
