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

/* ---------- 变异头顶词条（v7.0）：变异体头顶显示变异组合标签 ----------
 * 每种变异组合懒生成一张 canvas 贴图（缓存），sprite 挂在丧尸组内自动跟随。
 */
const MUTTAGS = {
  _tex: {},

  texFor(affixes) {
    const key = affixes.map(a => a.id).join('+');
    if (this._tex[key]) return this._tex[key];
    const names = affixes.map(a => a.name).join(' + ');
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.font = 'bold 32px "Microsoft YaHei", "PingFang SC", sans-serif';
    const tw = Math.min(240, x.measureText(names).width + 40);
    const col = '#' + affixes[0].color.toString(16).padStart(6, '0');
    // 底板 + 变异色描边
    x.fillStyle = 'rgba(8,10,14,0.75)';
    x.fillRect((256 - tw) / 2, 8, tw, 48);
    x.strokeStyle = col;
    x.lineWidth = 3;
    x.strokeRect((256 - tw) / 2, 8, tw, 48);
    // 文字
    x.fillStyle = col;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(names, 128, 34, 230);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    this._tex[key] = tex;
    return tex;
  },

  attach(zombie) {
    let tag = zombie.group.userData.mutTag;
    if (!tag) {
      tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      tag.renderOrder = 996;
      tag.position.y = 2.45;
      tag.scale.set(1.7, 0.42, 1);
      zombie.group.add(tag);
      zombie.group.userData.mutTag = tag;
    }
    tag.visible = zombie.affixes.length > 0;
    if (tag.visible) {
      tag.material.map = this.texFor(zombie.affixes);   // 组合贴图有缓存，共享，不可dispose
      tag.material.needsUpdate = true;
    }
  },
};

/* ---------- 血泊 decals（v11.3 击杀留痕，上限25循环覆盖） ---------- */
const BLOODPOOLS = {
  list: [], _geo: null, _mats: null, MAX: 25,

  _init() {
    if (this._geo) return;
    this._geo = new THREE.CircleGeometry(1, 14);
    this._mats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({
      color: 0x3a0a0e, transparent: true, opacity: 0.75, depthWrite: false,
    }));
  },

  // 击杀时调用：随机大小血泊
  spawn(x, z, big) {
    this._init();
    let pool = this.list.find(p => p.dead);
    if (!pool) {
      if (this.list.length >= this.MAX) {
        pool = this.list[0];   // 复用最老的
        this.list.shift();
      } else {
        pool = { mesh: new THREE.Mesh(this._geo, this._mats[randi(0, 2)]), dead: true };
        pool.mesh.rotation.x = -Math.PI / 2;
        pool.mesh.position.y = 0.02 + rand(0, 0.01);
        ENGINE.scene.add(pool.mesh);
        this.list.push(pool);
      }
    }
    pool.dead = false;
    pool.mesh.visible = true;
    pool.age = 0;
    const s = big ? rand(0.9, 1.5) : rand(0.45, 0.8);
    pool.mesh.scale.set(s, s * rand(0.7, 1), 1);
    pool.mesh.rotation.z = rand(0, TAU);
    pool.mesh.position.x = x + rand(-0.2, 0.2);
    pool.mesh.position.z = z + rand(-0.2, 0.2);
  },

  // v21.7：血泊随时间渐隐消散（18秒后开始淡出，26秒消失）
  update(dt) {
    for (const p of this.list) {
      if (p.dead) continue;
      p.age = (p.age || 0) + dt;
      if (p.age > 26) { p.dead = true; p.mesh.visible = false; p.mesh.material.opacity = 0.75; continue; }
      if (p.age > 18) p.mesh.material.opacity = Math.max(0, 0.75 * (1 - (p.age - 18) / 8));
    }
  },

  clear() { for (const p of this.list) { p.mesh.visible = false; p.mesh.material.opacity = 0.75; } this.list = []; },
};