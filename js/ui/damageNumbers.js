/* ============================================================
 * 漂浮伤害数字
 * ============================================================ */
const DMGNUM = {
  pool: [], cursor: 0, _v: null,

  init() {
    const layer = document.getElementById('dmg-layer');
    for (let i = 0; i < 26; i++) {
      const d = document.createElement('div');
      d.className = 'dmg-num';
      d.style.opacity = '0';
      layer.appendChild(d);
      this.pool.push({ el: d, life: 0, x: 0, y: 0, z: 0 });
    }
    this._v = new THREE.Vector3();
  },

  spawn(x, y, z, text, head) {
    const it = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    it.el.textContent = text;
    it.el.className = 'dmg-num' + (head ? ' head' : '');
    it.life = 0.75;
    it.x = x + rand(-0.18, 0.18);
    it.y = y + rand(0, 0.25);
    it.z = z;
  },

  update(dt) {
    const cam = ENGINE.camera;
    const w = window.innerWidth, h = window.innerHeight;
    for (const it of this.pool) {
      if (it.life <= 0) {
        if (it.el.style.opacity !== '0') it.el.style.opacity = '0';
        continue;
      }
      it.life -= dt;
      it.y += dt * 1.3;
      this._v.set(it.x, it.y, it.z).project(cam);
      if (this._v.z > 1 || this._v.z < -1) { it.el.style.opacity = '0'; continue; }
      const sx = (this._v.x * 0.5 + 0.5) * w;
      const sy = (-this._v.y * 0.5 + 0.5) * h;
      it.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      it.el.style.opacity = clamp(it.life / 0.35, 0, 1);
    }
  },
};
