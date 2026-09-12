/* ============================================================
 * 主菜单 3D 场景（v9.0）—— DOOM 式实时背景：主角+丧尸对峙
 * 复用 buildPlayerBody/buildZombieModel/buildGunModel
 * ============================================================ */
const MENUSCENE = {
  renderer: null, scene: null, camera: null,
  hero: null, zombies: [], gun: null,
  canvas: null, raf: 0, t: 0,

  init(canvas) {
    if (this.renderer) { this.syncHero(); return; }
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0c0812, 0.055);
    this.scene.background = null;   // 透出CSS渐变
    this.camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 60);
    this.camera.position.set(-3.6, 1.9, 6.6);
    this.camera.lookAt(0.8, 1.2, 0);
    // 灯光：暖key + 冷rim + 地面补
    this.scene.add(new THREE.HemisphereLight(0x3a3a5e, 0x0e0b12, 0.6));
    const key = new THREE.DirectionalLight(0xffc890, 0.95);
    key.position.set(4, 6, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5a8aff, 0.9);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);
    const redGlow = new THREE.PointLight(0xe63946, 1.5, 20);
    redGlow.position.set(0, 2.4, -4);
    this.scene.add(redGlow);
    // 地面
    const ground = new THREE.Mesh(new THREE.CircleGeometry(16, 36),
      new THREE.MeshStandardMaterial({ color: 0x141019, roughness: 0.95, metalness: 0.1 }));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    // 游乐园剪影元素（摩天轮辐条感）
    for (let i = 0; i < 7; i++) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.18, rand(5, 9), 0.18),
        new THREE.MeshStandardMaterial({ color: 0x241f2e, roughness: 0.9 }));
      pole.position.set(rand(-16, -8) * (i % 2 ? 1 : -1), pole.geometry.parameters.height / 2, rand(-14, -7));
      this.scene.add(pole);
    }
    // 丧尸观众席（对峙感）
    this.zombies = [];
    const spots = [[-2.2, -2.5, 'walker'], [2.8, -3.4, 'runner'], [-3.8, -1.2, 'stalker'], [4.2, -1.6, 'hound'], [1.2, -5, 'brute']];
    for (const [x, z, id] of spots) {
      const cfg = ZOMBIE_TYPES[id];
      const m = cfg.quadruped ? buildQuadrupedModel(cfg, true) : buildZombieModel(cfg, true);
      m.group.position.set(x, 0, z);
      m.group.rotation.y = Math.atan2(-x, -z + 2.5) + Math.PI;   // 朝向中心
      this.scene.add(m.group);
      this.zombies.push(m);
    }
    this.syncHero();
    this._resize();
    this._loop = this._loop.bind(this);
    this._loop();
  },

  // 重建主角（跟随存档干员）
  syncHero() {
    if (!this.scene) return;
    if (this.hero) { this.scene.remove(this.hero.group); this.hero = null; }
    if (this.gun) { this.scene.remove(this.gun); this.gun = null; }
    const chId = (typeof SAVE !== 'undefined' && SAVE.data.character) || 'raven';
    const colors = CHARACTER_BODY_COLORS[chId] || CHARACTER_BODY_COLORS.raven;
    const body = buildPlayerBody(colors);
    // 预览补胸腔+头（与 CHARPREVIEW 同款完整形象）
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.24), ART.mat(colors.shirt));
    chest.position.y = 1.28;
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.26, 0.28), ART.mat(colors.vest));
    vest.position.y = 1.3;
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), ART.mat(0xc9a084));
    skull.scale.set(1, 1.1, 1.05);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 10, 0, TAU, 0, 1.5), ART.mat(0x241a12));
    hair.position.y = 0.02;
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.05), ART.mat(0x11141a));
    shades.position.set(0, 0.03, 0.16);
    head.add(skull, hair, shades);
    head.position.y = 1.62;
    const armR = buildArm(ART.mat(0xc9a084), ART.mat(colors.shirt),
      new THREE.Vector3(0.26, 1.32, 0.1), new THREE.Vector3(0.18, 1.05, 0.35), 0.06);
    const armL = buildArm(ART.mat(0xc9a084), ART.mat(colors.shirt),
      new THREE.Vector3(-0.26, 1.32, 0.1), new THREE.Vector3(-0.1, 1.0, 0.32), 0.06);
    body.group.add(chest, vest, head, armR, armL);
    body.group.position.x = 1.1;
    body.group.rotation.y = -0.5;   // 微侧身面向镜头
    this.hero = body;
    this.scene.add(body.group);
    // 手中武器（AWM 最有画面感；无权限则 P92）
    const gunDef = (SAVE.data.unlockedWeapons || []).includes('awm') || true ? WEAPONS.awm : WEAPONS.p92;
    const gun = buildGunModel(WEAPONS.awm, { outlines: true, tint: 0xffffff });
    gun.scale.setScalar(1.15);
    gun.position.set(1.32, 1.06, 0.42);
    gun.rotation.y = -0.12;
    this.gun = gun;
    this.scene.add(gun);
    // 相机焦点回正
    this.camera.position.set(-3.6, 1.9, 6.6);
    this.camera.lookAt(0.8, 1.2, 0);
  },

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  },

  _loop() {
    this.raf = requestAnimationFrame(this._loop);
    if (!this.renderer) return;
    this.t += 0.016;
    // 缓慢相机漂移（呼吸感）
    const cam = this.camera;
    cam.position.x = -3.6 + Math.sin(this.t * 0.1) * 0.35;
    cam.position.y = 1.9 + Math.sin(this.t * 0.16) * 0.08;
    cam.lookAt(0.8, 1.2, 0);
    // 主角呼吸微动
    if (this.hero) {
      this.hero.group.position.y = Math.sin(this.t * 1.4) * 0.015;
      this.hero.group.rotation.y = -0.35 + Math.sin(this.t * 0.3) * 0.03;
    }
    // 丧尸 idle 摇晃
    for (const m of this.zombies) {
      if (!m.quadruped) {
        m.head.rotation.z = Math.sin(this.t * 0.9 + m.group.position.x) * 0.1;
        m.arms[0].rotation.x = -1.1 + Math.sin(this.t * 1.1 + m.group.position.z) * 0.08;
        m.arms[1].rotation.x = -1.2 + Math.cos(this.t * 0.9) * 0.08;
      }
    }
    this.renderer.render(this.scene, this.camera);
  },
};
