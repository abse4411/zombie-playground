/* ============================================================
 * 第一人称身体系统（v6.1/v6.2）
 * 手臂持枪（挂在视图模型） + 低头可见的主角身体
 * ============================================================ */

// 手臂构件：袖子圆柱 + 手掌球（肤色），从肩位伸向握持点
function buildArm(mat, sleeveMat, from, to, thick) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.75, thick, len, 8), sleeveMat);
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  sleeve.position.copy(mid);
  sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const hand = new THREE.Mesh(new THREE.SphereGeometry(thick * 0.95, 8, 6), mat);
  hand.position.copy(to);
  g.add(sleeve, hand);
  return g;
}

// 在视图模型组里加双手（位置随武器长度/类型适配）
function attachArmsToViewmodel(vm, def, sleeveColor) {
  const skin = ART.mat(0xc9a084, {});
  const sleeve = ART.mat(sleeveColor, {});
  const L = def.len;
  if (def.melee) {
    // 近战：单手右手持握
    const arm = buildArm(skin, sleeve,
      new THREE.Vector3(0.1, -0.34, 0.28),
      new THREE.Vector3(0.0, -0.06, -0.02), 0.055);
    vm.add(arm);
    return;
  }
  // 枪械：右手握把 + 左手护木
  const gripZ = -def.len * 0.18;
  const guardZ = -def.len * 0.52;
  const rightArm = buildArm(skin, sleeve,
    new THREE.Vector3(0.14, -0.36, 0.24),
    new THREE.Vector3(0.02, -0.11, gripZ), 0.055);
  const leftArm = buildArm(skin, sleeve,
    new THREE.Vector3(-0.16, -0.34, 0.1),
    new THREE.Vector3(-0.005, -0.05, guardZ), 0.05);
  vm.add(rightArm, leftArm);
}

// 主角自身身体（低头可见）：腿/下躯干/腰带 —— 不含头（避免挡镜头）
function buildPlayerBody(colors) {
  const c = colors || { shirt: 0x3a4a3e, pants: 0x2c3230, vest: 0x232a24, belt: 0x1c1e22 };
  const g = new THREE.Group();
  const legL = limbMesh(0.1, 0.08, 0.82, ART.mat(c.pants));
  legL.position.set(-0.13, 0.82, 0);
  const legR = limbMesh(0.1, 0.08, 0.82, ART.mat(c.pants));
  legR.position.set(0.13, 0.82, 0);
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.22, 10), ART.mat(c.pants));
  hips.position.y = 0.9;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.5, 10), ART.mat(c.shirt));
  torso.position.y = 1.26;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 10), ART.mat(c.belt));
  belt.position.y = 1.02;
  const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.21, 0.3, 10), ART.mat(c.vest));
  vest.position.y = 1.36;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.12), ART.mat(0x2e2a22));
  pack.position.set(0, 1.3, -0.18);
  g.add(legL, legR, hips, torso, belt, vest, pack);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
  return { group: g, legL, legR, walkPhase: 0, _last: new THREE.Vector3() };
}

// 每帧同步：位置/朝向/行走摆腿
function syncPlayerBody(body, player, dt) {
  body.group.position.set(player.pos.x, player.pos.y, player.pos.z);
  body.group.rotation.y = player.yaw + Math.PI;
  const moved = Math.hypot(player.pos.x - body._last.x, player.pos.z - body._last.z);
  body._last.copy(player.pos);
  if (player.moving && moved > 0.0005) {
    body.walkPhase += moved * 5.2;
    body.legL.rotation.x = Math.sin(body.walkPhase) * 0.55;
    body.legR.rotation.x = -Math.sin(body.walkPhase) * 0.55;
  } else {
    body.legL.rotation.x *= 0.85;
    body.legR.rotation.x *= 0.85;
  }
}

// 角色基础配色（v6.2 角色选择共用）
const CHARACTER_BODY_COLORS = {
  raven:    { shirt: 0x3a4a3e, pants: 0x2c3230, vest: 0x232a24, belt: 0x1c1e22 },
  nightingale: { shirt: 0x4a3a4e, pants: 0x2c2832, vest: 0x302838, belt: 0x1c1822 },
  bastion:  { shirt: 0x4a4438, pants: 0x33302a, vest: 0x363028, belt: 0x201c18 },
  apricot:  { shirt: 0x4a5a6a, pants: 0x2a3038, vest: 0x283442, belt: 0x1a2028 },
};
