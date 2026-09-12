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
    hb.fill.position.x = -0.34 * (1 - pct);   // 左端锚定：血量减少时从右向左缩短
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

/* ---------- 尸块系统（v6.8 肢解） ----------
 * 共享单位立方体 + 缩放表示尺寸；抛体物理 + 落地弹跳 + 末段缩小消失。
 * 材质直接引用丧尸共享材质（不淡出透明度，避免污染共享材质）。
 */
const GIBS = {
  _geo: null, pool: [],

  spawn(x, y, z, sx, sy, sz, mat, dir, power) {
    if (!this._geo) this._geo = new THREE.BoxGeometry(1, 1, 1);
    let g = this.pool.find(p => p.life <= 0);
    if (!g) {
      if (this.pool.length >= 36) return;   // 池上限：超出直接丢弃
      g = {
        mesh: new THREE.Mesh(this._geo, mat),
        vel: new THREE.Vector3(), ang: new THREE.Vector3(),
        base: new THREE.Vector3(), life: 0,
      };
      g.mesh.visible = false;
      ENGINE.scene.add(g.mesh);
      this.pool.push(g);
    }
    g.mesh.material = mat;
    g.base.set(Math.max(0.05, sx), Math.max(0.05, sy), Math.max(0.05, sz));
    g.mesh.scale.copy(g.base);
    g.mesh.position.set(x, Math.max(y, g.base.y * 0.5), z);
    g.mesh.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    const pw = power || 1;
    const ox = (dir && dir.dx) || 0, oz = (dir && dir.dz) || 0;
    const ol = Math.hypot(ox, oz) || 1;
    g.vel.set(ox / ol * rand(1.5, 3) * pw + rand(-1.2, 1.2), rand(2.5, 4.5) * pw, oz / ol * rand(1.5, 3) * pw + rand(-1.2, 1.2));
    g.ang.set(rand(-7, 7), rand(-7, 7), rand(-7, 7));
    g.life = rand(1.4, 2.0);
    g.mesh.visible = true;
  },

  update(dt) {
    for (const g of this.pool) {
      if (g.life <= 0) continue;
      g.life -= dt;
      const m = g.mesh;
      g.vel.y -= 16 * dt;
      m.position.x += g.vel.x * dt;
      m.position.y += g.vel.y * dt;
      m.position.z += g.vel.z * dt;
      const floor = g.base.y * 0.5;
      if (m.position.y < floor) {
        m.position.y = floor;
        if (Math.abs(g.vel.y) > 1.6) { g.vel.y *= -0.38; g.vel.x *= 0.6; g.vel.z *= 0.6; g.ang.multiplyScalar(0.55); }
        else { g.vel.y = 0; g.vel.x *= 0.85; g.vel.z *= 0.85; g.ang.multiplyScalar(0.85); }
      }
      m.rotation.x += g.ang.x * dt;
      m.rotation.y += g.ang.y * dt;
      m.rotation.z += g.ang.z * dt;
      if (g.life < 0.4) {
        const k = Math.max(0.01, g.life / 0.4);
        m.scale.set(g.base.x * k, g.base.y * k, g.base.z * k);
      }
      if (g.life <= 0) m.visible = false;
    }
  },
};
