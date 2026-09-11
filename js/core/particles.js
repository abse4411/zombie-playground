/* ============================================================
 * 粒子系统 —— 三组共用粒子池（血雾 / 火花 / 烟尘）
 * ============================================================ */
const PARTICLES = {
  pools: {},
  scene: null,

  init(scene) {
    this.scene = scene;
    this._makePool('blood', 600, 0.14, 9.5);
    this._makePool('spark', 400, 0.1, 7);
    this._makePool('smoke', 300, 0.4, -1.4);  // 负重力 = 上飘
    this._makePool('rain', 900, 0.055, 30);   // 雨滴（细长下坠）
  },

  // 天气雨幕：以玩家为中心的随机落雨
  rainStep(px, pz, n) {
    const p = this.pools.rain;
    if (!p) return;
    for (let i = 0; i < n; i++) {
      this.spawn('rain', px + rand(-16, 16), rand(6, 10), pz + rand(-16, 16), 1, {
        speed: 0.6, vy: -6, life: 0.75,
        color: [0.5, 0.62, 0.78], color2: [0.35, 0.45, 0.6],
      });
    }
  },

  _makePool(name, max, size, gravity) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(max * 3);
    const colors = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) positions[i * 3 + 1] = -9999;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.pools[name] = {
      positions, colors, geo, max, cursor: 0, gravity,
      vel: new Float32Array(max * 3),
      life: new Float32Array(max),
    };
  },

  spawn(name, x, y, z, n, opts = {}) {
    const p = this.pools[name];
    if (!p) return;
    const speed = opts.speed !== undefined ? opts.speed : 4;
    const vy = opts.vy !== undefined ? opts.vy : 0;
    const life = opts.life !== undefined ? opts.life : 0.5;
    const c1 = opts.color || [1, 0, 0];
    const c2 = opts.color2 || c1;
    for (let k = 0; k < n; k++) {
      const i = p.cursor; p.cursor = (p.cursor + 1) % p.max;
      const i3 = i * 3;
      p.positions[i3] = x; p.positions[i3 + 1] = y; p.positions[i3 + 2] = z;
      // 球面随机方向
      const a = Math.random() * TAU, b = Math.acos(rand(-1, 1)), s = speed * rand(0.25, 1);
      p.vel[i3] = Math.sin(b) * Math.cos(a) * s;
      p.vel[i3 + 1] = Math.cos(b) * s + vy;
      p.vel[i3 + 2] = Math.sin(b) * Math.sin(a) * s;
      p.life[i] = life * rand(0.55, 1.35);
      const t = Math.random();
      p.colors[i3] = lerp(c1[0], c2[0], t);
      p.colors[i3 + 1] = lerp(c1[1], c2[1], t);
      p.colors[i3 + 2] = lerp(c1[2], c2[2], t);
    }
    p.geo.attributes.position.needsUpdate = true;
    p.geo.attributes.color.needsUpdate = true;
  },

  // 便捷封装
  blood(x, y, z, n = 8, head = false) {
    this.spawn('blood', x, y, z, n, {
      speed: head ? 4.5 : 3, life: 0.45,
      color: head ? [1, 0.1, 0.05] : [0.55, 0.05, 0.05], color2: [0.75, 0.1, 0.08],
    });
  },
  impact(x, y, z) { this.spawn('spark', x, y, z, 5, { speed: 5, life: 0.25, color: [1, 0.85, 0.4], color2: [0.9, 0.5, 0.1] }); this.spawn('smoke', x, y, z, 2, { speed: 0.6, life: 0.7, color: [0.35, 0.35, 0.35], color2: [0.2, 0.2, 0.2] }); },
  explosion(x, y, z) {
    this.spawn('spark', x, y + 0.4, z, 45, { speed: 11, life: 0.6, color: [1, 0.75, 0.2], color2: [1, 0.25, 0.05] });
    this.spawn('smoke', x, y + 0.8, z, 22, { speed: 2.2, vy: 2.2, life: 1.6, color: [0.25, 0.24, 0.22], color2: [0.12, 0.12, 0.12] });
  },
  flames(x, y, z, n = 2) {
    this.spawn('spark', x, y, z, n, { speed: 0.9, vy: 2.6, life: 0.55, color: [1, 0.55, 0.1], color2: [0.9, 0.15, 0.02] });
    this.spawn('smoke', x, y + 0.6, z, 1, { speed: 0.4, vy: 1.6, life: 1.1, color: [0.2, 0.18, 0.16], color2: [0.1, 0.1, 0.1] });
  },
  acidSplash(x, y, z) {
    this.spawn('blood', x, y, z, 12, { speed: 4, life: 0.5, color: [0.45, 0.9, 0.2], color2: [0.2, 0.6, 0.15] });
  },
  dust(x, y, z, n = 6) {
    this.spawn('smoke', x, y, z, n, { speed: 1.6, vy: 1, life: 0.8, color: [0.4, 0.38, 0.34], color2: [0.25, 0.24, 0.22] });
  },

  update(dt) {
    for (const name in this.pools) {
      const p = this.pools[name];
      let dirty = false;
      for (let i = 0; i < p.max; i++) {
        if (p.life[i] <= 0) continue;
        p.life[i] -= dt;
        const i3 = i * 3;
        if (p.life[i] <= 0) { p.positions[i3 + 1] = -9999; dirty = true; continue; }
        p.positions[i3] += p.vel[i3] * dt;
        p.positions[i3 + 1] += p.vel[i3 + 1] * dt;
        p.positions[i3 + 2] += p.vel[i3 + 2] * dt;
        p.vel[i3 + 1] -= p.gravity * dt;
        if (p.positions[i3 + 1] < 0.03 && p.gravity > 0) { p.life[i] = 0; p.positions[i3 + 1] = -9999; }
        dirty = true;
      }
      if (dirty) {
        p.geo.attributes.position.needsUpdate = true;
        p.geo.attributes.color.needsUpdate = true;
      }
    }
  },
};
