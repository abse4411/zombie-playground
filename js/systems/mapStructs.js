/* ============================================================
 * 地图特殊建筑构建器（v12.1 数据外置后保留的运行时代码）
 * 地图数据已外置至 assets/data/maps/<id>.json —— 修改数据请编辑 js/config/maps.js 后运行 node tools/extract-data.js
 * ============================================================ */

/* ============================================================
 * 地图数据表 + 特殊建筑构建器
 * props: b=box(x,z,w,h,d,y,ry,c,e,nc) c=cylinder(x,z,r,h,y,c,e,nc)
 * ============================================================ */

/* ---------- 构建辅助（美漫 Toon 材质缓存） ---------- */
function mkMat(c, e) { return ART.mat(c, { e, toon: !e }); }
function mkBox(w, h, d, c, e) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mkMat(c, e)); }
function mkCyl(r, h, c, e) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mkMat(c, e)); }
function mkCone(r, h, c, e) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), mkMat(c, e)); }
function put(mesh, x, y, z, ry) { mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry; return mesh; }
function colBox(x, z, w, d, h, y) {
  y = y || 0;
  ENGINE.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y, maxY: y + h });
}
function colCyl(x, z, r, h, y) { colBox(x, z, r * 2, r * 2, h, y); }

/* ---------- 特殊建筑 ---------- */
const STRUCTS = {
  // 旋转木马（游乐园核心地标）
  carousel(g, s) {
    const grp = new THREE.Group(); grp.position.set(s.x, 0, s.z);
    grp.add(put(mkCyl(5.5, 0.7, 0x8a6a4a), 0, 0.35, 0));
    const roofTex = ART.stripes(0xa03050, 0xd8d2c4).clone(); roofTex.__ownedTex = true;
    roofTex.needsUpdate = true; roofTex.repeat.set(6, 1);
    grp.add(put(new THREE.Mesh(new THREE.ConeGeometry(6.5, 2.8, 14), new THREE.MeshLambertMaterial({ map: roofTex })), 0, 5.6, 0));
    grp.add(put(mkCyl(0.4, 4.6, 0xd8c8a8), 0, 2.9, 0));
    const horses = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, r = 4.6;
      const pole = put(mkCyl(0.08, 3.6, 0xd0d0d0), Math.cos(a) * r, 2.6, Math.sin(a) * r);
      grp.add(pole);
      if (i % 2 === 0) {
        const h = new THREE.Group();
        const col = [0xe8e0d8, 0x8a5a3a, 0xd8d8e8][i / 2 % 3];
        h.add(put(mkBox(0.55, 0.5, 1.2, col), 0, 0, 0));
        h.add(put(mkBox(0.28, 0.35, 0.5, col), 0, 0.35, 0.75));
        h.position.set(Math.cos(a + Math.PI / 8) * 3.6, 1.6, Math.sin(a + Math.PI / 8) * 3.6);
        h.rotation.y = -a - Math.PI / 8 + Math.PI / 2;
        grp.add(h); horses.push(h);
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const e = i % 2 ? 0xff5a8a : 0x39c5ff;
      grp.add(put(mkBox(0.25, 0.25, 0.25, 0x222222, e), Math.cos(a) * 6.1, 4.5, Math.sin(a) * 6.1));
    }
    const pl = new THREE.PointLight(0xffc0e0, 0.9, 20); pl.position.set(0, 4.5, 0); grp.add(pl);
    g.add(grp);
    colCyl(s.x, s.z, 5.8, 5.5);
    ENGINE.anims.push(dt => { grp.rotation.y += dt * 0.35; for (const h of horses) h.position.y = 1.6 + Math.sin(ENGINE.time * 2 + h.position.x) * 0.3; });
  },

  // 摩天轮（游乐园天际线）
  ferris(g, s) {
    const base = new THREE.Group(); base.position.set(s.x, 0, s.z);
    for (const dx of [-3, 3]) for (const dz of [-2.2, 2.2]) {
      base.add(put(mkBox(1, 12.5, 1, 0x3a4048), dx, 6.2, dz));
      colBox(s.x + dx, s.z + dz, 1.2, 1.2, 12.5);
    }
    base.add(put(mkBox(7.4, 0.7, 5.6, 0x2e343a), 0, 0.35, 0));
    const axle = mkCyl(0.5, 6.4, 0x565e66); axle.rotation.x = Math.PI / 2; base.add(put(axle, 0, 12, 0));
    const wheel = new THREE.Group(); wheel.position.set(0, 12, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(10, 0.4, 8, 40), mkMat(0x9aa4ae, 0x222831));
    wheel.add(rim);
    for (let i = 0; i < 8; i++) {
      const sp = mkBox(0.28, 20, 0.28, 0x6a737c); sp.rotation.z = i * Math.PI / 8; wheel.add(sp);
    }
    const cabins = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const cab = mkBox(1.3, 1.5, 1.3, i % 2 ? 0xc44 : 0x39c, i % 2 ? 0x550000 : 0x002233);
      cab.position.set(Math.cos(a) * 10, Math.sin(a) * 10, 0);
      wheel.add(cab); cabins.push(cab);
    }
    base.add(wheel); g.add(base);
    ENGINE.anims.push(dt => {
      wheel.rotation.z += dt * 0.12;
      for (const c of cabins) c.rotation.z = -wheel.rotation.z;
    });
  },

  // 游乐园大门（霓虹拱门）
  gateArch(g, s) {
    const grp = new THREE.Group(); grp.position.set(s.x, 0, s.z); grp.rotation.y = s.ry || 0;
    grp.add(put(mkBox(1.3, 7, 1.3, 0x6a5a6a), -4.5, 3.5, 0));
    grp.add(put(mkBox(1.3, 7, 1.3, 0x6a5a6a), 4.5, 3.5, 0));
    grp.add(put(mkBox(10.6, 1.4, 1.5, 0x4a3a4a), 0, 7.2, 0));
    grp.add(put(mkBox(8.6, 0.6, 0.3, 0x330000, 0xff2244), 0, 6.3, 0.8));
    grp.add(put(mkBox(0.25, 0.25, 0.25, 0x330000, 0xffcc44), -4.5, 7.4, 0.9));
    grp.add(put(mkBox(0.25, 0.25, 0.25, 0x330000, 0xffcc44), 4.5, 7.4, 0.9));
    g.add(grp);
    colBox(s.x - 4.5, s.z, 1.5, 1.5, 7); colBox(s.x + 4.5, s.z, 1.5, 1.5, 7);
  },

  // 路灯
  lightPole(g, s) {
    g.add(put(mkCyl(0.13, 5.2, 0x2a2e33), s.x, 2.6, s.z));
    g.add(put(mkBox(1, 0.28, 0.5, 0x333, s.c || 0xffddaa), s.x + 0.4, 5.1, s.z));
    const pl = new THREE.PointLight(s.c || 0xffddaa, s.i || 0.85, s.d || 26);
    pl.position.set(s.x, 4.7, s.z); g.add(pl);
    colBox(s.x, s.z, 0.5, 0.5, 5.2);
  },

  // 死树
  deadTree(g, s) {
    const grp = new THREE.Group(); grp.position.set(s.x, 0, s.z); grp.rotation.y = s.ry || 0;
    grp.add(put(mkCyl(0.22, 4.4, 0x3a2e26), 0, 2.2, 0));
    const b1 = mkBox(0.12, 1.8, 0.12, 0x332a22); b1.rotation.z = 0.7; put(b1, 0.5, 3.4, 0);
    const b2 = mkBox(0.12, 1.5, 0.12, 0x332a22); b2.rotation.z = -0.8; b2.rotation.x = 0.4; put(b2, -0.4, 2.8, 0.1);
    grp.add(b1, b2); g.add(grp);
    colCyl(s.x, s.z, 0.4, 4);
  },

  // 帐篷（马戏团条纹）
  tent(g, s) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(3, 3.4, 12), (() => {
      const tex = ART.stripes(s.c || 0x5a6a4a, 0xd8d2c4).clone(); tex.__ownedTex = true;
      tex.needsUpdate = true; tex.repeat.set(4, 1);
      return new THREE.MeshLambertMaterial({ map: tex });
    })());
    put(t, s.x, 1.7, s.z, s.ry || 0); g.add(t);
    colCyl(s.x, s.z, 2.6, 3);
  },

  // 瞭望塔
  watchtower(g, s) {
    const grp = new THREE.Group(); grp.position.set(s.x, 0, s.z);
    for (const dx of [-1.3, 1.3]) for (const dz of [-1.3, 1.3]) {
      grp.add(put(mkBox(0.4, 6.2, 0.4, 0x4a4438), dx, 3.1, dz));
    }
    grp.add(put(mkBox(3.6, 0.4, 3.6, 0x5a5244), 0, 6.4, 0));
    grp.add(put(mkBox(3.6, 1.1, 0.2, 0x4a4438), 0, 7.2, 1.7));
    grp.add(put(mkBox(0.2, 1.1, 3.6, 0x4a4438), 1.7, 7.2, 0));
    grp.add(put(mkBox(3.8, 0.3, 3.8, 0x3a3630), 0, 8.4, 0));
    const pl = new THREE.PointLight(0xfff2cc, 1.0, 26); pl.position.set(0, 7.6, 0); grp.add(pl);
    g.add(grp);
    for (const dx of [-1.3, 1.3]) for (const dz of [-1.3, 1.3]) colBox(s.x + dx, s.z + dz, 0.6, 0.6, 6.2);
  },

  // 地铁列车车厢
  trainCar(g, s) {
    const grp = new THREE.Group(); grp.position.set(s.x, 0, s.z); grp.rotation.y = s.ry || 0;
    const L = s.len || 20;
    grp.add(put(mkBox(3.4, 3.2, L, s.c || 0x4a5560), 0, 1.8, 0));
    for (let i = 0; i < Math.floor(L / 2.4); i++) {
      const off = -L / 2 + 1.4 + i * 2.4;
      grp.add(put(mkBox(0.1, 1.1, 1.5, 0x111, s.lit ? 0x88ffcc : 0x223322), 1.76, 2.2, off));
      grp.add(put(mkBox(0.1, 1.1, 1.5, 0x111, s.lit ? 0x88ffcc : 0x223322), -1.76, 2.2, off));
    }
    g.add(grp);
    colBox(s.x, s.z, 3.6, L, 3.6);
  },


  // 森林树阵（程序化密集树干+树冠，留出空地/营地/楼梯净空）
  forestTrees(g, s, def) {
    const S = def.size - 4;
    const leafMat = mkMat(0x24371f);
    const leafMat2 = mkMat(0x1e2f1a);
    let placed = 0, guard = 0;
    const bz = def.buyZone, p0 = def.playerSpawn;
    const clearings = [{ x: 0, z: 0, r: 7 }, { x: -20, z: -14, r: 8 }, { x: 0, z: -34, r: 6 }, { x: 14, z: -22, r: 5 }];
    while (placed < 42 && guard++ < 300) {
      const x = rand(-S, S), z = rand(-S, S);
      if (clearings.some(c => dist2d(x, z, c.x, c.z) < c.r)) continue;
      if (dist2d(x, z, bz.x, bz.z) < bz.r + 2) continue;
      if (dist2d(x, z, p0.x, p0.z) < 4) continue;
      const h = rand(4.5, 7.5);
      const trunk = mkCyl(rand(0.35, 0.55), h, 0x3a2c1e);
      put(trunk, x, h / 2, z); g.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(rand(1.6, 2.6), rand(3, 5), 8), Math.random() > 0.5 ? leafMat : leafMat2);
      put(crown, x, h + 1.4, z, rand(0, TAU)); g.add(crown);
      colCyl(x, z, 0.5, h);
      placed++;
    }
  },

  // 中央篝火（动态火焰粒子）
  campfire(g, s) {
    ENGINE.anims.push(() => {
      if (Math.random() < 0.5) {
        const a = Math.random() * TAU, r = Math.random() * 0.5;
        PARTICLES.flames(s.x + Math.cos(a) * r, 0.4, s.z + Math.sin(a) * r, 1);
      }
    });
  },

  // 程序化楼梯（v5.2）：n级踏步，玩家/丧尸自动踏步上下
  staircase(g, s) {
    const n = s.steps || 10, sh = s.stepH || 0.5, sd = s.stepD || 1.2, w = s.width || 3;
    const mat = mkMat(s.c || 0x4a5058);
    for (let i = 0; i < n; i++) {
      const top = (i + 1) * sh;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, top, sd), mat);
      const x = s.x + (s.dirX || 0) * i * sd;
      const z = s.z + (s.dirZ || 0) * i * sd;
      put(step, x, top / 2, z);
      g.add(step);
      colBox(x, z, w, sd, top);
    }
  },

  // 沙袋环形工事
  sandbagRing(g, s) {
    const R = s.r || 10, n = 16;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const x = s.x + Math.cos(a) * R, z = s.z + Math.sin(a) * R;
      const b = mkBox(1.6, 1.0, 0.8, 0x6a6350, null); put(b, x, 0.5, z, -a + Math.PI / 2); g.add(b);
      colBox(x, z, 1.7, 1.7, 1.0);
    }
  },
};


  /* ---------- 地图缩略图（菜单卡片预览） ---------- */
function drawMapPreview(canvas, map) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, S = map.size * 2.15;
  const px = x => W / 2 + x / S * W, pz = z => H / 2 + z / S * H;
  ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = map.groundColor ? '#' + map.groundColor.toString(16).padStart(6, '0') : '#222';
  ctx.fillRect(px(-map.size), pz(-map.size), map.size * 2 / S * W, map.size * 2 / S * H);
  for (const p of map.props) {
    const isStruct = p.nc;
    ctx.fillStyle = isStruct ? 'rgba(255,220,120,0.5)' : '#' + ((p.c || 0x888888) | 0).toString(16).padStart(6, '0');
    if (p.t === 'b') ctx.fillRect(px(p.x - p.w / 2), pz(p.z - p.d / 2), Math.max(1.5, p.w / S * W), Math.max(1.5, p.d / S * H));
    else { ctx.beginPath(); ctx.arc(px(p.x), pz(p.z), Math.max(1.5, p.r / S * W), 0, 7); ctx.fill(); }
  }
  for (const s of map.structures) {
    ctx.fillStyle = 'rgba(120,255,160,0.8)';
    ctx.fillRect(px(s.x) - 2, pz(s.z) - 2, 4, 4);
  }
  // 出生点（绿）与玩家出生（白）
  for (const sp of map.spawns) { ctx.fillStyle = 'rgba(255,80,80,0.85)'; ctx.beginPath(); ctx.arc(px(sp.x), pz(sp.z), 2, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#7CFC9A'; ctx.fillRect(px(map.playerSpawn.x) - 3, pz(map.playerSpawn.z) - 3, 6, 6);
  ctx.fillStyle = 'rgba(82,183,136,0.4)';
  ctx.beginPath(); ctx.arc(px(map.buyZone.x), pz(map.buyZone.z), map.buyZone.r / S * W, 0, 7); ctx.fill();
}
