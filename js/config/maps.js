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
    const roofTex = ART.stripes(0xa03050, 0xd8d2c4).clone();
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
      const tex = ART.stripes(s.c || 0x5a6a4a, 0xd8d2c4).clone();
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

/* ---------- 地图定义 ---------- */
const MAPS = {
  /* ========== 1. 荒废游乐园（主视觉地图） ========== */
  park: {
    id: 'park', name: '荒废游乐园', subtitle: '旋转木马还在转，只是乘客换了', mode: 'both',
    desc: '赤潮病毒泄源头的地表伪装设施。褪色的旋转木马与摩天轮之间，小丑感染者仍在“演出”。',
    size: 68, groundColor: 0x1c1a24, sky: 0x0d0a18, fogColor: 0x15101f, fogDensity: 0.016,
    hemi: { sky: 0x4a4a6a, ground: 0x1a1418, i: 0.75 },
    dir: { c: 0x8888cc, i: 0.35, x: -30, y: 60, z: 20 },
    lights: [
      { x: 0, y: 6, z: -5, c: 0xffc0e0, i: 0.9, d: 24 },
      { x: -26, y: 5, z: 18, c: 0x39c5ff, i: 0.8, d: 22 },
      { x: 26, y: 5, z: 14, c: 0xff9a3c, i: 0.8, d: 22 },
      { x: -30, y: 13, z: -42, c: 0xff5a8a, i: 1.0, d: 30 },
    ],
    props: [
      // 售票亭与摊位
      { t: 'b', x: 12, z: 30, w: 3, h: 3.4, d: 2.6, c: 0x6a4a5a }, { t: 'b', x: 12, z: 30, w: 3.6, h: 0.5, d: 3.2, y: 3.4, c: 0xa03050, nc: true },
      { t: 'b', x: -14, z: 26, w: 4, h: 2.8, d: 2.2, ry: 0.3, c: 0x5a5a4a }, { t: 'b', x: -14, z: 26, w: 4.6, h: 0.4, d: 2.8, y: 2.8, ry: 0.3, c: 0x30808a, nc: true },
      { t: 'b', x: -22, z: 16, w: 4, h: 2.8, d: 2.2, ry: -0.2, c: 0x5a4a5a }, { t: 'b', x: -22, z: 16, w: 4.6, h: 0.4, d: 2.8, y: 2.8, ry: -0.2, c: 0xa05030, nc: true },
      { t: 'b', x: 20, z: 24, w: 4, h: 2.8, d: 2.2, ry: 0.15, c: 0x4a5a5a }, { t: 'b', x: 20, z: 24, w: 4.6, h: 0.4, d: 2.8, y: 2.8, ry: 0.15, c: 0x508a30, nc: true },
      // 碰碰车场
      { t: 'b', x: 28, z: -18, w: 14, h: 0.5, d: 12, c: 0x2a2a34, nc: true },
      { t: 'b', x: 25, z: -16, w: 1.8, h: 1, d: 1.4, ry: 0.5, c: 0x8a3a3a }, { t: 'b', x: 30, z: -20, w: 1.8, h: 1, d: 1.4, ry: 1.2, c: 0x3a7a8a }, { t: 'b', x: 32, z: -14, w: 1.8, h: 1, d: 1.4, ry: 2.4, c: 0x8a8a3a },
      // 围栏与长椅
      { t: 'b', x: -34, z: -8, w: 0.3, h: 2.2, d: 16, c: 0x3a3640 }, { t: 'b', x: 34, z: -4, w: 0.3, h: 2.2, d: 12, c: 0x3a3640 },
      { t: 'b', x: -8, z: 22, w: 2.2, h: 0.8, d: 0.7, c: 0x4a4238 }, { t: 'b', x: 8, z: 18, w: 2.2, h: 0.8, d: 0.7, c: 0x4a4238 },
      // 垃圾桶
      { t: 'c', x: -4, z: 30, r: 0.45, h: 1.1, c: 0x2e3238 }, { t: 'c', x: 16, z: 12, r: 0.45, h: 1.1, c: 0x2e3238 }, { t: 'c', x: -18, z: 8, r: 0.45, h: 1.1, c: 0x2e3238 },
      // 过山车支架（装饰）
      { t: 'b', x: -48, z: -28, w: 1, h: 9, d: 1, c: 0x6a2a2a, nc: true }, { t: 'b', x: -44, z: -20, w: 1, h: 7, d: 1, c: 0x6a2a2a, nc: true },
      { t: 'b', x: 48, z: -30, w: 1, h: 9, d: 1, c: 0x6a2a2a, nc: true }, { t: 'b', x: 52, z: -22, w: 1, h: 7, d: 1, c: 0x6a2a2a, nc: true },
      { t: 'b', x: -46, z: -24, w: 9, h: 0.6, d: 0.6, ry: 0.4, y: 8, c: 0x6a2a2a, nc: true }, { t: 'b', x: 50, z: -26, w: 9, h: 0.6, d: 0.6, ry: 0.5, y: 8, c: 0x6a2a2a, nc: true },
    ],
    structures: [
      { type: 'carousel', x: 0, z: -5 },
      { type: 'ferris', x: -30, z: -42 },
      { type: 'gateArch', x: 0, z: 56 },
      { type: 'tent', x: -36, z: -12, c: 0x8a3a5a }, { type: 'tent', x: 36, z: -8, c: 0x3a6a8a },
      { type: 'deadTree', x: -44, z: 24 }, { type: 'deadTree', x: 44, z: 20 }, { type: 'deadTree', x: 30, z: -40 }, { type: 'deadTree', x: -20, z: -46 },
      { type: 'lightPole', x: -20, z: 12, c: 0xff7ab8, i: 0.7 }, { type: 'lightPole', x: 20, z: 10, c: 0x39c5ff, i: 0.7 },
      { type: 'lightPole', x: -22, z: -28, c: 0xffb066, i: 0.7 }, { type: 'lightPole', x: 22, z: -30, c: 0xb08aff, i: 0.7 },
    ],
    spawns: [
      { x: -50, z: -50 }, { x: 0, z: -52 }, { x: 50, z: -50 }, { x: -56, z: -10 },
      { x: 56, z: -6 }, { x: -50, z: 40 }, { x: 50, z: 42 }, { x: 0, z: 58 }, { x: -30, z: 56 }, { x: 30, z: 58 },
    ],
    playerSpawn: { x: 0, z: 44, yaw: 0 },
    buyZone: { x: 7, z: 46, r: 4.5 },
  },

  /* ========== 2. 废弃城市街区 ========== */
  city: {
    id: 'city', name: '废弃街区', subtitle: '轰炸倒计时下的空城', mode: 'both',
    desc: '撤离点的所在地。残破的楼宇间散落着警车与路障，装甲暴兵在废墟中游荡。',
    size: 72, groundColor: 0x232323, sky: 0x1c1410, fogColor: 0x241a12, fogDensity: 0.015,
    hemi: { sky: 0x8a5a3a, ground: 0x1a1410, i: 0.7 },
    dir: { c: 0xff9955, i: 0.5, x: 40, y: 50, z: -30 },
    lights: [
      { x: -18, y: 5, z: 20, c: 0xffcc88, i: 0.85, d: 26 },
      { x: 18, y: 5, z: 8, c: 0xffcc88, i: 0.85, d: 26 },
      { x: 0, y: 5, z: -22, c: 0xff8866, i: 0.7, d: 24 },
      { x: -30, y: 5, z: -14, c: 0xaaccff, i: 0.5, d: 20 },
    ],
    props: [
      // 楼群（边缘围合）
      { t: 'b', x: -46, z: -56, w: 22, h: 20, d: 14, c: 0x3a3a3e }, { t: 'b', x: -8, z: -58, w: 24, h: 15, d: 12, c: 0x33343a },
      { t: 'b', x: 34, z: -56, w: 26, h: 24, d: 13, c: 0x3e3a36 }, { t: 'b', x: 62, z: -20, w: 14, h: 18, d: 26, c: 0x36383c },
      { t: 'b', x: 62, z: 30, w: 14, h: 12, d: 22, c: 0x3a3632 }, { t: 'b', x: -62, z: -24, w: 14, h: 16, d: 26, c: 0x34363a },
      { t: 'b', x: -62, z: 26, w: 14, h: 22, d: 20, c: 0x383a3e }, { t: 'b', x: 24, z: 58, w: 30, h: 14, d: 12, c: 0x3a3e42 },
      { t: 'b', x: -30, z: 60, w: 26, h: 17, d: 12, c: 0x343a3e },
      // 窗灯点缀
      { t: 'b', x: -46, z: -48.6, w: 1.2, h: 1.2, d: 0.2, y: 8, c: 0x111, e: 0xffcc66, nc: true },
      { t: 'b', x: 34, z: -48.6, w: 1.2, h: 1.2, d: 0.2, y: 12, c: 0x111, e: 0x88ccff, nc: true },
      { t: 'b', x: -62, z: -10, w: 0.2, h: 1.2, d: 1.2, y: 6, c: 0x111, e: 0xffcc66, nc: true },
      // 车辆
      { t: 'b', x: -12, z: 2, w: 2.2, h: 1.3, d: 4.6, ry: 0.3, c: 0x5a2e2e }, { t: 'b', x: -12, z: 2, w: 2.4, h: 0.8, d: 2.2, ry: 0.3, y: 1.3, c: 0x2c2c30 },
      { t: 'b', x: 10, z: -6, w: 2.2, h: 1.3, d: 4.6, ry: -0.4, c: 0x2e4a5a }, { t: 'b', x: 10, z: -6, w: 2.4, h: 0.8, d: 2.2, ry: -0.4, y: 1.3, c: 0x2c2c30 },
      { t: 'b', x: 28, z: 18, w: 2.2, h: 1.3, d: 4.6, ry: 1.4, c: 0x4a4a3a }, { t: 'b', x: -30, z: 30, w: 2.2, h: 1.3, d: 4.6, ry: 0.9, c: 0x3a3a3a },
      { t: 'b', x: 2, z: -30, w: 2.4, h: 2, d: 5.6, ry: 0.2, c: 0x2a2a2e }, { t: 'b', x: 2, z: -30, w: 2.6, h: 1, d: 2.4, ry: 0.2, y: 2, c: 0x1a1a1e },
      // 路障与杂物
      { t: 'b', x: 0, z: 8, w: 7, h: 1.1, d: 1, c: 0x6a6350 }, { t: 'b', x: -8, z: -18, w: 1, h: 1.1, d: 6, c: 0x6a6350 },
      { t: 'c', x: 14, z: 26, r: 0.5, h: 1.2, c: 0x2e3238 }, { t: 'c', x: -20, z: -8, r: 0.5, h: 1.2, c: 0x2e3238 },
      { t: 'b', x: 20, z: -28, w: 3, h: 2.4, d: 2, ry: 0.5, c: 0x4a3a2a }, { t: 'b', x: -24, z: 12, w: 2.4, h: 1.6, d: 2, ry: 0.2, c: 0x3a4034 },
    ],
    structures: [
      { type: 'lightPole', x: -18, z: 20, c: 0xffcc88 }, { type: 'lightPole', x: 18, z: 8, c: 0xffcc88 },
      { type: 'lightPole', x: 0, z: -22, c: 0xff8866, i: 0.7 }, { type: 'lightPole', x: -30, z: -14, c: 0xaaccff, i: 0.5 },
      { type: 'deadTree', x: 40, z: 36 }, { type: 'deadTree', x: -40, z: -38 }, { type: 'deadTree', x: 44, z: -36 },
      { type: 'watchtower', x: 0, z: 40 },
    ],
    spawns: [
      { x: -56, z: -46 }, { x: 0, z: -50 }, { x: 52, z: -48 }, { x: 58, z: 0 },
      { x: 56, z: 48 }, { x: 0, z: 56 }, { x: -56, z: 44 }, { x: -58, z: 4 }, { x: -34, z: -40 }, { x: 36, z: -38 },
    ],
    playerSpawn: { x: 0, z: 42, yaw: 0 },
    buyZone: { x: -8, z: 42, r: 4.5 },
  },

  /* ========== 3. 滨港地铁站 ========== */
  metro: {
    id: 'metro', name: '滨港地铁站', subtitle: '隧道深处的东西还在爬', mode: 'both',
    desc: '黎明会最后的地下中继站。昏暗的站台、锈死的列车、隧道里传来的回声——潜行者最喜欢的猎场。',
    size: 56, groundColor: 0x1e2226, sky: 0x05070a, fogColor: 0x060a0c, fogDensity: 0.03,
    hemi: { sky: 0x3a4a52, ground: 0x0a0c0e, i: 0.55 },
    dir: { c: 0x88bbcc, i: 0.3, x: 0, y: 40, z: 0 },
    lights: [
      { x: -10, y: 4.6, z: 24, c: 0xbafff0, i: 0.75, d: 20 },
      { x: 10, y: 4.6, z: 6, c: 0xbafff0, i: 0.75, d: 20 },
      { x: -10, y: 4.6, z: -14, c: 0xbafff0, i: 0.75, d: 20 },
      { x: 10, y: 4.6, z: -30, c: 0xff4444, i: 0.8, d: 18 },
      { x: 0, y: 4.6, z: 40, c: 0xff4444, i: 0.8, d: 18 },
    ],
    props: [
      { t: 'b', x: 0, z: 0, w: 116, h: 0.6, d: 116, y: 6.2, c: 0x14181c, nc: true },   // 顶棚
      // 站台（两侧垫高）
      { t: 'b', x: -17, z: 0, w: 8, h: 0.7, d: 108, c: 0x2a3138 }, { t: 'b', x: 17, z: 0, w: 8, h: 0.7, d: 108, c: 0x2a3138 },
      { t: 'b', x: -21, z: 0, w: 0.6, h: 1.2, d: 108, y: 0.7, c: 0xd8d800, nc: true }, { t: 'b', x: 21, z: 0, w: 0.6, h: 1.2, d: 108, y: 0.7, c: 0xd8d800, nc: true },
      // 站台楼梯（东西两侧×三处，v4.1/v4.2 全图可达）：四级 0.175 踏步
      { t: 'b', x: -12.55, z: -20, w: 0.9, h: 0.525, d: 3.2, c: 0x2a3138 }, { t: 'b', x: -11.65, z: -20, w: 0.9, h: 0.35, d: 3.2, c: 0x2f363d }, { t: 'b', x: -10.75, z: -20, w: 0.9, h: 0.175, d: 3.2, c: 0x343b42 },
      { t: 'b', x: 12.55, z: -20, w: 0.9, h: 0.525, d: 3.2, c: 0x2a3138 }, { t: 'b', x: 11.65, z: -20, w: 0.9, h: 0.35, d: 3.2, c: 0x2f363d }, { t: 'b', x: 10.75, z: -20, w: 0.9, h: 0.175, d: 3.2, c: 0x343b42 },
      { t: 'b', x: -12.55, z: 20, w: 0.9, h: 0.525, d: 3.2, c: 0x2a3138 }, { t: 'b', x: -11.65, z: 20, w: 0.9, h: 0.35, d: 3.2, c: 0x2f363d }, { t: 'b', x: -10.75, z: 20, w: 0.9, h: 0.175, d: 3.2, c: 0x343b42 },
      { t: 'b', x: 12.55, z: 20, w: 0.9, h: 0.525, d: 3.2, c: 0x2a3138 }, { t: 'b', x: 11.65, z: 20, w: 0.9, h: 0.35, d: 3.2, c: 0x2f363d }, { t: 'b', x: 10.75, z: 20, w: 0.9, h: 0.175, d: 3.2, c: 0x343b42 },
      { t: 'b', x: -12.55, z: 0, w: 0.9, h: 0.525, d: 3.2, c: 0x2a3138 }, { t: 'b', x: -11.65, z: 0, w: 0.9, h: 0.35, d: 3.2, c: 0x2f363d }, { t: 'b', x: -10.75, z: 0, w: 0.9, h: 0.175, d: 3.2, c: 0x343b42 },
      { t: 'b', x: 12.55, z: 0, w: 0.9, h: 0.525, d: 3.2, c: 0x2a3138 }, { t: 'b', x: 11.65, z: 0, w: 0.9, h: 0.35, d: 3.2, c: 0x2f363d }, { t: 'b', x: 10.75, z: 0, w: 0.9, h: 0.175, d: 3.2, c: 0x343b42 },
      // 轨道
      { t: 'b', x: -4, z: 0, w: 1, h: 0.18, d: 112, y: 0.05, c: 0x555a60, nc: true }, { t: 'b', x: 4, z: 0, w: 1, h: 0.18, d: 112, y: 0.05, c: 0x555a60, nc: true },
      // 隧道口墙（南北）
      { t: 'b', x: -14, z: 56, w: 26, h: 7, d: 2, c: 0x232a30 }, { t: 'b', x: 14, z: 56, w: 26, h: 7, d: 2, c: 0x232a30 },
      { t: 'b', x: -14, z: -56, w: 26, h: 7, d: 2, c: 0x232a30 }, { t: 'b', x: 14, z: -56, w: 26, h: 7, d: 2, c: 0x232a30 },
      // 站牌与座椅
      { t: 'b', x: -14, z: 12, w: 0.4, h: 3, d: 2.2, c: 0x1a4a5a }, { t: 'b', x: 14, z: -8, w: 0.4, h: 3, d: 2.2, c: 0x1a4a5a },
      { t: 'b', x: -15, z: 30, w: 2.4, h: 0.9, d: 0.8, c: 0x3a4248 }, { t: 'b', x: -15, z: -22, w: 2.4, h: 0.9, d: 0.8, c: 0x3a4248 },
      { t: 'b', x: 15, z: 18, w: 2.4, h: 0.9, d: 0.8, c: 0x3a4248 }, { t: 'b', x: 15, z: -28, w: 2.4, h: 0.9, d: 0.8, c: 0x3a4248 },
      // 售货亭
      { t: 'b', x: 12, z: 34, w: 2.6, h: 2.6, d: 2, c: 0x4a3a2a },
      // 杂物箱
      { t: 'b', x: -8, z: 44, w: 1.6, h: 1.4, d: 1.6, ry: 0.4, c: 0x3a3228 }, { t: 'b', x: 8, z: -44, w: 1.6, h: 1.4, d: 1.6, ry: 0.8, c: 0x3a3228 },
    ],
    structures: [
      { type: 'trainCar', x: -24, z: -20, len: 30, c: 0x3a4a52, lit: false },
      { type: 'trainCar', x: 24, z: 16, len: 26, c: 0x4a4038, lit: true },
      { type: 'lightPole', x: 0, z: 0, c: 0xbafff0, i: 0.6, d: 18 },
    ],
    spawns: [
      { x: 0, z: -50 }, { x: -8, z: -50 }, { x: 8, z: -50 }, { x: 0, z: 50 },
      { x: -8, z: 50 }, { x: 8, z: 50 }, { x: -24, z: -46 }, { x: 24, z: -44 }, { x: -24, z: 44 }, { x: 24, z: 46 },
    ],
    playerSpawn: { x: 0, z: 36, yaw: 0 },
    buyZone: { x: -8, z: 36, r: 4.5 },
  },

  /* ========== 4. 疫病医院 ========== */
  hospital: {
    id: 'hospital', name: '疫病医院', subtitle: '这里的“病人”从不办理出院', mode: 'both',
    desc: '城市中央医院。停尸房里的清剿队残骸诉说着几个月前的惨败，被改造过的试验体在病房废墟中游荡。',
    size: 62, groundColor: 0x2a2e30, sky: 0x0c1216, fogColor: 0x0e141a, fogDensity: 0.02,
    hemi: { sky: 0x5a7a8a, ground: 0x14181c, i: 0.65 },
    dir: { c: 0xaaccee, i: 0.4, x: -20, y: 50, z: 30 },
    lights: [
      { x: 0, y: 5, z: 0, c: 0xcfe8ff, i: 0.85, d: 28 },
      { x: -24, y: 5, z: -18, c: 0x88ffcc, i: 0.6, d: 20 },
      { x: 24, y: 5, z: 14, c: 0x88ffcc, i: 0.6, d: 20 },
      { x: 0, y: 5, z: -34, c: 0xff6666, i: 0.7, d: 20 },
    ],
    props: [
      // 主楼（北侧背景）
      { t: 'b', x: 0, z: -46, w: 64, h: 20, d: 16, c: 0x4a5258 },
      { t: 'b', x: -18, z: -37.6, w: 2, h: 2.4, d: 0.3, y: 5, c: 0x111, e: 0x66ffcc, nc: true },
      { t: 'b', x: 0, z: -37.6, w: 2, h: 2.4, d: 0.3, y: 9, c: 0x111, e: 0x66ffcc, nc: true },
      { t: 'b', x: 18, z: -37.6, w: 2, h: 2.4, d: 0.3, y: 6, c: 0x111, e: 0xff4444, nc: true },
      // 急诊棚
      { t: 'b', x: 0, z: -30, w: 16, h: 0.5, d: 8, y: 4.2, c: 0x3a4248, nc: true },
      { t: 'b', x: -8, z: -30, w: 0.5, h: 4.2, d: 8, c: 0x3a4248 }, { t: 'b', x: 8, z: -30, w: 0.5, h: 4.2, d: 8, c: 0x3a4248 },
      // 救护车
      { t: 'b', x: 12, z: -22, w: 2.6, h: 2.2, d: 5.8, ry: 0.4, c: 0xd8d8dc }, { t: 'b', x: 12, z: -22, w: 2.8, h: 0.7, d: 2.6, ry: 0.4, y: 2.2, c: 0x2c2c30 },
      { t: 'b', x: 12, z: -22, w: 1.2, h: 0.2, d: 1.2, ry: 0.4, y: 2.9, c: 0x811, e: 0xff2222, nc: true },
      // 停机坪
      { t: 'c', x: 0, z: 26, r: 6.5, h: 0.1, c: 0x3a4248, nc: true },
      { t: 'b', x: 0, z: 26, w: 4, h: 0.06, d: 0.7, y: 0.12, c: 0xd8dcd0, nc: true }, { t: 'b', x: 1.6, z: 26, w: 0.7, h: 0.06, d: 2.2, y: 0.12, c: 0xd8dcd0, nc: true }, { t: 'b', x: -1.6, z: 26, w: 0.7, h: 0.06, d: 2.2, y: 0.12, c: 0xd8dcd0, nc: true },
      // 担架与轮椅
      { t: 'b', x: -14, z: 4, w: 0.9, h: 0.9, d: 2.1, ry: 0.3, c: 0x8a929a }, { t: 'b', x: 16, z: -2, w: 0.9, h: 0.9, d: 2.1, ry: -0.5, c: 0x8a929a },
      { t: 'b', x: -20, z: 16, w: 0.8, h: 1.2, d: 0.8, ry: 0.8, c: 0x5a6a72 }, { t: 'b', x: 22, z: 26, w: 0.8, h: 1.2, d: 0.8, ry: 1.2, c: 0x5a6a72 },
      // 药品柜翻倒
      { t: 'b', x: -30, z: 2, w: 2.2, h: 1.6, d: 1, ry: 0.6, c: 0x4a5a62 }, { t: 'b', x: 30, z: -8, w: 2.2, h: 1.6, d: 1, ry: -0.4, c: 0x4a5a62 },
      // 侧翼楼
      { t: 'b', x: -46, z: 10, w: 16, h: 12, d: 24, c: 0x424a50 }, { t: 'b', x: 46, z: -12, w: 16, h: 14, d: 24, c: 0x465056 },
      // 铁丝网围栏（东段）
      { t: 'b', x: 52, z: 24, w: 0.2, h: 2.4, d: 20, c: 0x3a4248 },
    ],
    structures: [
      { type: 'tent', x: -22, z: -12, c: 0x4a5a6a }, { type: 'tent', x: 22, z: 2, c: 0x4a6a5a },
      { type: 'sandbagRing', x: 0, z: 0, r: 11 },
      { type: 'deadTree', x: -34, z: 30 }, { type: 'deadTree', x: 36, z: 34 },
      { type: 'lightPole', x: -24, z: -18, c: 0x88ffcc, i: 0.6 }, { type: 'lightPole', x: 24, z: 14, c: 0x88ffcc, i: 0.6 },
      { type: 'lightPole', x: 0, z: 8, c: 0xcfe8ff, i: 0.7 },
    ],
    spawns: [
      { x: 0, z: -42 }, { x: -28, z: -40 }, { x: 28, z: -40 }, { x: -52, z: -20 },
      { x: 52, z: -4 }, { x: 52, z: 36 }, { x: 0, z: 52 }, { x: -52, z: 40 }, { x: -36, z: 44 }, { x: 36, z: 48 },
    ],
    playerSpawn: { x: 0, z: 38, yaw: 0 },
    buyZone: { x: 10, z: 38, r: 4.5 },
  },

  /* ========== 5. 军事基地（终点） ========== */
  base: {
    id: 'base', name: '军事基地', subtitle: '欢迎来到“游乐园”的地下', mode: 'both',
    desc: '赤潮病毒的源头。机库、集装箱与探照灯之间，暴君在耐心地等待闯入者。黎明行动的最终战场。',
    size: 76, groundColor: 0x2e3230, sky: 0x101410, fogColor: 0x121612, fogDensity: 0.018,
    hemi: { sky: 0x6a7a6a, ground: 0x141814, i: 0.65 },
    dir: { c: 0xccddcc, i: 0.45, x: 30, y: 60, z: 40 },
    lights: [
      { x: 0, y: 7, z: -44, c: 0xffffff, i: 0.9, d: 30 },
      { x: -30, y: 5, z: 8, c: 0xfff2cc, i: 0.7, d: 24 },
      { x: 30, y: 5, z: -8, c: 0xfff2cc, i: 0.7, d: 24 },
      { x: 0, y: 5, z: 24, c: 0xffdd88, i: 0.6, d: 22 },
    ],
    props: [
      // 机库（北端，U形）
      { t: 'b', x: -14, z: -52, w: 22, h: 11, d: 12, c: 0x4a5248 }, { t: 'b', x: 14, z: -52, w: 22, h: 11, d: 12, c: 0x4a5248 },
      { t: 'b', x: 0, z: -58, w: 8, h: 11, d: 3, c: 0x3e463e },
      { t: 'b', x: 0, z: -52, w: 19, h: 1.2, d: 1, y: 8.5, c: 0xff4400, e: 0x661100, nc: true },
      // 集装箱阵
      { t: 'b', x: -28, z: -18, w: 2.6, h: 2.8, d: 6.4, c: 0x8a4a3a }, { t: 'b', x: -28, z: -11, w: 2.6, h: 2.8, d: 6.4, c: 0x3a6a8a },
      { t: 'b', x: -28, z: -14.5, w: 2.6, h: 2.8, d: 6.4, y: 2.8, ry: 0.06, c: 0x6a7a3a },
      { t: 'b', x: 28, z: 12, w: 2.6, h: 2.8, d: 6.4, ry: 1.57, c: 0x8a8a3a }, { t: 'b', x: 34, z: 12, w: 2.6, h: 2.8, d: 6.4, ry: 1.57, c: 0x3a8a6a },
      { t: 'b', x: 31, z: 12, w: 2.6, h: 2.8, d: 6.4, y: 2.8, ry: 1.57, c: 0x8a3a3a },
      { t: 'b', x: 6, z: -20, w: 2.6, h: 2.8, d: 6.4, ry: 0.3, c: 0x4a5a6a },
      // 油罐
      { t: 'c', x: -44, z: -40, r: 4.2, h: 8, c: 0x8a929a }, { t: 'c', x: 44, z: -40, r: 4.2, h: 8, c: 0x8a929a },
      { t: 'c', x: -44, z: -40, r: 0.4, h: 10, y: 4, c: 0x5a626a, nc: true }, { t: 'c', x: 44, z: -40, r: 0.4, h: 10, y: 4, c: 0x5a626a, nc: true },
      // 军车
      { t: 'b', x: -8, z: 6, w: 2.6, h: 1.6, d: 5.4, ry: 0.5, c: 0x4a5a3a }, { t: 'b', x: -8, z: 6, w: 2.8, h: 0.9, d: 2.2, ry: 0.5, y: 1.6, c: 0x2e3628 },
      { t: 'b', x: 12, z: 0, w: 2.6, h: 1.6, d: 5.4, ry: -0.3, c: 0x4a5a3a },
      // 弹药箱堆
      { t: 'b', x: 20, z: 28, w: 1.6, h: 1.3, d: 1.6, ry: 0.3, c: 0x5a6248 }, { t: 'b', x: 21.8, z: 28.4, w: 1.6, h: 1.3, d: 1.6, ry: 0.7, c: 0x5a6248 },
      { t: 'b', x: 20.8, z: 28.2, w: 1.6, h: 1.3, d: 1.6, y: 1.3, c: 0x4a5238 },
      { t: 'b', x: -18, z: 30, w: 1.6, h: 1.3, d: 1.6, ry: 0.9, c: 0x5a6248 },
      // 直升机坪
      { t: 'c', x: 0, z: 34, r: 7, h: 0.1, c: 0x3a403c, nc: true },
      // 围墙装饰
      { t: 'b', x: -60, z: 20, w: 0.5, h: 3, d: 40, c: 0x3a4038 }, { t: 'b', x: 60, z: -16, w: 0.5, h: 3, d: 40, c: 0x3a4038 },
    ],
    structures: [
      { type: 'watchtower', x: -30, z: 22 }, { type: 'watchtower', x: 30, z: -24 },
      { type: 'sandbagRing', x: 0, z: -8, r: 10 },
      { type: 'trainCar', x: -34, z: 44, len: 18, ry: 1.2, c: 0x4a5240 },
      { type: 'lightPole', x: 0, z: -40, c: 0xffffff, i: 0.9, d: 28 },
      { type: 'lightPole', x: -22, z: 10, c: 0xfff2cc, i: 0.7 }, { type: 'lightPole', x: 22, z: -12, c: 0xfff2cc, i: 0.7 },
      { type: 'deadTree', x: 48, z: 30 }, { type: 'deadTree', x: -48, z: 8 },
    ],
    spawns: [
      { x: 0, z: -62 }, { x: -30, z: -58 }, { x: 30, z: -58 }, { x: -60, z: -30 },
      { x: 60, z: -30 }, { x: -60, z: 30 }, { x: 60, z: 30 }, { x: 0, z: 62 }, { x: -34, z: 58 }, { x: 34, z: 60 }, { x: -56, z: 0 }, { x: 56, z: 4 },
    ],
    playerSpawn: { x: 0, z: 44, yaw: 0 },
    buyZone: { x: -10, z: 44, r: 4.5 },
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
