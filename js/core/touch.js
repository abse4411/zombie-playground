/* ============================================================
 * 触屏控制系统 —— 手机 / 平板
 * 浮动摇杆 + 右半屏滑动视角 + 实体按键
 * ============================================================ */
const TOUCH = {
  active: false,
  _stickId: null, _lookId: null,
  _stickOrigin: { x: 0, y: 0 },
  _lookLast: { x: 0, y: 0 },

  init() {
    const isTouch = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches);
    if (isTouch) this.enable();
  },

  enable() {
    if (this.active) return;
    this.active = true;
    INPUT.touch = true;
    document.body.classList.add('touch');

    const $ = id => document.getElementById(id);
    const stickZone = $('touch-stick');
    const stickBase = $('stick-base');
    const stickKnob = $('stick-knob');
    const R = 52;

    // ---- 浮动摇杆（左半屏） ----
    const zoneStart = e => {
      for (const t of e.changedTouches) {
        if (this._stickId !== null) continue;
        this._stickId = t.identifier;
        this._stickOrigin = { x: t.clientX, y: t.clientY };
        stickBase.style.display = 'block';
        stickBase.style.left = (t.clientX - 62) + 'px';
        stickBase.style.top = (t.clientY - 62) + 'px';
        stickKnob.style.transform = 'translate(0px, 0px)';
      }
      e.preventDefault();
    };
    const zoneMove = e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._stickId) continue;
        let dx = t.clientX - this._stickOrigin.x;
        let dy = t.clientY - this._stickOrigin.y;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = dx / len * R; dy = dy / len * R; }
        stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        INPUT.axis = { x: dx / R, y: -dy / R };
      }
      e.preventDefault();
    };
    const zoneEnd = e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._stickId) continue;
        this._stickId = null;
        INPUT.axis = { x: 0, y: 0 };
        stickBase.style.display = 'none';
      }
      e.preventDefault();
    };
    stickZone.addEventListener('touchstart', zoneStart, { passive: false });
    stickZone.addEventListener('touchmove', zoneMove, { passive: false });
    stickZone.addEventListener('touchend', zoneEnd, { passive: false });
    stickZone.addEventListener('touchcancel', zoneEnd, { passive: false });

    // ---- 视角（右半屏滑动） ----
    const lookStart = e => {
      for (const t of e.changedTouches) {
        if (this._lookId !== null) continue;
        this._lookId = t.identifier;
        this._lookLast = { x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    };
    const lookMove = e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._lookId) continue;
        const ts = (typeof SAVE !== 'undefined' && SAVE.data.settings.touchSens) || 1;
        INPUT.dx += (t.clientX - this._lookLast.x) * 1.35 * ts;
        INPUT.dy += (t.clientY - this._lookLast.y) * 1.35 * ts;
        this._lookLast = { x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    };
    const lookEnd = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) this._lookId = null;
      }
      e.preventDefault();
    };
    const lookZone = $('touch-look');
    lookZone.addEventListener('touchstart', lookStart, { passive: false });
    lookZone.addEventListener('touchmove', lookMove, { passive: false });
    lookZone.addEventListener('touchend', lookEnd, { passive: false });
    lookZone.addEventListener('touchcancel', lookEnd, { passive: false });

    // ---- 按键 ----
    const press = (el, down, up) => {
      el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
      if (up) {
        el.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); up(); }, { passive: false });
        el.addEventListener('touchcancel', e => { e.preventDefault(); e.stopPropagation(); up(); }, { passive: false });
      }
    };
    const tap = code => { INPUT._pressed[code] = true; };
    const hold = (el, code) => press(el,
      () => { INPUT.lmb = true; INPUT.lmbEdge = true; INPUT._downBtn = code; },
      () => { INPUT.lmb = false; });

    hold($('tb-fire'));
    press($('tb-ads'), () => { INPUT.rmb = !INPUT.rmb; $('tb-ads').classList.toggle('on', INPUT.rmb); });
    press($('tb-reload'), () => tap('KeyR'));
    press($('tb-jump'), () => tap('Space'));
    press($('tb-dash'), () => tap('KeyC'));
    press($('tb-kick'), () => tap('KeyF'));
    press($('tb-frag'), () => tap('KeyG'));
    press($('tb-molo'), () => tap('KeyT'));
    press($('tb-w1'), () => tap('Digit1'));
    press($('tb-w2'), () => tap('Digit2'));
    press($('tb-w3'), () => tap('Digit3'));
    press($('tb-shop'), () => { tap('KeyE'); tap('KeyB'); });
    press($('tb-pause'), () => { if (typeof GAME !== 'undefined' && GAME) { if (GAME.state === 'playing') GAME.pause(); } });

    // 阻止页面滚动/双击缩放
    document.body.addEventListener('touchmove', e => { if (GAME && GAME.state === 'playing') e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());

    // 移动端提示
    if (!SAVE.data.tutorialDone) {
      // 教学文案会自动切换为触屏版本
    }
  },
  /* 根据游戏状态显示/隐藏触控层 */
  sync() {
    if (!this.active) return;
    const el = document.getElementById('touch-ui');
    if (!el) return;
    const show = typeof GAME !== 'undefined' && GAME && (GAME.state === 'playing');
    el.classList.toggle('hidden', !show);
  },
};
