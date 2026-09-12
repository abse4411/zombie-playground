/* ============================================================
 * 图鉴 3D 预览（v8.8）—— 通用小渲染器：丧尸模型 / 武器模型旋转展示
 * 复用 gunModels(buildGunModel) 与 zombie 的 buildZombieModel
 * ============================================================ */
const CODEXPREVIEW = {
  renderer: null, scene: null, camera: null, model: null,
  canvas: null, raf: 0, _shownOnce: false,

  init(canvas) {
    if (this.renderer) return;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(360, 220, false);
    if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 360 / 220, 0.05, 30);
    this.camera.position.set(0, 1.3, 3.4);
    this.camera.lookAt(0, 0.9, 0);
    this.scene.add(new THREE.HemisphereLight(0xaabbcc, 0x22252b, 1.1));
    const key = new THREE.DirectionalLight(0xfff2dd, 1.15);
    key.position.set(2, 3, 2.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.65);
    rim.position.set(-3, 2, -2);
    this.scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.09, 30),
      new THREE.MeshStandardMaterial({ color: 0x1e232a, roughness: 0.4, metalness: 0.65 }));
    disc.position.y = -0.045;
    this.scene.add(disc);
    this._loop = this._loop.bind(this);
    this._loop();
  },

  showZombie(typeId) {
    if (!this.renderer) return;
    this._resize();
    this._clear();
    const cfg = ZOMBIE_TYPES[typeId];
    if (!cfg) return;
    // 丧尸模型（不描边避免小画布糊）
    const model = cfg.quadruped ? buildQuadrupedModel(cfg, false) : buildZombieModel(cfg, false);
    model.group.rotation.x = 0;
    if (cfg.crawl) model.group.rotation.x = 0;   // 爬行体展示用站姿缩放
    this.model = model.group;
    this.model.position.y = 0;
    this.scene.add(this.model);
    this._fit(this.model, 2.1);
  },

  showWeapon(def) {
    if (!this.renderer) return;
    this._resize();
    this._clear();
    const gun = buildGunModel(def, { outlines: true, tint: 0xffffff });
    this.model = gun;
    this.scene.add(gun);
    // 武器平置旋转：居中+放大
    const box = new THREE.Box3().setFromObject(gun);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const s = 1.9 / (Math.max(size.x, size.y, size.z) || 1);
    gun.scale.setScalar(s);
    gun.position.set(-center.x * s, -center.y * s + 0.9, -center.z * s);
    gun.rotation.z = 0;
    this.camera.position.set(0, 1.15, 2.2);
    this.camera.lookAt(0, 0.9, 0);
  },

  _clear() {
    if (this.model) { disposeObject3D(this.model); this.scene.remove(this.model); this.model = null; }
    this.camera.position.set(0, 1.3, 3.4);
    this.camera.lookAt(0, 0.9, 0);
  },

  _fit(obj, targetH) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const h = size.y || 1;
    const s = targetH / h;
    obj.scale.setScalar(s);
    obj.position.y = -box.min.y * s;
  },

  _resize() {
    const cw = this.canvas.clientWidth || 360, ch = this.canvas.clientHeight || 220;
    this.renderer.setSize(cw, ch, true);
    this.camera.aspect = cw / ch;
    this.camera.updateProjectionMatrix();
  },

  _loop() {
    this.raf = requestAnimationFrame(this._loop);
    if (!this.renderer) return;
    if (this.model) this.model.rotation.y += 0.013;
    this.renderer.render(this.scene, this.camera);
    // 后台标签兜底：仅在展示新模型后补一帧（_shownOnce 机制由外部触发 renderSync）
  },

  renderSync() {
    if (this.renderer) this.renderer.render(this.scene, this.camera);
  },
};
