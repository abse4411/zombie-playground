/* ============================================================
 * 战斗视觉反馈池（v6.4）
 * 丧尸头顶血条（sprite 懒创建）+ 弹道曳光（线段池）
 * ============================================================ */
const HPBARS = {
  _bgMat: null, _fillMat: null, _geo: null,

  // 懒创建：丧尸首次受伤时调用
  create(zombie) {
    if (!this._bgMat) {
      this._bgMat = new THREE.MeshBasicMaterial({ color: 0x14090b, transparent: true, opacity: 0.75, depthTest: false });
      this._fillMat = new THREE.MeshBasicMaterial({ color: 0x6fdc5f, depthTest: false });
      this._geo = new THREE.PlaneGeometry(1, 1);
    }
    const s = zombie.group.scale.x;
    const g = new THREE.Group();
    const bg = new THREE.Mesh(this._geo, this._bgMat);
    bg.scale.set(0.72, 0.085, 1);
    const fill = new THREE.Mesh(this._geo, this._fillMat);
    fill.scale.set(0.68, 0.055, 1);
    fill.position.z = 0.001;
    bg.renderOrder = 998; fill.renderOrder = 999;
    g.add(bg, fill);
    g.position.set(zombie.pos.x, 2.15 * s, zombie.pos.z);
    g.renderOrder = 998;
    ENGINE.scene.add(g);
    zombie.hpbar = { group: g, fill, bg };
  },

  update(zombie) {
    const hb = zombie.hpbar;
    if (!hb || zombie.dead) return;
    const p = GAME.player.pos;
    const d = dist2d(zombie.pos.x, zombie.pos.z, p.x, p.z);
    hb.group.visible = d < 45;
    if (!hb.group.visible) return;
    hb.group.position.set(zombie.pos.x, 2.15 * zombie.group.scale.x, zombie.pos.z);
    const pct = clamp(zombie.hp / zombie.maxHp, 0, 1);
    hb.fill.scale.x = 0.68 * pct;
    // 面向相机（手动billboard）
    hb.group.quaternion.copy(ENGINE.camera.quaternion);
  },

  remove(zombie) {
    if (!zombie.hpbar) return;
    ENGINE.scene.remove(zombie.hpbar.group);
    zombie.hpbar = null;
  },
};

const TRACERS = {
  pool: [],

  init(scene) {
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const mat = new THREE.LineBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0 });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      scene.add(line);
      this.pool.push({ line, life: 0 });
    }
  },

  fire(from, to) {
    const t = this.pool.find(x => x.life <= 0) || this.pool[0];
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.life = 0.05;
    t.line.material.opacity = 0.85;
  },

  update(dt) {
    for (const t of this.pool) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.05) * 0.85;
    }
  },
};
