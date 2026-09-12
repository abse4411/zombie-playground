/* ============================================================
 * 丧尸实体 —— 程序化美漫模型 + 9 种行为 AI
 * ============================================================ */
let _shadowMat = null;
let _shadowGeo = null;   // 全体丧尸共享的接地阴影几何体
let ZOMBIE_SEQ = 0;
const ZOMBIE_POOL = {};  // 模型对象池：typeId(+dummy) -> [group,...]

function buildZombieModel(cfg, outlines) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const skin = ART.toon(cfg.skin);
  const cloth = ART.toon(cfg.cloth);
  const pants = ART.toon(cfg.pants);
  const bloodMat = ART.mat(0x5a1010);
  const headS = cfg.headBig ? 1.4 : 1;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.3), cloth);
  torso.position.y = 1.15; g.add(torso);

  // 破布条与血污
  for (let i = 0; i < 3; i++) {
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(rand(0.08, 0.16), rand(0.12, 0.26), 0.02),
      i % 2 ? bloodMat : pants
    );
    patch.position.set(rand(-0.2, 0.2), rand(0.9, 1.4), 0.155);
    patch.rotation.z = rand(-0.4, 0.4);
    g.add(patch);
  }

  if (cfg.armorPlate) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.4), ART.mat(0x2e3638));
    plate.position.y = 1.22; g.add(plate);
    // 战术背心挂载包
    for (const side of [-1, 1]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), ART.mat(0x232a24));
      pouch.position.set(side * 0.18, 1.12, 0.21); g.add(pouch);
    }
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34 * headS, 0.34 * headS, 0.34 * headS), skin);
  head.position.y = 1.68 * headS + (cfg.headBig ? 0.02 : 0);
  g.add(head);

  // 下颚（张口咬人感）
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.22 * headS, 0.07 * headS, 0.1 * headS), bloodMat);
  jaw.position.set(0, head.position.y - 0.16 * headS, 0.14 * headS);
  g.add(jaw);

  const headBits = [head, jaw];   // 头部集群：爆头解体时一起崩飞
  const eyeC = (cfg.big || cfg.armorPlate) ? 0xff3838 : 0xffd23f;
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeC });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), eyeMat);
    eye.position.set(side * 0.08 * headS, head.position.y + 0.04, 0.17 * headS);
    g.add(eye);
    headBits.push(eye);
  }

  // 类型专属配件
  if (cfg.armorPlate) { // 头盔 + 面罩
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * headS, 0.14, 0.4 * headS), ART.mat(0x2a3230));
    helm.position.set(0, head.position.y + 0.18 * headS, 0); g.add(helm);
    headBits.push(helm);
  }
  if (cfg.typeId === 'jester' || cfg.zigzag) { // 小丑帽
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), ART.mat(side < 0 ? 0xc04868 : 0x48a0b8));
      horn.position.set(side * 0.12, head.position.y + 0.24, 0);
      horn.rotation.z = side * 0.5; g.add(horn);
      headBits.push(horn);
    }
  }
  if (cfg.big) { // 暴君肩甲与巨臂
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.34), ART.mat(0x3a3028));
      pad.position.set(side * 0.42, 1.5, 0); g.add(pad);
    }
  }

  // 专属特征件（v7.3 精致化）：每型 2~4 个辨识件（生化危机式不对称变异语言）
  {
    const flesh = ART.mat(0x9a4038, 0x300808);
    const P = (geo, mat, x, y, z, rz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rz) m.rotation.z = rz;
      g.add(m);
      return m;
    };
    switch (cfg.id) {
      case 'walker': // 外露肋骨 + 歪斜头
        for (let i = 0; i < 3; i++) P(new THREE.BoxGeometry(0.03, 0.04, 0.26), flesh, 0.29, 1.02 + i * 0.09, 0);
        head.rotation.z = 0.18;
        break;
      case 'runner': // 前倾躯干 + 背部撕裂布
        torso.rotation.x = 0.18;
        P(new THREE.BoxGeometry(0.2, 0.14, 0.03), flesh, -0.1, 1.3, -0.17, 0.2);
        break;
      case 'stalker': // 脊刺×4
        for (let i = 0; i < 4; i++) P(new THREE.ConeGeometry(0.045, 0.14, 5), flesh, rand(-0.08, 0.08), 1.32 - i * 0.14, -0.17);
        break;
      case 'spitter': // 喉囊 + 酸斑
        P(new THREE.BoxGeometry(0.16, 0.16, 0.12), ART.mat(0x8fb05a, 0x2a3a14), 0, 1.52, 0.12);
        P(new THREE.BoxGeometry(0.1, 0.08, 0.03), ART.mat(0x9cc45a, 0x2a3a14), -0.12, 1.05, 0.16, 0.3);
        break;
      case 'bloater': // 巨腹 + 气孔斑
        P(new THREE.BoxGeometry(0.5, 0.4, 0.34), ART.mat(0xa8a878, 0x222211), 0, 0.95, 0.03);
        for (let i = 0; i < 4; i++) P(new THREE.BoxGeometry(0.07, 0.07, 0.02), ART.mat(0x6a7048, 0x141810), rand(-0.16, 0.16), 1.0 + rand(-0.1, 0.1), 0.18);
        break;
      case 'screamer': // 喉管外露
        P(new THREE.BoxGeometry(0.06, 0.2, 0.05), flesh, 0, 1.42, 0.12);
        break;
      case 'armored': // 护膝 + 面罩板 + 弹挂袋
        P(new THREE.BoxGeometry(0.2, 0.12, 0.06), ART.mat(0x2e3638), -0.16, 0.5, 0.12);
        P(new THREE.BoxGeometry(0.2, 0.12, 0.06), ART.mat(0x2e3638), 0.16, 0.5, 0.12);
        P(new THREE.BoxGeometry(0.3, 0.1, 0.04), ART.mat(0x232a24), 0, 1.68, 0.15);
        P(new THREE.BoxGeometry(0.1, 0.12, 0.06), ART.mat(0x232a24), 0.2, 1.0, 0.18);
        break;
      case 'jester': // 彩条补丁 + 歪帽檐
        P(new THREE.BoxGeometry(0.1, 0.16, 0.02), ART.mat(0x40a0a0), -0.14, 1.25, 0.17, 0.4);
        P(new THREE.BoxGeometry(0.1, 0.16, 0.02), ART.mat(0xa03050), 0.14, 1.1, 0.17, -0.3);
        P(new THREE.BoxGeometry(0.4, 0.03, 0.3), ART.mat(0xa03050), 0, head.position.y + 0.14, 0);
        break;
      case 'charger': // 不对称巨肩 + 背部肌束
        P(new THREE.BoxGeometry(0.3, 0.26, 0.4), ART.mat(0x6a4a3a), 0.28, 1.5, 0);
        for (let i = 0; i < 3; i++) P(new THREE.BoxGeometry(0.06, 0.3, 0.04), flesh, -0.1 + i * 0.1, 1.3, -0.17);
        break;
      case 'toxic': // 背部囊袋×2
        P(new THREE.BoxGeometry(0.16, 0.2, 0.1), ART.mat(0x5a7a3a, 0x1a2a08), -0.12, 1.45, -0.18);
        P(new THREE.BoxGeometry(0.13, 0.16, 0.09), ART.mat(0x5a7a3a, 0x1a2a08), 0.14, 1.4, -0.18);
        break;
      case 'radiant': // 荧光晶体×3（emissive发光）
        P(new THREE.ConeGeometry(0.05, 0.2, 5), ART.mat(0x39ff6a, 0x1a8a3a), -0.14, 1.35, -0.16, 0.3);
        P(new THREE.ConeGeometry(0.04, 0.16, 5), ART.mat(0x39ff6a, 0x1a8a3a), 0.15, 1.5, -0.16, -0.2);
        P(new THREE.BoxGeometry(0.03, 0.3, 0.03), ART.mat(0x59ff7a, 0x1a8a3a), 0, 1.15, -0.17);
        break;
      case 'phantom': // 残破披风片 + 指爪
        P(new THREE.BoxGeometry(0.18, 0.5, 0.02), ART.mat(0x2a2e3e, 0x0a0c14), -0.08, 1.05, -0.18, 0.15);
        P(new THREE.BoxGeometry(0.14, 0.4, 0.02), ART.mat(0x2a2e3e, 0x0a0c14), 0.16, 1.0, -0.18, -0.2);
        break;
      case 'witch': // 蓬乱长发 + 爪手 + 泪痕
        P(new THREE.BoxGeometry(0.3, 0.5, 0.06), ART.mat(0xd8c8d8, 0x2a1a22), 0, head.position.y + 0.05, -0.12);
        P(new THREE.BoxGeometry(0.05, 0.22, 0.05), ART.mat(0xe8e0e8, 0x2a1a22), 0.16, 1.15, 0.12);
        P(new THREE.BoxGeometry(0.05, 0.22, 0.05), ART.mat(0xe8e0e8, 0x2a1a22), -0.16, 1.15, 0.12);
        P(new THREE.BoxGeometry(0.08, 0.03, 0.02), ART.mat(0x8a3040, 0x2a0a0e), 0, head.position.y - 0.02, 0.16);
        break;
      case 'tank': // 巨石手持 + 脊背隆起 + 撕裂衣
        P(new THREE.BoxGeometry(0.34, 0.3, 0.34), ART.mat(0x5a5248, 0x14100c), 0.55, 1.35, 0.1);
        P(new THREE.ConeGeometry(0.3, 0.4, 5), ART.mat(0x8a5a42, 0x1a0e08), 0, 1.72, -0.05);
        P(new THREE.BoxGeometry(0.2, 0.4, 0.03), ART.mat(0x3a2a22, 0x0e0806), -0.1, 1.2, 0.17, 0.3);
        break;
      case 'boomer': // 巨腹胆囊 + 胆汁渍 + 溃烂斑
        P(new THREE.BoxGeometry(0.52, 0.44, 0.38), ART.mat(0x9aa878, 0x2a3418), 0, 0.92, 0.04);
        P(new THREE.BoxGeometry(0.14, 0.1, 0.03), ART.mat(0x7a9a3a, 0x2a3a10), 0, 1.1, 0.2);
        P(new THREE.BoxGeometry(0.1, 0.08, 0.03), ART.mat(0x6a8a32, 0x2a3a10), -0.15, 0.85, 0.2, 0.3);
        break;
      case 'smoker': // 长舌垂须 + 咳嗽雾
        P(new THREE.BoxGeometry(0.03, 0.6, 0.03), ART.mat(0xb0a080, 0x2a2418), 0.06, head.position.y - 0.34, 0.12);
        P(new THREE.BoxGeometry(0.03, 0.45, 0.03), ART.mat(0xb0a080, 0x2a2418), -0.05, head.position.y - 0.28, 0.1, 0.15);
        P(new THREE.BoxGeometry(0.12, 0.08, 0.03), ART.mat(0x8a9a7a, 0x1a2418), 0, 1.5, 0.16);
        break;
      case 'hunter': // 兜帽衫 + 缠布护腕
        P(new THREE.BoxGeometry(0.56, 0.2, 0.32), ART.mat(0x2a2a32, 0x0a0a10), 0, 1.38, 0);
        P(new THREE.BoxGeometry(0.13, 0.1, 0.13), ART.mat(0x8a3040, 0x1a0a0e), 0.38, 1.2, 0);
        P(new THREE.BoxGeometry(0.13, 0.1, 0.13), ART.mat(0x8a3040, 0x1a0a0e), -0.38, 1.2, 0);
        break;
      case 'licker': // 无皮肌理 + 长舌 + 脑露 + 巨爪
        P(new THREE.BoxGeometry(0.2, 0.06, 0.34), ART.mat(0xd8a0a0, 0x301014), 0, head.position.y + 0.1, 0); // 外露脑块
        P(new THREE.BoxGeometry(0.035, 0.5, 0.035), ART.mat(0xc05858, 0x2a0a0a), 0, head.position.y - 0.32, 0.16); // 垂落长舌
        for (let i = 0; i < 3; i++) P(new THREE.BoxGeometry(0.02, 0.1, 0.02), flesh, 0.37 - i * 0.03, 1.2 - i * 0.06, 0.14 - i * 0.02); // 巨爪指
        break;
      case 'regenerator': // 臃肿孔洞
        P(new THREE.BoxGeometry(0.5, 0.42, 0.34), ART.mat(0x9a9aa2, 0x18181e), 0, 0.95, 0.03);
        for (let i = 0; i < 5; i++) P(new THREE.BoxGeometry(0.06, 0.06, 0.03), ART.mat(0x101014, 0x000000), Math.sin(i * 2.4) * 0.18, 1.0 + Math.cos(i * 1.7) * 0.16, 0.18);
        break;
      case 'ivy': // 花冠头 + 茎裙 + 藤臂
        for (let i = 0; i < 5; i++) {
          const a2 = (i / 5) * TAU;
          P(new THREE.BoxGeometry(0.1, 0.22, 0.04), ART.mat(0x7ab04a, 0x1a3a10), Math.cos(a2) * 0.2, head.position.y + 0.08, Math.sin(a2) * 0.2, 0.3 * Math.cos(a2));
        }
        P(new THREE.CylinderGeometry(0.16, 0.34, 0.8, 7), ART.mat(0x3e6a34, 0x12240e), 0, 0.42, 0); // 茎干裙
        P(new THREE.BoxGeometry(0.05, 0.6, 0.05), ART.mat(0x2e5228), 0.34, 1.15, 0.06, 0.4);        // 藤臂右
        P(new THREE.BoxGeometry(0.05, 0.55, 0.05), ART.mat(0x2e5228), -0.34, 1.2, 0.06, -0.4);      // 藤臂左
        break;
      case 'brute': // 外露心脏 + 不对称巨右臂 + 装甲残片
        P(new THREE.BoxGeometry(0.16, 0.16, 0.1), ART.mat(0xa82020, 0x400808), 0.12, 1.28, 0.17);
        P(new THREE.BoxGeometry(0.22, 0.7, 0.22), ART.mat(0x8a4a42, 0x200606), 0.52, 1.15, 0);
        P(new THREE.BoxGeometry(0.26, 0.12, 0.3), ART.mat(0x2e3638), -0.3, 1.55, 0);
        break;
    }
  }

  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.37, 1.44, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.15), skin);
    arm.position.y = -0.3;
    armPivot.add(arm); g.add(armPivot); arms.push(armPivot);
  }
  for (const side of [-1, 1]) {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.16, 0.78, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.78, 0.19), pants);
    leg.position.y = -0.39;
    legPivot.add(leg); g.add(legPivot); legs.push(legPivot);
  }

  // 美漫描边（躯干/头/四肢）
  if (outlines) {
    for (const m of [torso, head, jaw]) ART.outline(m, 1.14);
    for (const pv of [...arms, ...legs]) for (const c of pv.children) ART.outline(c, 1.16);
  }

  g.scale.setScalar(cfg.scale);
  if (cfg.crawl) g.rotation.x = 1.0;

  return { group: g, skin, cloth, head, arms, legs, headBits, tilt: cfg.crawl ? 1.0 : 0 };
}

/* ---------- 机械机甲模型（v10.1 XT-300） ---------- */
function buildMechModel(cfg, outlines) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const steel = ART.mat(0x4a525a, {}).clone ? ART.mat(0x4a525a) : new THREE.MeshStandardMaterial({ color: 0x4a525a });
  const dark = ART.mat(0x22262c);
  const red = new THREE.MeshStandardMaterial({ color: 0xb03828, emissive: 0x901010, emissiveIntensity: 0.8 });
  const B = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); g.add(m); return m;
  };
  const C = (r, h, mat, x, y, z, axis) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z); g.add(m); return m;
  };
  // 主躯干（装甲盒）
  B(1.0, 0.9, 0.7, steel, 0, 1.5, 0);
  B(0.7, 0.3, 0.5, dark, 0, 2.05, 0);                  // 传感桅杆座
  C(0.05, 0.5, dark, 0, 2.4, 0, 'y');                  // 天线
  // 炮塔（可破坏弱点——存引用）
  const turret = new THREE.Group();
  turret.position.set(0, 2.0, 0.25);
  const tBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.3, 10), dark);
  const tGun = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.7), steel);
  tGun.position.set(0, 0.08, 0.35);
  const tBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), dark);
  tBarrel.rotation.x = Math.PI / 2; tBarrel.position.set(0, 0.08, 0.75);
  const tEye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), red);
  tEye.position.set(0, 0.16, 0.2);
  turret.add(tBase, tGun, tBarrel, tEye);
  g.add(turret);
  // 导弹巢（肩部）
  for (const sx of [-1, 1]) {
    const pod = B(0.3, 0.4, 0.4, dark, sx * 0.65, 1.75, 0);
    for (let i = 0; i < 4; i++) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), red.clone());
      tube.rotation.x = Math.PI / 2;
      tube.position.set(sx * 0.65 + (i % 2 ? 0.08 : -0.08), 1.85 - Math.floor(i / 2) * 0.16, 0.22);
      g.add(tube);
    }
  }
  // 双臂（液压爪）
  for (const sx of [-1, 1]) {
    B(0.28, 0.7, 0.28, steel, sx * 0.7, 1.2, 0);
    B(0.34, 0.3, 0.34, dark, sx * 0.72, 0.75, 0.05);
  }
  // 双足（反关节）
  for (const sx of [-1, 1]) {
    B(0.3, 0.55, 0.34, steel, sx * 0.32, 0.55, 0);
    B(0.36, 0.16, 0.55, dark, sx * 0.32, 0.1, 0.08);
  }
  // 胸口核心（发光弱点点缀）
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.08), red);
  core.position.set(0, 1.55, 0.37);
  g.add(core);
  if (outlines) { }
  g.scale.setScalar(cfg.scale);
  return { group: g, skin: steel, cloth: dark, head: tEye, arms: [], legs: [], headBits: [tEye], tilt: 0, mech: true, turret };
}

/* ---------- 四足模型（地狱犬） ---------- */
function buildQuadrupedModel(cfg, outlines) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const skin = ART.toon(cfg.skin);
  const bloodMat = ART.mat(0x5a1010);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.92), skin);
  body.position.y = 0.62; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.34), skin);
  head.position.set(0, 0.78, 0.52); g.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), bloodMat);
  jaw.position.set(0, 0.7, 0.62); g.add(jaw);
  const eyeC = 0xff7020;
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeC });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), eyeMat);
    eye.position.set(side * 0.09, 0.84, 0.66);
    g.add(eye);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 5), skin);
    ear.position.set(side * 0.1, 0.97, 0.45);
    g.add(ear);
  }
  // 背部火焰纹（发光斑块）
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.14), ART.mat(0x903010, 0xb04000));
    flame.position.set(rand(-0.08, 0.08), 0.82, 0.25 - i * 0.28);
    g.add(flame);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.34), skin);
  tail.position.set(0, 0.72, -0.58); tail.rotation.x = -0.5; g.add(tail);
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.14, 0.48, sz * 0.3);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.48, 0.11), skin);
    leg.position.y = -0.24;
    pivot.add(leg); g.add(pivot); legs.push(pivot);
  }
  if (outlines) { ART.outline(body, 1.14); ART.outline(head, 1.14); }
  // 四足专属特征件（v7.3）：地狱犬=外露肋骨+脊刺+断尾 / 獠王=弯獠牙+背鬃
  {
    const flesh = ART.mat(0x9a4038, 0x300808);
    const P = (geo, mat, x, y, z, rx) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      g.add(m);
      return m;
    };
    if (cfg.id === 'boar') {
      P(new THREE.BoxGeometry(0.04, 0.04, 0.16), ART.mat(0xe8e0d0), -0.08, 0.66, 0.68, -0.5);  // 左弯獠牙
      P(new THREE.BoxGeometry(0.04, 0.04, 0.16), ART.mat(0xe8e0d0), 0.08, 0.66, 0.68, -0.5);  // 右弯獠牙
      for (let i = 0; i < 4; i++) P(new THREE.ConeGeometry(0.05, 0.16, 4), flesh, 0, 0.82, 0.25 - i * 0.18, -0.3); // 背鬃
      P(new THREE.BoxGeometry(0.3, 0.05, 0.5), ART.mat(0x3a2c1e), 0, 0.44, 0.05);             // 厚皮褶皱
    } else { // hound 等其他四足
      for (let i = 0; i < 3; i++) P(new THREE.BoxGeometry(0.3, 0.035, 0.05), flesh, 0, 0.55, 0.15 - i * 0.12); // 外露肋骨
      for (let i = 0; i < 3; i++) P(new THREE.ConeGeometry(0.04, 0.12, 4), flesh, 0, 0.83, 0.1 - i * 0.16, -0.4); // 脊刺
    }
  }
  g.scale.setScalar(cfg.scale);
  return { group: g, skin, cloth: skin, head, arms: [], legs, headBits: [head, jaw], tilt: 0, quadruped: true };
}

class Zombie {
  constructor(typeId, x, z, mults, opts = {}) {
    const cfg = ZOMBIE_TYPES[typeId];
    this.uid = ++ZOMBIE_SEQ;
    this.type = cfg; this.typeId = typeId;
    this.dummy = !!opts.dummy;              // 教学假人：不动手、不反击
    this.net = !!opts.net;                  // 联机网络傀儡（客户端）
    this.boss = !!opts.boss;                // Boss：血条 + 超大
    this.bossCfg = (this.boss && opts.bossId && GAMECONFIG.bosses) ? GAMECONFIG.bosses[opts.bossId] : null;
    // 变异列表（v7.0）：支持叠加，最多4种（兼容旧单数 opts.affix）
    this.affixes = (opts.affixList && opts.affixList.length) ? opts.affixList.slice(0, 4) : (opts.affix ? [opts.affix] : []);
    this.affix = this.affixes[0] || null;
    const affix = this.affix;
    const AG = GAMECONFIG.zombieAggro || { rateMult: 1, rangeBonus: 0, speedMult: 1 };
    // 攻击欲望强化（v7.0）：攻击更频繁、距离更远；实例类型统一克隆以便实例化修改
    this.type = Object.assign({}, cfg);
    this.type.attackRange = cfg.attackRange + AG.rangeBonus;
    this.type.attackRate = cfg.attackRate * AG.rateMult;
    // 变异叠加乘算
    let affHp = 1, affSpd = 1, affDmg = 1, affScale = 1;
    for (const a of this.affixes) {
      affHp *= a.hp || 1; affSpd *= a.speed || 1; affDmg *= a.dmg || 1;
      if (a.scale) affScale *= a.scale;
    }
    this.affixKb = this.affixes.reduce((m, a) => Math.max(m, a.kb || 0), 0);
    this.affixHeal = Math.min(0.16, this.affixes.reduce((s2, a) => s2 + (a.heal || 0), 0));
    this.maxHp = Math.round(cfg.hp * mults.hp * affHp * (this.boss ? GAMECONFIG.boss.hpMult : 1));
    this.hp = this.maxHp;
    this.speed = cfg.speed * mults.speed * rand(0.9, 1.12) * affSpd * AG.speedMult;
    this.damage = cfg.damage * mults.dmg * affDmg;
    this.reward = Math.round(cfg.reward * mults.reward
      * (GAMECONFIG.economy.rewardGlobalMult || 1)
      * Math.pow(GAMECONFIG.elites.rewardMult, Math.min(3, this.affixes.length))
      * (this.boss ? GAMECONFIG.boss.rewardMult : 1));
    // 幕末专属Boss（v6.9）：独立数值（暴君Ω/灯塔巨像/方舟刽子手）
    if (this.bossCfg) {
      const B = this.bossCfg;
      this.maxHp = Math.round(B.hp * mults.hp);
      this.hp = this.maxHp;
      this.speed = B.speed * mults.speed;
      this.damage = B.dmg * mults.dmg;
      this.reward = Math.round(B.reward * (GAMECONFIG.economy.rewardGlobalMult || 1));
    }
    // 变异特性合并进实例类型（v6.9→v7.0 多变异）：易爆/长爪/铁甲
    const _ex = this.affixes.find(a => a.explode), _rc = this.affixes.find(a => a.reach), _fa = this.affixes.find(a => a.frontArmor);
    if (_ex) this.type.explode = _ex.explode;
    if (_rc) this.type.attackRange = this.type.attackRange * _rc.reach;
    if (_fa) this.type.frontArmor = _fa.frontArmor;

    this.state = 'rise'; this.riseT = 0.9;
    this.dead = false; this.deadT = 0; this.remove = false;
    this.stagger = 0; this.attackCd = rand(0.3, 0.9); this.windup = -1;
    this.walkPhase = rand(0, TAU);
    this.screamT = cfg.scream ? rand(3.5, 6.5) : 0;
    this.spitT = cfg.ranged ? rand(1.5, 3.2) : 0;
    this.lungeT = rand(1, 2.5); this.lungeActive = 0;
    this.zigPhase = rand(0, TAU); this.dashT = rand(2, 4);
    this.buffT = 0; this.flashT = 0;
    this.kvx = 0; this.kvz = 0;             // 击退冲量
    this.growlPitch = rand(0.85, 1.25);
    // 追击AI（v4.2）：视线记忆 + 沿墙方向 + 卡住脱困
    this.steer = { side: Math.random() < 0.5 ? 1 : -1, wallT: 0, stuckT: 0, lastX: x, lastZ: z, hasLOS: false };

    if (!_shadowMat) _shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 });
    if (!_shadowGeo) _shadowGeo = new THREE.CircleGeometry(0.5, 14);

    // ---- 模型对象池：优先回收复用，避免反复构建/销毁 ----
    const poolKey = typeId + (this.dummy ? ':d' : '');
    const pooled = (ZOMBIE_POOL[poolKey] || []).pop();
    if (pooled) {
      this.model = pooled.userData.model;
      this.group = pooled;
      // 复位外观状态（含肢解断肢的恢复）
      this.group.visible = true;
      this.group.rotation.set(cfg.crawl ? 1.0 : 0, 0, 0);
      this.group.scale.setScalar(cfg.scale);
      this.model.skin.emissive.setHex(0x000000);
      this.model.cloth.emissive.setHex(0x000000);
      this._ga1 = this._ga2 = this._gl1 = this._gq1 = false;
      const wantOutline = ENGINE.quality.outlines && !this.dummy;
      this.group.traverse(o => { if (o.userData.isOutline) o.visible = wantOutline; else o.visible = true; });
    } else {
      const model = this.bossCfg && this.bossCfg.mech ? buildMechModel(cfg, false)
        : cfg.quadruped ? buildQuadrupedModel(cfg, ENGINE.quality.outlines && !this.dummy) : buildZombieModel(cfg, ENGINE.quality.outlines && !this.dummy);
      this.model = model;
      this.group = model.group;
      this.group.userData.model = model;   // 供对象池复用
    }
    this.group.position.set(x, -2.05 * cfg.scale, z);
    this.pos = this.group.position;
    ENGINE.scene.add(this.group);

    // 精英词缀辉光 / Boss 巨型化
    this.auraColor = 0x000000;
    if (affix) {
      this.auraColor = affix.color;
      this.model.skin.emissive.setHex(affix.color);
      this.group.scale.multiplyScalar(GAMECONFIG.elites.scaleMult);
      if (affScale > 1) this.group.scale.multiplyScalar(affScale);
      // 变异登场播报（限频防尸潮刷屏）
      if (!this.net && !this.dummy && ENGINE.time - (Zombie._lastMutAnn || -99) > 6) {
        Zombie._lastMutAnn = ENGINE.time;
        HUD.killfeed('⚠ 检测到变异感染体：「' + this.affixes.map(a => a.name).join('+') + '」', 'big');
        AUDIO.growl(12, 0.75);
      }
    }
    // 变异体脚下光环（v6.9 专属显示特效：颜色随变异类型）
    let ring = this.group.userData.mutRing;
    if (!ring) {
      ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.58, 22),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      this.group.add(ring);
      this.group.userData.mutRing = ring;
    }
    ring.visible = !!affix;
    if (affix) ring.material.color.setHex(affix.color);
    // 变异头顶词条（v7.0）：显示变异组合名称
    if (typeof MUTTAGS !== 'undefined') MUTTAGS.attach(this);
    if (this.boss) this.group.scale.multiplyScalar(this.bossCfg ? this.bossCfg.scale / cfg.scale : GAMECONFIG.boss.scale / cfg.scale);

    // 幽影：半透明材质（接近时显形）
    this.cloakMats = null;
    if (cfg.cloak) {
      this.cloakMats = [this.model.skin];
      if (this.model.cloth !== this.model.skin) this.cloakMats.push(this.model.cloth);
      for (const m of this.cloakMats) { m.transparent = true; m.opacity = 0.28; }
    }

    this.shadow = new THREE.Mesh(_shadowGeo, _shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(x, 0.03, z);
    ENGINE.scene.add(this.shadow);
  }

  addKnockback(ix, iz) {
    this.kvx += ix; this.kvz += iz;
  }

  update(dt, game) {
    const cfg = this.type;
    const p = game.player;

    // 燃烧 DoT（v7.9 火焰喷射器）：固定值持续烧灼，可刷新；再生者燃烧时暂停再生
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.hp -= this.burnDps * (this.bossCfg && this.bossCfg.weakFire ? 1.5 : 1) * dt;
      if (this.type.regen) this._regenPause = Math.max(this._regenPause || 0, 0.5);
      if (!this._burnP || Math.random() < dt * 14) {
        this._burnP = 0.1;
        PARTICLES.flames(this.pos.x + rand(-0.25, 0.25), rand(0.4, 1.5) * this.group.scale.x, this.pos.z + rand(-0.25, 0.25), 1);
      } else this._burnP -= dt;
      if (this.hp <= 0) { this._burnDeath = true; this.die(game, false); return; }
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.model.skin.emissive.setHex(this.auraColor); this.model.cloth.emissive.setHex(this.auraColor); }
    }
    this.shadow.position.set(this.pos.x, 0.03, this.pos.z);
    this.shadow.scale.setScalar(this.group.scale.x);

    // ---- 破土而出 ----
    if (this.state === 'rise') {
      this.riseT -= dt;
      const k = clamp(1 - this.riseT / 0.9, 0, 1);
      this.pos.y = -2.05 * cfg.scale * (1 - k * k);
      if (this.riseT <= 0) { this.state = 'chase'; this.pos.y = 0; }
      return;
    }

    // ---- 死亡演出 ----
    if (this.dead) {
      this.deadT += dt;
      this.group.rotation.x = this.model.tilt - Math.min(1, this.deadT / 0.45) * 1.35;
      if (this.deadT > 1.0) this.pos.y -= dt * 0.7;
      if (this.deadT > 2.1) { this.remove = true; this.shadow.visible = false; }
    if (this.hpbar && typeof HPBARS !== 'undefined') HPBARS.remove(this);
      return;
    }

    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    let mvx = nx, mvz = nz;
    let spd = this.speed * (this.buffT > 0 ? 1.45 : 1);

    // ---- 追击AI（v4.2）：视线检测 → 无视线时沿墙绕行 → 卡住自动换向 ----
    {
      const st = this.steer;
      // 1) 视线：胸口射线(眼睛) + 膝盖射线(可通行性) —— 双射线防"看得见走不过去"
      const eyeY = this.pos.y + 0.9 * this.group.scale.x;
      const targetY = p.pos.y + 1.0;
      const losDx = nx, losDy = (targetY - eyeY) / dist, losDz = nz;
      const eyeT = rayAABBs(this.pos.x, eyeY, this.pos.z, losDx, losDy, losDz, dist);
      const kneeY = this.pos.y + 0.25;
      const kneeT = rayAABBs(this.pos.x, kneeY, this.pos.z, nx, (p.pos.y - this.pos.y) / dist, nz, dist);
      st.hasLOS = eyeT >= dist - 0.5 && kneeT >= dist - 0.5;
      if (st.hasLOS) { st.lastX = p.pos.x; st.lastZ = p.pos.z; st.wallT = 0; }

      // 2) 始终朝玩家方位追（尸潮气味感知），无通行视线时叠加沿墙滑行分量
      let tx = nx, tz = nz;
      if (!st.hasLOS) {
        st.wallT += dt;
        // 侧向滑行：方向稳定避免抖动
        tx += -nz * st.side * 0.9;
        tz += nx * st.side * 0.9;
        const tl2 = Math.hypot(tx, tz) || 1; tx /= tl2; tz /= tl2;
        // 3) 卡住检测：1.2秒位移不足 → 反转沿墙方向
        st.stuckT += dt;
        if (st.stuckT > 1.2) {
          const moved = Math.hypot(this.pos.x - st.lastX, this.pos.z - st.lastZ);
          if (moved < 0.35) st.side *= -1;
          st.stuckT = 0; st.lastX = this.pos.x; st.lastZ = this.pos.z;
        }
      } else {
        st.stuckT = 0;
        st.lastX = this.pos.x; st.lastZ = this.pos.z;
      }
      mvx = tx; mvz = tz;
    }

    // ---- 网络傀儡（联机客户端）：仅插值到房主快照，不跑AI ----
    if (this.net) {
      if (this.netTarget) {
        const mx = this.netTarget.x - this.pos.x, mz = this.netTarget.z - this.pos.z;
        const md = Math.hypot(mx, mz);
        if (md > 0.01) {
          const step = Math.min(md, md * 9 * dt);
          this.pos.x += mx / md * step;
          this.pos.z += mz / md * step;
          this.walkPhase += step * 2.4;
        }
        this.group.rotation.y = angleLerp(this.group.rotation.y, this.netTarget.yaw || 0, Math.min(1, 10 * dt));
      }
      this._animate();
      return;
    }

    // 远距离LOD：仅朝向与位移，跳过骨骼动画细节
    const lodSkip = dist > ENGINE.quality.lod;

    // 朝向玩家
    const targetYaw = Math.atan2(nx, nz);
    this.group.rotation.y = angleLerp(this.group.rotation.y, targetYaw, Math.min(1, 7 * dt));

    // ---- 行为决策 ----
    if (this.buffT > 0) this.buffT -= dt;

    if (this.dummy) {
      // 教学假人：站桩挨打
      this.walkPhase += dt * 1.2;
      this._animate();
      return;
    }

    // 冲锋者：锁定直线狂冲（可被闪避）
    if (cfg.charge) {
      this.chargeCd = (this.chargeCd === undefined ? rand(1, 2.5) : this.chargeCd) - dt;
      if (this.chargeActive > 0) {
        this.chargeActive -= dt;
        spd = 9.5;
        mvx = this.chargeDx; mvz = this.chargeDz;
        if (dist < cfg.attackRange && this.attackCd <= 0) {
          if (p.alive) { p.takeDamage(this.damage * 1.5, game, this.pos); p.vel.x += this.chargeDx * 7; p.vel.z += this.chargeDz * 7; p.vel.y += 3; }
          this.chargeActive = 0;
          this.attackCd = cfg.attackRate;
        }
      } else if (this.chargeCd <= 0 && dist < 14 && dist > 3.5) {
        this.chargeDx = nx; this.chargeDz = nz;
        this.chargeActive = 1.1;
        this.chargeCd = rand(3.5, 5);
        AUDIO.growl(dist, 0.7);
      }
    }

    // 女巫（v9.9 L4D）：蹲坐不攻击；靠近/受击→狂暴冲锋
    if (cfg.witch) {
      const W = cfg.witch;
      if (!this.raged) {
        // 蹲坐：不移动不攻击，哭泣粒子
        mvx = 0; mvz = 0; spd = 0;
        if (!lodSkip && Math.random() < dt * 2) PARTICLES.spawn('smoke', this.pos.x, 0.4, this.pos.z, 1,
          { speed: 0.2, vy: 0.3, life: 1.2, color: [0.9, 0.85, 0.95], color2: [0.5, 0.4, 0.55] });
        if (dist < W.triggerRange || this._provoked) {
          this.raged = true;
          this.speed = W.speedBoost;
          this.state = 'chase';
          AUDIO.hordeHorn();
          ENGINE.shake(0.35);
          HUD.banner('😡 你惊扰了女巫！', '跑！');
        }
      } else {
        // 狂暴：限时高移速冲锋
        this.rageT = (this.rageT === undefined ? W.rageTime : this.rageT) - dt;
        if (!lodSkip && Math.random() < dt * 8) PARTICLES.spawn('smoke', this.pos.x, rand(0.5, 1.5), this.pos.z, 1,
          { speed: 0.4, vy: 0.5, life: 0.5, color: [1, 0.5, 0.4], color2: [0.5, 0.1, 0.1] });
      }
    }
    // 坦克（v9.9 L4D）：巨石投掷 + 被点燃狂暴
    if (cfg.rock) {
      const R = cfg.rock;
      this.rockCd = (this.rockCd === undefined ? rand(2, 4) : this.rockCd) - dt;
      if (this.rockCd <= 0 && dist > 4 && dist < 26 && p.alive) {
        this.rockCd = R.cd * rand(0.9, 1.2);
        spawnRock(game, this, R);
        HUD.toast('🪨 坦克掷出巨石——横向闪避！');
      }
      // 燃烧狂暴：hp < 50% 加速
      if (cfg.burning && this.hp < this.maxHp * 0.5 && !this._enraged) {
        this._enraged = true;
        this.speed *= 1.45;
        HUD.toast('🔥 坦克被激怒了——它烧起来了！');
      }
    }
    // 胆汁鬼（v9.7 L4D）：呕吐胆汁标记玩家→引尸潮；死亡爆炸溅胆汁
    if (cfg.bile) {
      const B = cfg.bile;
      this.bileCd = (this.bileCd === undefined ? rand(1.5, 2.5) : this.bileCd) - dt;
      if (this.bileCd <= 0 && dist < B.range && dist > 2.2 && p.alive) {
        this.bileCd = B.cd * rand(0.9, 1.15);
        spawnBile(game, this, B);
        AUDIO.acidSpit(dist);
        HUD.toast('🤢 被胆汁标记——尸潮正在涌来！');
      }
      // 玩家被标记时持续吸引普通尸（加速+转向玩家）
      if (p.bileT > 0) {
        p.bileT -= dt;
        for (const z2 of game.zombies) {
          if (z2 === this || z2.dead || z2.boss || z2.type.cost >= 3) continue;
          z2.buffT = Math.max(z2.buffT || 0, 0.5);   // 狂化加速
        }
      }
    }
    // 呛尸（v9.7 L4D）：舌须拖拽
    if (cfg.drag) {
      const D = cfg.drag;
      this.dragCd = (this.dragCd === undefined ? rand(2, 3.5) : this.dragCd) - dt;
      if (this.dragActive > 0) {
        // 拖拽中：把玩家拉向自己+持续伤害
        this.dragActive -= dt;
        const ddx = this.pos.x - p.pos.x, ddz = this.pos.z - p.pos.z;
        const dl = Math.hypot(ddx, ddz) || 1;
        p.pos.x += (ddx / dl) * D.pullSpeed * dt;
        p.pos.z += (ddz / dl) * D.pullSpeed * dt;
        p.slowT = Math.max(p.slowT, 0.3);
        p.takeDamage(D.dmg * dt * 2, game, this.pos);
        if (dist < 2.2 || this.dead) { this.dragActive = 0; p.draggedBy = null; }
      } else if (this.dragCd <= 0 && dist < D.range && dist > 3 && p.alive && !p.draggedBy) {
        this.dragCd = D.cd * rand(0.9, 1.2);
        this.dragActive = 2.4;
        p.draggedBy = this;
        AUDIO.growl(dist, 0.8);
        HUD.toast(' tongues 被舌须拖住——对它造成伤害打断！');
      }
    }
    // 猎人（v9.7 L4D）：扑杀重击（在lunge命中后处理, 见下方attack段）
    // 舔食者（v7.6）：中距离长舌抽击
    if (cfg.tongue) {
      const T = cfg.tongue;
      this.tongueCd = (this.tongueCd === undefined ? rand(1, 2) : this.tongueCd) - dt;
      if (this.tongueCd <= 0 && dist < T.range && dist > cfg.attackRange * 0.8 && p.alive) {
        this.tongueCd = T.cd * rand(0.9, 1.15);
        this.windup = GAMECONFIG.combat.attackWindup * 0.8;
        this._tongueHit = { dmg: T.dmg, range: T.range };
      } else this._tongueHit = null;
    }
    // 再生者（v7.6）：持续回血，被爆头打断3秒
    if (cfg.regen) {
      this._regenPause = Math.max(0, (this._regenPause || 0) - dt);
      if (this.hp < this.maxHp && this._regenPause <= 0) {
        this.hp = Math.min(this.maxHp, this.hp + cfg.regen * dt);
        if (!lodSkip && Math.random() < dt * 6) PARTICLES.spawn('smoke', this.pos.x, rand(0.4, 1.4) * this.group.scale.x, this.pos.z, 1,
          { speed: 0.2, vy: 0.6, life: 0.5, color: [0.75, 0.75, 0.85], color2: [0.3, 0.3, 0.4] });
      }
    }
    // 扎根植灵（v7.6）：中距投射种子
    if (cfg.seed) {
      const S = cfg.seed;
      this.seedCd = (this.seedCd === undefined ? rand(1, 2) : this.seedCd) - dt;
      if (this.seedCd <= 0 && dist < 12 && dist > 2.2 && p.alive) {
        this.seedCd = S.cd * rand(0.9, 1.2);
        spawnAcid(game, this, S);
        AUDIO.acidSpit(dist);
      }
    }

    // 吐酸者：保持距离、环绕、吐酸
    if (cfg.ranged) {
      const R = cfg.ranged;
      if (dist < R.keepMin) { mvx = -nx; mvz = -nz; }
      else if (dist < R.keepMax) {
        mvx = -nz * 0.8 + nx * 0.15; mvz = nx * 0.8 + nz * 0.15;
      }
      this.spitT -= dt;
      if (this.spitT <= 0 && dist < 24 && dist > 2.5) {
        this.spitT = R.cooldown * rand(0.85, 1.2);
        spawnAcid(game, this, R);
      }
    }

    // 小丑：之字形 + 间歇狂奔
    if (cfg.zigzag) {
      this.zigPhase += dt * 3.4;
      const side = Math.sin(this.zigPhase) * 0.95;
      mvx = nx + (-nz) * side; mvz = nz + nx * side;
      const l = Math.hypot(mvx, mvz) || 1; mvx /= l; mvz /= l;
      this.dashT -= dt;
      if (this.dashT <= 0) { this.dashT = rand(3, 5.5); this.lungeActive = 0.7; }
      if (this.lungeActive > 0) { this.lungeActive -= dt; spd *= 1.85; }
    }

    // 潜行者：匍匐 + 猛扑
    if (cfg.lunge) {
      this.lungeT -= dt;
      if (this.lungeT <= 0 && dist < cfg.lungeRange && this.lungeActive <= 0) {
        this.lungeActive = 0.45; this.lungeT = rand(2.6, 3.8);
      }
      if (this.lungeActive > 0) { this.lungeActive -= dt; spd = cfg.lungeSpeed * (this.buffT > 0 ? 1.3 : 1); }
    }

    // ---- Boss 机制（v6.9：幕末专属Boss攻击组 + 狩猎通用Boss） ----
    if (this.boss) {
      const M = GAMECONFIG.bossMech;
      const A = this.bossCfg ? this.bossCfg.attacks : M;
      const phase2 = this.hp < this.maxHp * M.phase2At;
      if (phase2 && !this.phase2Done) {
        this.phase2Done = true;
        this.speed *= M.rageSpeed;
        HUD.banner('⚠ ' + this.displayName + ' 狂暴', '它撕下了伪装');
        AUDIO.hordeHorn();
        ENGINE.shake(0.3);
      }
      // 召唤增援
      if (A.summonEvery) {
        this.summonT = (this.summonT === undefined ? A.summonEvery : this.summonT) - dt;
        if (this.summonT <= 0) {
          this.summonT = A.summonEvery * (phase2 ? 0.75 : 1);
          const n = (A.summonN || M.summonN) + (phase2 ? 1 : 0);
          const st = A.summonType || 'runner';
          for (let i = 0; i < n; i++) game.spawner.spawnOne(st);
          HUD.killfeed('⚠ ' + this.displayName + ' 召唤了增援！', 'big');
        }
      }
      // 跺地 AOE
      if (A.slamEvery) {
        const sRad = A.slamRadius || M.slamRadius;
        this.slamT = (this.slamT === undefined ? A.slamEvery : this.slamT) - dt;
        if (this.slamT <= 0 && dist < sRad + 2.5) {
          this.slamT = A.slamEvery;
          ENGINE.shake(0.45);
          PARTICLES.dust(this.pos.x, 0.3, this.pos.z, 16);
          AUDIO.impact();
          if (p.alive && dist < sRad) p.takeDamage(A.slamDmg || M.slamDmg, game, this.pos);
          HUD.toast('💥 跺地冲击！快离开 Boss 脚下');
        }
      }
      // 冲锋（暴君Ω）：锁定直线狂冲+撞飞
      if (A.chargeEvery) {
        this.bChargeCd = (this.bChargeCd === undefined ? rand(2.5, 4) : this.bChargeCd) - dt;
        if (this.bCharge > 0) {
          this.bCharge -= dt;
          spd = 10; mvx = this.bChargeDx; mvz = this.bChargeDz;
          if (dist < cfg.attackRange + 0.8 && this.attackCd <= 0) {
            if (p.alive) { p.takeDamage(this.damage * 1.5, game, this.pos); p.vel.x += this.bChargeDx * 9; p.vel.z += this.bChargeDz * 9; p.vel.y += 4; }
            this.bCharge = 0; this.attackCd = cfg.attackRate;
          }
        } else if (this.bChargeCd <= 0 && dist < 16 && dist > 4) {
          this.bChargeDx = nx; this.bChargeDz = nz;
          this.bCharge = 1.0;
          this.bChargeCd = A.chargeEvery;
          AUDIO.growl(dist, 0.6);
          HUD.toast('⚠ 暴君冲锋——侧向闪避！');
        }
      }
      // 酸弹幕（灯塔巨像）：扇形三连吐
      if (A.barrageEvery) {
        this.barrT = (this.barrT === undefined ? rand(3, 5) : this.barrT) - dt;
        if (this.barrT <= 0 && dist > 3.5 && dist < 32) {
          this.barrT = A.barrageEvery * (phase2 ? 0.7 : 1);
          const n2 = A.barrageN || 3;
          const R = { speed: 11, dmg: 14, poolDps: 8, poolRadius: 1.9, poolTime: 3 };
          for (let i = 0; i < n2; i++) {
            const sp = (i - (n2 - 1) / 2) * 0.2;
            const dxc = nx * Math.cos(sp) - nz * Math.sin(sp);
            const dzc = nx * Math.sin(sp) + nz * Math.cos(sp);
            const oy = 1.55 * this.group.scale.x;
            const t2 = clamp(dist / R.speed, 0.25, 2.2);
            const vy2 = (1.2 - oy + 0.5 * 9 * t2 * t2) / t2;
            game.projectiles.push(new Projectile('acid', this.pos.x + dxc * 0.6, oy, this.pos.z + dzc * 0.6,
              dxc * R.speed, vy2, dzc * R.speed, { fuse: 4, R }));
          }
          AUDIO.acidSpit(dist);
          HUD.toast('⚠ 巨像酸液弹幕——横向走位躲避！');
        }
      }
      // 震地波（灯塔巨像）：周期性全场冲击波掀翻玩家
      if (A.quakeEvery) {
        this.quakeT = (this.quakeT === undefined ? A.quakeEvery : this.quakeT) - dt;
        if (this.quakeT <= 0 && dist < 16) {
          this.quakeT = A.quakeEvery;
          ENGINE.shake(0.6);
          AUDIO.impact();
          PARTICLES.dust(this.pos.x, 0.3, this.pos.z, 24);
          if (p.alive && this.pos.y - p.pos.y < 2) {
            p.vel.x += nx * 8.5; p.vel.z += nz * 8.5; p.vel.y += 3.5;
            p.takeDamage(12, game, this.pos);
            HUD.toast('🌀 震地冲击波——被掀翻了！');
          }
        }
      }
      // 机枪扫射（XT-300 v10.1）：扇形10连弹幕（炮塔被破坏后禁用）
      if (A.gatlingEvery) {
        const turretOk = !this.model.turret || this.model.turret.visible;
        this.gatCd = (this.gatCd === undefined ? rand(2, 4) : this.gatCd) - dt;
        if (this.gatCd <= 0 && turretOk && dist > 3 && dist < 22 && p.alive) {
          this.gatCd = A.gatlingEvery;
          const N = A.gatlingN || 10;
          for (let i = 0; i < N; i++) {
            setTimeout(() => {
              if (this.dead || !window.GAME || window.GAME.state !== 'playing' || !this.model.turret.visible) return;
              const g3 = window.GAME;
              const p3 = g3.player;
              const base = Math.atan2(p3.pos.x - this.pos.x, p3.pos.z - this.pos.z);
              const spread = (i - N / 2) * 0.07;
              const dir = { x: Math.sin(base + spread), z: Math.cos(base + spread) };
              // 曳光弹：直线快速弹（简化为射线伤害判定+曳光视觉）
              const hit = Math.abs(spread) < 0.05 && Math.random() < 0.4;   // 中心弹40%命中
              const oy = 2.1 * this.group.scale.x;
              const start = { x: this.pos.x + dir.x * 1.2, y: oy, z: this.pos.z + dir.z * 1.2 };
              const end = { x: start.x + dir.x * 24, y: start.y, z: start.z + dir.z * 24 };
              if (typeof TRACERS !== 'undefined') TRACERS.fire(start, end);
              if (hit && p3.alive) p3.takeDamage(A.gatlingDmg || 7, g3, this.pos);
              AUDIO.shot(220, 0.05, 0.4);
            }, i * 70);
          }
          HUD.toast('⚡ XT-300 机枪扫射——找掩体！');
        }
      }
      // 导弹齐射（XT-300 v10.1）：3枚追踪导弹
      if (A.missileEvery) {
        this.mslCd = (this.mslCd === undefined ? rand(4, 6) : this.mslCd) - dt;
        if (this.mslCd <= 0 && dist > 4 && p.alive) {
          this.mslCd = A.missileEvery;
          for (let i = 0; i < (A.missileN || 3); i++) {
            setTimeout(() => {
              if (this.dead || !window.GAME || window.GAME.state !== 'playing') return;
              const g3 = window.GAME;
              const p3 = g3.player;
              // 追踪弹：发射时锁定当前位置+预判
              const ox = this.pos.x, oz = this.pos.z, oy = 1.9 * this.group.scale.x;
              const tx = p3.pos.x + p3.vel.x * 0.5, tz = p3.pos.z + p3.vel.z * 0.5;
              const d2 = dist2d(ox, oz, tx, tz);
              const t2 = clamp(d2 / 11, 0.3, 1.6);
              const vx = (tx - ox) / t2, vz = (tz - oz) / t2;
              const vy = (1.2 - oy + 0.5 * 10 * t2 * t2) / t2;
              g3.projectiles.push(new Projectile('missile', ox, oy, oz, vx, vy, vz, { fuse: 4, R: { dmg: A.missileDmg || 30, poolDps: 0, poolRadius: 0, poolTime: 0 } }));
              AUDIO.acidSpit(d2);
            }, i * 260);
          }
          HUD.toast('🚀 导弹齐射——保持移动！');
        }
      }
      // 踩踏（XT-300 v10.1）：AOE+震屏（复用slam字段渲染红圈提示则简化为直接伤害）
      if (A.stompEvery) {
        this.stompCd = (this.stompCd === undefined ? rand(3, 5) : this.stompCd) - dt;
        if (this.stompCd <= 0 && dist < (A.stompRadius || 6) + 1.5) {
          this.stompCd = A.stompEvery;
          ENGINE.shake(0.5);
          PARTICLES.dust(this.pos.x, 0.3, this.pos.z, 18);
          AUDIO.impact();
          if (p.alive && dist < (A.stompRadius || 6)) p.takeDamage(A.stompDmg || 44, game, this.pos);
          HUD.toast('💥 XT-300 践踏——离开红色区域！');
        }
      }
      // 触须横扫（母体泵守护者 v8.0）：12m直线扇形击飞，前摇1s
      if (A.tentacleEvery) {
        this.tentCd = (this.tentCd === undefined ? rand(3, 5) : this.tentCd) - dt;
        if (this.tentCd <= 0 && dist < 12 && dist > 2) {
          this.tentCd = A.tentacleEvery * (phase2 ? 0.65 : 1);
          this._tentTele = 1.0;    // 前摇计时
          AUDIO.hordeHorn();
          HUD.toast('⚠ 守护者蓄力触须横扫——侧移闪避！');
        }
      }
      // 地刺矩阵（母体泵守护者 v8.0）：玩家位置为中心 NxN 红圈预告，1.2s后落刺
      if (A.spikeEvery) {
        this.spikeCd = (this.spikeCd === undefined ? rand(4, 6) : this.spikeCd) - dt;
        if (this.spikeCd <= 0 && dist < 16) {
          this.spikeCd = A.spikeEvery * (phase2 ? 0.65 : 1);
          const N = (A.spikeN || 3) + (phase2 ? 1 : 0);
          const cell = 1.6;
          const cx = p.pos.x, cz = p.pos.z;
          for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
            const sx = cx + (ix - (N - 1) / 2) * cell, sz = cz + (iz - (N - 1) / 2) * cell;
            PARTICLES.spawn('smoke', sx, 0.1, sz, 3, { speed: 0.4, vy: 0.5, life: 1.1, color: [0.9, 0.2, 0.15], color2: [0.4, 0.05, 0.05] });
          }
          setTimeout(() => {
            const g2 = window.GAME;
            if (this.dead || !g2 || g2.state !== 'playing') return;
            for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
              const sx = cx + (ix - (N - 1) / 2) * cell, sz = cz + (iz - (N - 1) / 2) * cell;
              PARTICLES.dust(sx, 0.2, sz, 4);
              if (g2.player.alive && dist2d(g2.player.pos.x, g2.player.pos.z, sx, sz) < 0.9) {
                g2.player.takeDamage(A.spikeDmg || 18, g2, { x: sx, z: sz });
              }
            }
            AUDIO.impact();
          }, 1200);
          this.spikeCd = A.spikeEvery;
        }
      }
      // 猛扑（方舟刽子手）：短促高速扑杀
      if (A.lungeEvery) {
        this.bLungeCd = (this.bLungeCd === undefined ? rand(2, 3.5) : this.bLungeCd) - dt;
        if (this.bLunge > 0) {
          this.bLunge -= dt;
          spd = A.lungeSpeed; mvx = this.lungeDx; mvz = this.lungeDz;
          if (dist < cfg.attackRange + 0.6 && this.attackCd <= 0) {
            if (p.alive) { p.takeDamage(this.damage * 1.6, game, this.pos); p.vel.x += this.lungeDx * 6; p.vel.z += this.lungeDz * 6; }
            this.bLunge = 0; this.attackCd = cfg.attackRate;
          }
        } else if (this.bLungeCd <= 0 && dist < 13 && dist > 2.5) {
          this.lungeDx = nx; this.lungeDz = nz;
          this.bLunge = 0.5;
          this.bLungeCd = A.lungeEvery * (phase2 ? 0.7 : 1);
          AUDIO.growl(dist, 1.35);
        }
      }
    }

    // 尖啸者：周期性召唤
    if (cfg.scream) {
      this.screamT -= dt;
      if (this.screamT <= 0) {
        this.screamT = cfg.scream.cooldown * rand(0.9, 1.15);
        this._scream(game, dist);
      }
    }

    // 辐射变种：荧光光环粒子（二代特化视觉）
    if (cfg.aura && !lodSkip) {
      this.auraT = (this.auraT || 0) - dt;
      if (this.auraT <= 0) {
        this.auraT = 0.12;
        const a = Math.random() * TAU;
        PARTICLES.spawn('smoke', this.pos.x + Math.cos(a) * 0.4, rand(0.2, 1.2) * this.group.scale.x, this.pos.z + Math.sin(a) * 0.4, 1,
          { speed: 0.3, vy: 0.8, life: 0.7, color: [0.35, 0.9, 0.3], color2: [0.1, 0.5, 0.15] });
      }
    }
    // 变异体专属粒子（v6.9）：按变异类型颜色的雾气持续上升标识
    if (this.affix && !lodSkip) {
      this.mutPT = (this.mutPT || 0) - dt;
      if (this.mutPT <= 0) {
        this.mutPT = 0.15;
        const mc = this.affix.color;
        const a = Math.random() * TAU;
        PARTICLES.spawn('smoke', this.pos.x + Math.cos(a) * 0.44, rand(0.15, 1.5) * this.group.scale.x, this.pos.z + Math.sin(a) * 0.44, 1,
          { speed: 0.25, vy: 0.9, life: 0.65, color: [((mc >> 16) & 255) / 255, ((mc >> 8) & 255) / 255, (mc & 255) / 255], color2: [0.08, 0.08, 0.1] });
      }
    }
    // 幽影：耳语声预警 + 距离显形
    if (cfg.cloak && this.cloakMats) {
      const target = dist < 10 ? lerp(0.85, 0.28, clamp((dist - 2) / 8, 0, 1)) : 0.28;
      for (const m of this.cloakMats) if (m.opacity !== target) m.opacity = target;
      this.whisperT = (this.whisperT || 3) - dt;
      if (this.whisperT <= 0) { this.whisperT = rand(3.5, 6.5); AUDIO.whisper(dist); }
    }

    // 硬直
    if (this.stagger > 0) { this.stagger -= dt; mvx = 0; mvz = 0; spd = 0; }

    // ---- 移动（含击退冲量衰减 + 立体地形踏步，v4.1；扎根植灵定身 v7.6） ----
    if (cfg.rooted) { mvx = 0; mvz = 0; spd = 0; }
    this.pos.x += mvx * spd * dt + this.kvx * dt;
    this.pos.z += mvz * spd * dt + this.kvz * dt;
    const kd = Math.exp(-7 * dt);
    this.kvx *= kd; this.kvz *= kd;
    resolveCircleAABBs(this.pos, 0.42 * cfg.scale, 1.8 * cfg.scale, this.pos.y, 0.6);
    const S = ENGINE.mapDef.size;
    this.pos.x = clamp(this.pos.x, -S + 1, S - 1);
    this.pos.z = clamp(this.pos.z, -S + 1, S - 1);
    if (spd > 0) this.walkPhase += spd * dt * 2.4;
    // 贴合支撑面高度：上台阶平滑爬升；高出支撑面则重力坠落（v6.9 高处摔伤）
    const gh = groundHeightAt(this.pos.x, this.pos.z, 0.42 * cfg.scale, this.pos.y, 0.6);
    if (this.pos.y > gh + 0.06) {
      // 腾空坠落
      this._vy = (this._vy || 0) - 22 * dt;
      this.pos.y += this._vy * dt;
      if (this.pos.y <= gh) {
        const fall = -this._vy;
        this.pos.y = gh; this._vy = 0;
        if (fall > 10) {
          // 高处坠落摔伤：随下落速度放大（上限50%最大生命）+ 着地硬直
          this.stagger = Math.max(this.stagger, 0.8);
          PARTICLES.dust(this.pos.x, 0.2, this.pos.z, 10);
          AUDIO.impact();
          this.takeDamage(this.maxHp * Math.min(0.5, (fall - 10) * 0.035), false, null, game);
        }
      }
    } else if (this.pos.y < gh - 0.01) {
      this._vy = 0;
      this.pos.y = Math.min(gh, this.pos.y + Math.max(1.5, (gh - this.pos.y) * 8) * dt * 4);
    } else {
      this._vy = 0;
      this.pos.y = gh;
    }

    // 触须横扫前摇结算（v8.0）
    if (this._tentTele !== undefined && this._tentTele > 0) {
      this._tentTele -= dt;
      if (this._tentTele <= 0) {
        const A2 = this.bossCfg ? this.bossCfg.attacks : {};
        if (p.alive && dist < 12.5) {
          const fw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
          const bossYaw = Math.atan2(nx, nz);
          const diff = Math.abs(((fw - bossYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff < 0.7) {   // 扇形±40°
            p.takeDamage(A2.tentacleDmg || 40, game, this.pos);
            p.vel.x += nx * 9; p.vel.z += nz * 9; p.vel.y += 4;
            HUD.toast('💥 被触须横扫击飞！');
          }
        }
        PARTICLES.dust(this.pos.x + nx * 5, 0.3, this.pos.z + nz * 5, 12);
        AUDIO.impact();
        this.stagger = Math.max(this.stagger, 0.6);   // 攻击后惩罚窗口
      }
    }

    // ---- 攻击 ----
    this.attackCd -= dt;
    if (this.windup >= 0) {
      this.windup -= dt;
      if (this.windup < 0 && p.alive && dist < cfg.attackRange + 0.55) {
        p.takeDamage(this.damage, game, this.pos);
        if (cfg.knockback) {
          p.vel.x += nx * cfg.knockback; p.vel.z += nz * cfg.knockback; p.vel.y += 3.2;
        }
        // 变异特效：巨力击退 / 嗜血吸血（v7.0 叠加版）
        if (this.affixKb > 0) { p.vel.x += nx * this.affixKb; p.vel.z += nz * this.affixKb; p.vel.y += 2.6; }
        if (this.affixHeal > 0) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.affixHeal);
        // 抓挠减速（游荡者/潜行者）：咬中附带短暂减速
        if (cfg.grabSlow) p.slowT = Math.max(p.slowT, cfg.grabSlow);
        // 猎人扑杀重击（v9.7）：额外伤害+1.2s玩家硬直
        if (cfg.pounce && this.lungeActive > 0) {
          p.takeDamage(cfg.pounce.dmg, game, this.pos);
          p.slowT = Math.max(p.slowT, cfg.pounce.stun);
          this.lungeActive = 0;
          HUD.toast('⚡ 被扑倒撕咬！');
        }
        // 舔食者长舌抽击（中距离判定）
        if (this._tongueHit && p.alive && dist < this._tongueHit.range + 0.4) {
          p.takeDamage(this._tongueHit.dmg, game, this.pos);
          PARTICLES.blood(p.pos.x, 1.4, p.pos.z, 6);
          AUDIO.impact();
        }
        this._tongueHit = null;
        // 连击（奔跑者/小丑/地狱犬/暴君）：概率立即补一记快速二连
        if (cfg.combo && Math.random() < cfg.combo && p.alive && dist < cfg.attackRange + 0.55) {
          this.windup = GAMECONFIG.combat.attackWindup * 0.55;
        }
      }
    } else if (cfg.damage > 0 && dist < cfg.attackRange && this.attackCd <= 0 && this.stagger <= 0) {
      this.windup = GAMECONFIG.combat.attackWindup;
      this.attackCd = cfg.attackRate * (this.boss && this.phase2Done ? GAMECONFIG.bossMech.rageRate : 1);
    }

    // 膨胀者近身自爆
    if (cfg.explode && p.alive && dist < cfg.attackRange - 0.2) {
      this.takeDamage(999999, false, null, game);
      return;
    }

    if (!lodSkip) this._animate();
  }

  _animate() {
    const m = this.model, cfg = this.type;
    const sw = Math.sin(this.walkPhase);
    // 机甲（v10.1 XT-300）：腿部液压摆动+炮塔微转+待机浮沉
    if (m.mech) {
      const legsM = m.group.children.filter(c => c.geometry && c.geometry.parameters && c.geometry.parameters.width === 0.3);
      if (m.group.children[0]) { /* 躯干呼吸微浮 */ }
      m.group.position.y = Math.sin(ENGINE.time * 1.4 + this.walkPhase) * 0.04;
      // 炮塔朝向玩家微转
      if (m.turret && m.turret.visible) {
        const p = GAME && GAME.player;
        if (p) {
          const want = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) - this.group.rotation.y;
          m.turret.rotation.y += (want - m.turret.rotation.y) * Math.min(1, 3 * 0.016);
        }
      }
      return;
    }
    // 四足（地狱犬）：对角步态
    if (m.quadruped) {
      m.legs[0].rotation.x = sw * 0.7;
      m.legs[3].rotation.x = sw * 0.7;
      m.legs[1].rotation.x = -sw * 0.7;
      m.legs[2].rotation.x = -sw * 0.7;
      m.head.rotation.x = Math.sin(ENGINE.time * 2.2 + this.walkPhase) * 0.06;
      const atQ = this.windup >= 0 ? 1 - this.windup / GAMECONFIG.combat.attackWindup : -1;
      if (atQ >= 0) m.head.position.z = 0.52 + atQ * 0.2;
      else m.head.position.z = 0.52;
      return;
    }
    m.legs[0].rotation.x = sw * 0.55;
    m.legs[1].rotation.x = -sw * 0.55;
    const base = cfg.crawl ? -0.5 : -1.15;
    const attackT = this.windup >= 0 ? 1 - this.windup / GAMECONFIG.combat.attackWindup : -1;
    if (m.arms.length) {
      m.arms[0].rotation.x = base + sw * 0.22;
      m.arms[1].rotation.x = base - sw * 0.22;
      if (attackT >= 0) {
        m.arms[0].rotation.x = base - 0.4 + attackT * 0.9;
        m.arms[1].rotation.x = base - 0.4 + attackT * 0.9;
      }
    }
    m.head.rotation.z = (cfg.id === 'walker' ? 0.18 : 0) + Math.sin(ENGINE.time * 1.7 + this.walkPhase) * 0.09;
  }

  get displayName() {
    if (this.boss) return this.bossCfg ? this.bossCfg.name : '暴君 Ω';
    return (this.affixes.length ? this.affixes.map(a => a.name).join('+') + '·' : '') + this.type.name;
  }

  _flash() {
    this.model.skin.emissive.setHex(0x7a1010);
    this.model.cloth.emissive.setHex(0x571010);
  }

  /* ---------- 肢解系统（v6.8） ---------- */
  // 单块肢体崩飞：隐藏原mesh → 生成带物理的尸块 + 血浆
  _gibPiece(mesh, power) {
    if (!mesh || mesh.visible === false) return;
    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    const s = this.group.scale.x;
    const prm = mesh.geometry.parameters;
    if (!prm || prm.width === undefined) return;   // 锥形配件等非盒几何跳过
    mesh.visible = false;
    if (typeof GIBS !== 'undefined') {
      GIBS.spawn(wp.x, wp.y, wp.z, prm.width * s, prm.height * s, prm.depth * s, mesh.material,
        { dx: wp.x - this.pos.x, dz: wp.z - this.pos.z }, power || 1);
    }
    PARTICLES.blood(wp.x, wp.y, wp.z, 6);
  }

  // 血量阶段断肢：60% 断一臂 / 35% 断另一臂 / 18% 断一腿（四足 40% 断前腿）
  _updateDismember() {
    const m = this.model;
    if (m.quadruped) {
      if (!this._gq1 && this.hp < this.maxHp * 0.4) { this._gq1 = true; this._gibPiece(m.legs[0].children[0]); }
      return;
    }
    if (!this._ga1 && this.hp < this.maxHp * 0.6 && m.arms.length) { this._ga1 = true; this._gibPiece(m.arms[0].children[0]); }
    if (!this._ga2 && this.hp < this.maxHp * 0.35 && m.arms.length > 1) { this._ga2 = true; this._gibPiece(m.arms[1].children[0]); }
    if (!this._gl1 && this.hp < this.maxHp * 0.18 && m.legs.length) { this._gl1 = true; this._gibPiece(m.legs[1].children[0]); }
  }

  // 击杀解体：爆头→头颅集群崩飞；过量击杀→全身碎块；普通击杀→概率崩残肢
  _gibDeath(headshot, overkill) {
    const m = this.model;
    const s = this.group.scale.x;
    if (headshot || overkill) {
      for (const b of (m.headBits || [])) this._gibPiece(b, 1.6);
    }
    if (overkill) {
      for (const piv of [...m.arms, ...m.legs]) {
        if (piv.children[0]) this._gibPiece(piv.children[0], 1.3);
      }
      if (!m.quadruped) {
        GIBS.spawn(this.pos.x, 1.1 * s, this.pos.z, 0.3 * s, 0.3 * s, 0.32 * s, m.cloth, { dx: 0, dz: 0 }, 1.5);
        GIBS.spawn(this.pos.x, 0.8 * s, this.pos.z, 0.26 * s, 0.2 * s, 0.3 * s, m.skin, { dx: 0.4, dz: 0.2 }, 1.2);
      }
      PARTICLES.blood(this.pos.x, 1.1 * s, this.pos.z, 24, true);
    } else if (!headshot && m.quadruped) {
      for (const piv of m.legs) if (piv.children[0]) this._gibPiece(piv.children[0], 1.2);
    } else if (!headshot && Math.random() < 0.45) {
      const piv = choice([...m.arms, ...m.legs]);
      if (piv && piv.children[0]) this._gibPiece(piv.children[0]);
    }
  }

  _scream(game, dist) {
    AUDIO.scream(dist);
    const S = this.type.scream;
    PARTICLES.spawn('smoke', this.pos.x, 1.9 * this.group.scale.x, this.pos.z, 14,
      { speed: 3, vy: 2.5, life: 0.7, color: [0.8, 0.75, 0.85], color2: [0.5, 0.4, 0.55] });
    const n = randi(S.summon[0], S.summon[1]);
    for (let i = 0; i < n; i++) game.spawner.spawnExtra(choice(['walker', 'runner']));
    for (const z of game.zombies) {
      if (z.dead || z.state === 'rise') continue;
      if (dist2d(z.pos.x, z.pos.z, this.pos.x, this.pos.z) < S.buffRadius) z.buffT = S.buffDuration;
    }
    HUD.killfeed('⚠ 尖啸者召唤了增援！', 'big');
  }

  takeDamage(amount, isHead, hitPoint, game, kb) {
    if (this.dead) return;
    const cfg = this.type;
    // 装甲暴兵：正面减伤
    if (cfg.frontArmor && !isHead && game) {
      const p = game.player;
      const tx = p.pos.x - this.pos.x, tz = p.pos.z - this.pos.z;
      const tl = Math.hypot(tx, tz) || 1;
      const fx = Math.sin(this.group.rotation.y), fz = Math.cos(this.group.rotation.y);
      if ((fx * tx + fz * tz) / tl > 0.35) amount *= (1 - cfg.frontArmor);
    }
    if (isHead && !cfg.immuneStagger) this.stagger = Math.max(this.stagger, GAMECONFIG.combat.staggerTime);
    this.hp -= amount;
    this.flashT = 0.07;
    this._flash();
    // 头顶血条（首次受伤时懒创建）
    if (typeof HPBARS !== 'undefined' && !this.dummy && this.hp < this.maxHp && !this.hpbar) HPBARS.create(this);
    // XT-300 炮塔弱点（v10.1）：爆头3次破坏炮塔（禁用扫射）
    // 女巫：受击触发狂暴（v9.9）
    if (cfg.witch) this._provoked = true;
    // XT-300 炮塔破坏（v10.1）：爆头累计3次
    if (isHead && this.bossCfg && this.bossCfg.mech && this.model.turret && this.model.turret.visible) {
      this._turretHits = (this._turretHits || 0) + 1;
      if (this._turretHits >= 3) {
        this.model.turret.visible = false;
        PARTICLES.explosion(this.pos.x, 2.2 * this.group.scale.x, this.pos.z);
        AUDIO.explode(0);
        HUD.banner('🎯 炮塔已摧毁！', '它的扫射哑火了');
      } else {
        HUD.toast(`🎯 命中炮塔（${this._turretHits}/3）`);
      }
    }
    // 呛尸：受击打断拖拽（v9.7）
    if (cfg.drag && this.dragActive > 0) {
      this.dragActive = 0;
      if (game.player) game.player.draggedBy = null;
      HUD.toast('✂ 舌须被打断！');
    }
    // 再生者：爆头打断再生3秒（v7.6）
    if (cfg.regen && isHead) this._regenPause = 3;
    // 血量阶段断肢（v6.8）
    this._updateDismember();
    if (kb) this.addKnockback(kb.x, kb.z);
    if (hitPoint) PARTICLES.blood(hitPoint.x, hitPoint.y, hitPoint.z, isHead ? 10 : 6, isHead);
    if (this.hp <= 0) this.die(game, isHead);
  }

  die(game, headshot) {
    this.dead = true; this.deadT = 0;
    const overkill = this.hp <= -this.maxHp * 0.25;
    if (this.dummy) {
      // 假人：短促倒地，快速移除，不计赏金
      AUDIO.zombieDie(0, this.growlPitch);
      PARTICLES.blood(this.pos.x, 1.1 * this.group.scale.x, this.pos.z, 10);
      this._gibDeath(headshot, overkill);
      this.deadT = 1.4;
      if (game.mode && game.mode.onDummyKilled) {
        game.mode.onDummyKilled(this, headshot, game.player ? game.player.current : 'secondary', game._fragWindowT > 0);
      }
      return;
    }
    const d = game.player ? dist2d(this.pos.x, this.pos.z, game.player.pos.x, game.player.pos.z) : 0;
    AUDIO.zombieDie(d, this.growlPitch);
    PARTICLES.blood(this.pos.x, 1.1 * this.group.scale.x, this.pos.z, 14);
    this._gibDeath(headshot, overkill);
    if (game.player.synVampire && !this.dummy && game.player.alive) game.player.hp = Math.min(game.player.maxHp, game.player.hp + 1);
    if (typeof XPGEMS !== 'undefined' && !this.dummy) XPGEMS.drop(this.pos.x, 0.6, this.pos.z, this.boss ? 30 : this.type.cost >= 3 ? 8 : this.type.cost >= 2 ? 4 : 2);
    if (!this.dummy && typeof CHESTS !== 'undefined' && (this.boss || this.affix)) CHESTS.drop(this.pos.x, this.pos.z, this.boss ? 2 : 1);
    if (typeof spawnLoot !== 'undefined' && !this.dummy) spawnLoot(game, this);
    if (this.type.deathPool) spawnAcidPool(game, this.pos.x, this.pos.z, { poolDps: 12, poolRadius: 2.6, poolTime: 5 });
    if (this.type.explode) explodeBloater(game, this);
    game.onZombieKilled(this, headshot);
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    ENGINE.scene.remove(this.shadow);
    // 回收到对象池（上限10个/类，超出才真正销毁GPU资源）
    const poolKey = this.typeId + (this.dummy ? ':d' : '');
    const pool = ZOMBIE_POOL[poolKey] || (ZOMBIE_POOL[poolKey] = []);
    if (pool.length < 10) {
      this.group.rotation.set(this.type.crawl ? 1.0 : 0, 0, 0);
      this.group.scale.setScalar(this.type.scale);
      this.model.skin.emissive.setHex(0x000000);
      this.model.cloth.emissive.setHex(0x000000);
      this.group.visible = true;
      pool.push(this.group);
    } else {
      this.group.traverse(o => {
        if (o.geometry && o.geometry !== _shadowGeo) o.geometry.dispose();
      });
    }
    // 阴影几何体为共享资源，仅移除网格
  }
}
