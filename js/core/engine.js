/* ============================================================
 * 渲染引擎 —— 场景 / 相机 / 地图构建 / 自适应画质
 * ============================================================ */
const ENGINE = {
  renderer: null, scene: null, camera: null,
  colliders: [], anims: [], mapGroup: null, mapDef: null,
  time: 0, shakeAmt: 0, buyZoneMesh: null,
  qualityKey: 'high', quality: GAMECONFIG.quality.high,
  _fpsEma: 60, _qTimer: 0,
  _trackedTex: new Set(),   // 本场地绘一届的纹理克隆（clearMap 时释放）

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 400);
    this.camera.rotation.order = 'YXZ';
    this.scene = new THREE.Scene();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    // 触屏/低配设备默认中档
    const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this.setQuality(touch ? 'medium' : 'high');
  },

  /* ---------- 画质档位与自适应 ---------- */
  setQuality(key) {
    if (key !== 'auto') this.qualityKey = key;
    const k = key === 'auto' ? this.qualityKey : key;
    this.qualityKey = k === 'auto' ? 'high' : k;
    this.quality = GAMECONFIG.quality[this.qualityKey];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
    ART.setOutlines(this.quality.outlines);
    PARTICLES.mult = this.quality.particleMult;
    if (typeof SAVE !== 'undefined' && SAVE.data && SAVE.data.settings.quality !== key) {
      SAVE.data.settings.quality = key;
      SAVE.commit();
    }
  },

  tickFps(rawDt) {
    if (rawDt <= 0) return;
    const fps = 1 / rawDt;
    this._fpsEma = this._fpsEma * 0.92 + fps * 0.08;
    this._qTimer += rawDt;
    if (this._qTimer < GAMECONFIG.autoQuality.checkEvery) return;
    this._qTimer = 0;
    if (this.autoMode !== true) return;
    const C = GAMECONFIG.autoQuality;
    if (this._fpsEma < C.lowFps) {
      if (this.qualityKey === 'high') { this.setQuality('auto'); this.qualityKey = 'medium'; this.quality = GAMECONFIG.quality.medium; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4)); ART.setOutlines(true); PARTICLES.mult = 0.65; }
      else if (this.qualityKey === 'medium') { this.qualityKey = 'low'; this.quality = GAMECONFIG.quality.low; this.renderer.setPixelRatio(1); ART.setOutlines(false); PARTICLES.mult = 0.4; }
    } else if (this._fpsEma > C.highFps && this.qualityKey === 'low') {
      this.qualityKey = 'medium'; this.quality = GAMECONFIG.quality.medium;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
      ART.setOutlines(true); PARTICLES.mult = 0.65;
    }
  },

  clearMap() {
    if (this.mapGroup) {
      // 深度释放：几何体 + 非缓存材质 + 材质上的纹理（GPU 资源不会被 GC 回收）
      this.mapGroup.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        for (const m of mats) {
          if (m.map && m.map.__tracked) { this._trackedTex.delete(m.map); m.map.dispose(); }
          if (!m.__cached) m.dispose();
        }
      });
      this.scene.remove(this.mapGroup);
    }
    // 释放本场地所有跟踪纹理克隆
    for (const t of this._trackedTex) t.dispose();
    this._trackedTex.clear();
    this.mapGroup = null; this.mapDef = null;
    this.colliders = []; this.anims = []; this.buyZoneMesh = null;
    ART.resetOutlines();
  },

  // 纹理克隆登记（场地专属资源，换图即释放）
  trackTex(t) { if (t) { t.__tracked = true; this._trackedTex.add(t); } return t; },

  // GPU 资源统计（draw call / 几何体 / 纹理数量）
  gpuStats() {
    const i = this.renderer ? this.renderer.info : null;
    if (!i) return { calls: 0, geos: 0, texs: 0 };
    return { calls: i.render.calls, geos: i.memory.geometries, texs: i.memory.textures };
  },

  buildMap(def) {
    this.clearMap();
    this.mapDef = def;
    this.scene.background = new THREE.Color(def.sky);
    this.scene.fog = new THREE.FogExp2(def.fogColor, def.fogDensity);

    const g = this.mapGroup = new THREE.Group();
    this.scene.add(g);

    // 天空穹顶
    const skyMat = new THREE.MeshBasicMaterial({
      map: ART.sky(def.sky, def.fogColor, def.stars !== false),
      side: THREE.BackSide, fog: false,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(360, 20, 14), skyMat);
    skyDome.userData.noOutline = true;
    g.add(skyDome);

    // 地面（程序化沥青纹理）
    const gTex = this.trackTex(ART.ground(def.groundColor).clone());
    gTex.needsUpdate = true;
    const rep = Math.max(10, Math.round((def.size * 2 + 80) / 9));
    gTex.repeat.set(rep, rep);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(def.size * 2 + 80, def.size * 2 + 80),
      new THREE.MeshLambertMaterial({ map: gTex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.userData.noOutline = true;
    g.add(ground);
    const grid = new THREE.GridHelper(def.size * 2 + 60, 30, 0x333333, 0x2a2a2a);
    grid.material.transparent = true; grid.material.opacity = 0.10;
    grid.position.y = 0.02;
    g.add(grid);

    // 全局光（提亮让 Toon 分档与夜景保持可读）
    g.add(new THREE.HemisphereLight(def.hemi.sky, def.hemi.ground, def.hemi.i * 1.3));
    const dir = new THREE.DirectionalLight(def.dir.c, def.dir.i * 1.4);
    dir.position.set(def.dir.x, def.dir.y, def.dir.z);
    g.add(dir);
    g.add(new THREE.AmbientLight(0x555566, 0.35));

    // 灯光
    for (const l of def.lights) {
      const pl = new THREE.PointLight(l.c, l.i, l.d);
      pl.position.set(l.x, l.y, l.z);
      g.add(pl);
    }

    // ---- 静态几何合并（GPU加速核心）：同材质道具合并为单个网格，大幅减少 draw call ----
    const buckets = new Map();   // matKey -> {mat, geos: []}
    const bakeGeo = (geo, p) => {
      const m = new THREE.Matrix4().makeRotationY(p.ry || 0);
      m.setPosition(p.x, (p.y || 0) + p.h / 2, p.z);
      geo.applyMatrix4(m);
      return geo;
    };
    for (const p of def.props) {
      const useWin = !p.e && p.h >= 10;   // 窗格建筑保持独立（每栋独立UV重复度）
      if (useWin) {
        const t = this.trackTex(ART.windows(p.c).clone()); t.needsUpdate = true;
        t.repeat.set(Math.max(1, Math.round(p.w / 6)), Math.max(1, Math.round(p.h / 5)));
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), new THREE.MeshLambertMaterial({ map: t }));
        put(mesh, p.x, (p.y || 0) + p.h / 2, p.z, p.ry);
        g.add(mesh);
        continue;
      }
      const mat = ART.mat(p.c, { e: p.e, toon: !p.e });
      const key = mat.uuid;
      if (!buckets.has(key)) buckets.set(key, { mat, geos: [] });
      const geo = p.t === 'b'
        ? new THREE.BoxGeometry(p.w, p.h, p.d)
        : new THREE.CylinderGeometry(p.r, p.r, p.h, 14);
      buckets.get(key).geos.push(bakeGeo(geo, p));
      if (!p.nc && p.h > 0.3) {
        if (p.t === 'b') colBox(p.x, p.z, p.w, p.d, p.h, p.y || 0);
        else colCyl(p.x, p.z, p.r, p.h, p.y || 0);
      }
    }
    for (const { mat, geos } of buckets.values()) {
      const merged = mergeGeometries(geos);
      const mesh = new THREE.Mesh(merged, mat);
      g.add(mesh);
      if (this.quality.outlines) ART.outline(mesh, 1 + Math.min(0.05, 0.04 / Math.max(1, merged.boundingSphere.radius)));
    }

    // 特殊建筑
    for (const s of def.structures) {
      if (STRUCTS[s.type]) STRUCTS[s.type](g, s, def);
    }

    // 边界墙（合并为单一网格）
    const S = def.size;
    const wallMat = ART.mat(0x1a1d22);
    {
      const geos = [];
      const add = (x, z, w, d) => {
        const geo = new THREE.BoxGeometry(w, 7, d);
        const m = new THREE.Matrix4().setPosition(x, 3.5, z);
        geo.applyMatrix4(m);
        geos.push(geo);
      };
      add(0, -S - 1, S * 2 + 4, 2); add(0, S + 1, S * 2 + 4, 2);
      add(-S - 1, 0, 2, S * 2 + 4); add(S + 1, 0, 2, S * 2 + 4);
      const wallMesh = new THREE.Mesh(mergeGeometries(geos), wallMat);
      wallMesh.userData.noOutline = true;
      g.add(wallMesh);
    }
    colBox(0, -S - 1, S * 2 + 4, 2, 7); colBox(0, S + 1, S * 2 + 4, 2, 7);
    colBox(-S - 1, 0, 2, S * 2 + 4, 7); colBox(S + 1, 0, 2, S * 2 + 4, 7);

    // 补给区光环
    const bz = def.buyZone;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(bz.r * 0.82, bz.r, 42),
      new THREE.MeshBasicMaterial({ color: 0x52b788, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(bz.x, 0.06, bz.z);
    g.add(ring);
    this.buyZoneMesh = ring;
    const beacon = mkCyl(0.12, 3.2, 0x113322, 0x44ff99);
    put(beacon, bz.x, 1.6, bz.z); g.add(beacon);
    const bl = new THREE.PointLight(0x44ff99, 0.5, 12); bl.position.set(bz.x, 2.4, bz.z); g.add(bl);
    this.anims.push(() => { ring.material.opacity = 0.28 + Math.sin(this.time * 2.4) * 0.12; });

    // 为大件物体添加美漫描边（性能档位关闭时不生成）
    if (this.quality.outlines) {
      g.traverse(o => {
        if (o.userData.noOutline || o.userData.isOutline || !o.isMesh) return;
        if (o.geometry.type === 'PlaneGeometry') return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const r = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius : 0;
        if (r >= 0.9) ART.outline(o, 1 + Math.min(0.075, 0.05 / Math.max(0.5, r)));
      });
    }
  },

  shake(a) { this.shakeAmt = Math.min(0.5, Math.max(this.shakeAmt, a)); },

  update(dt) {
    this.time += dt;
    for (const f of this.anims) f(dt);
    this.shakeAmt *= Math.exp(-6.5 * dt);
    if (this.shakeAmt < 0.001) this.shakeAmt = 0;
  },

  render() { this.renderer.render(this.scene, this.camera); },
};

/* ---------- 几何合并（手动拼接，兼容 r128 无 BufferGeometryUtils） ---------- */
function mergeGeometries(geos) {
  const list = geos.map(g => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const geo of list) total += geo.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const norm = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let off = 0;
  for (const geo of list) {
    pos.set(geo.attributes.position.array, off * 3);
    norm.set(geo.attributes.normal.array, off * 3);
    if (geo.attributes.uv) uv.set(geo.attributes.uv.array, off * 2);
    off += geo.attributes.position.count;
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
