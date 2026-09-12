/* ============================================================
 * 角色选择 3D 预览（v6.2）—— 独立小渲染器，旋转展示
 * ============================================================ */
const CHARPREVIEW = {
  renderer: null, scene: null, camera: null, model: null,
  canvas: null, raf: 0,

  init(canvas) {
    if (this.renderer) return;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14171c);
    this.camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 20);
    this.camera.position.set(0, 1.15, 3.2);
    this.camera.lookAt(0, 0.95, 0);
    this.scene.add(new THREE.HemisphereLight(0x9fb4cc, 0x2a2d33, 1.0));
    const key = new THREE.DirectionalLight(0xfff2dd, 1.2);
    key.position.set(2, 3, 2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.7);
    rim.position.set(-3, 2, -2);
    this.scene.add(rim);
    // 底座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.4, metalness: 0.6 }));
    base.position.y = -0.06;
    this.scene.add(base);
    this._loop = this._loop.bind(this);
    this._loop();
  },

  show(charId) {
    if (!this.renderer) return;
    if (this.model) { this.scene.remove(this.model.group); }
    const ch = getCharacter(charId);
    const colors = CHARACTER_BODY_COLORS[charId] || CHARACTER_BODY_COLORS.raven;
    const body = buildPlayerBody(colors);
    // 完整形象：胸+头+手臂（静态持枪姿）——胸腔仅预览用，第一人称身体不含（避免挡视线）
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
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.62), ART.mat(0x1c1e22));
    gun.position.set(0.12, 1.0, 0.4);
    body.group.add(chest, vest, head, armR, armL, gun);
    body.group.position.y = 0;
    this.model = body;
    this.scene.add(body.group);
  },

  _loop() {
    this.raf = requestAnimationFrame(this._loop);
    if (!this.renderer) return;
    if (this.model) this.model.group.rotation.y += 0.012;
    this.renderer.render(this.scene, this.camera);
  },
};
