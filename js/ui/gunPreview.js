/* ============================================================
 * 商城武器 3D 预览（v7.4）—— 独立小渲染器，旋转展示 gunModels 模型
 * ============================================================ */
const GUNPREVIEW = {
  renderer: null, scene: null, camera: null, gun: null,
  canvas: null, raf: 0, nameEl: null,

  init(canvas, nameEl) {
    if (this.renderer) return;
    this.canvas = canvas;
    this.nameEl = nameEl;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, canvas.clientWidth / canvas.clientHeight, 0.02, 20);
    this.camera.position.set(0.42, 0.32, 0.75);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xaabbcc, 0x2a2d33, 1.1));
    const key = new THREE.DirectionalLight(0xfff2dd, 1.15);
    key.position.set(1.5, 2, 1.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.6);
    rim.position.set(-2, 1, -1.5);
    this.scene.add(rim);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.06, 28),
      new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.45, metalness: 0.6 }));
    ground.position.y = -0.36;
    this.scene.add(ground);
    this._loop = this._loop.bind(this);
    this._loop();
  },

  show(def, label) {
    if (!this.renderer) return;
    // 面板打开后 canvas 才有实际尺寸（init 时 display:none 曾被设为 0），每次 show 同步
    const cw = this.canvas.clientWidth || 300, ch = this.canvas.clientHeight || 150;
    this.renderer.setSize(cw, ch, true);
    this.camera.aspect = cw / ch;
    this.camera.updateProjectionMatrix();
    if (this.gun) { disposeObject3D(this.gun); this.scene.remove(this.gun); this.gun = null; }
    if (this.nameEl) this.nameEl.textContent = label || (def ? def.name : '—');
    if (!def) return;
    const gun = buildGunModel(def, { outlines: true, tint: 0xffffff });
    // 居中 + 适配缩放
    const box = new THREE.Box3().setFromObject(gun);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 0.62 / maxDim;
    gun.scale.setScalar(s);
    gun.position.set(-center.x * s, -center.y * s, -center.z * s);
    this.gun = gun;
    this.scene.add(gun);
    // 立即渲染一帧：后台标签 rAF 停摆时也保证可见（前台由 _loop 持续旋转）
    this.renderer.render(this.scene, this.camera);
  },

  _loop() {
    this.raf = requestAnimationFrame(this._loop);
    if (!this.renderer) return;
    if (this.gun) this.gun.rotation.y += 0.014;
    this.renderer.render(this.scene, this.camera);
  },
};
