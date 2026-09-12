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

// 主角自身身体（低头可见）：腰带/髋 + 双腿/靴子
// 设计约束：视线高度1.7 —— 不做胸腔（胸腔顶面会挡住腿，v6.6"半圆"问题根源）；
// 躯干存在感由第一人称视图模型的双臂承担，低头看到的是腰+双腿（Minecraft式）
function buildPlayerBody(colors) {
  const c = colors || { shirt: 0x3a4a3e, pants: 0x2c3230, vest: 0x232a24, belt: 0x1c1e22 };
  const g = new THREE.Group();
  const pantsMat = ART.mat(c.pants);
  const bootMat = ART.mat(0x1c1a18);
  // 双腿：分立方柱并整体前移——低头时腿从髋板前方露出（正下方会被髋部挡死）；
  // 间隙拉大让两腿可辨；靴子挂腿上随摆动
  // 注意：Object3D.add() 返回父对象自身，链式 .position 会覆盖腿的坐标，必须分开赋值
  const legGeo = new THREE.BoxGeometry(0.15, 0.92, 0.18);
  const bootGeo = new THREE.BoxGeometry(0.16, 0.09, 0.27);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.145, 0.46, 0.16);
  const bootL = new THREE.Mesh(bootGeo, bootMat);
  bootL.position.set(0, -0.415, 0.045);
  legL.add(bootL);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.145, 0.46, 0.16);
  const bootR = new THREE.Mesh(bootGeo, bootMat);
  bootR.position.set(0, -0.415, 0.045);
  legR.add(bootR);
  // 髋部 + 腰带（小截面盒状，远低于视线不挡腿）
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.16), pantsMat);
  hips.position.y = 1.01;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.17), ART.mat(c.belt));
  belt.position.y = 1.14;
  g.add(legL, legR, hips, belt);
  // 美漫描边：低头视角下把腿/髋/地面在视觉上分开（否则平面光下融成一块灰板）
  if (ENGINE.quality.outlines) {
    ART.outline(legL, 1.14); ART.outline(legR, 1.14);
    ART.outline(hips, 1.12); ART.outline(belt, 1.12);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
  return { group: g, legL, legR, walkPhase: 0, _last: new THREE.Vector3(), action: null, actT: 0, actDur: 0.3, actDir: 1 };
}

// 每帧同步：位置/朝向/行走摆腿 + 动作姿态（v8.7 肢体动作强化）
// action: null / 'kick' / 'dash' / 'throw' / 'swing'
function syncPlayerBody(body, player, dt) {
  body.group.position.set(player.pos.x, player.pos.y, player.pos.z);
  body.group.rotation.y = player.yaw + Math.PI;
  const moved = Math.hypot(player.pos.x - body._last.x, player.pos.z - body._last.z);
  body._last.copy(player.pos);
  // 行走摆腿
  if (player.moving && moved > 0.0005) {
    body.walkPhase += moved * 5.2 * (player.sprinting ? 1.35 : 1);
    body.legL.rotation.x = Math.sin(body.walkPhase) * 0.55;
    body.legR.rotation.x = -Math.sin(body.walkPhase) * 0.55;
  } else {
    body.legL.rotation.x *= 0.85;
    body.legR.rotation.x *= 0.85;
  }
  // 冲刺前倾 + 行走基线
  let lean = player.sprinting ? -0.12 : 0;
  let rollZ = 0, crouch = 1;
  // 动作姿态（预备→爆发→回弹 三段插值）
  if (body.actT > 0) {
    body.actT -= dt;
    const D = body.actDur || 0.3;
    const k = 1 - body.actT / D;          // 0→1
    const pulse = Math.sin(clamp(k, 0, 1) * Math.PI);          // 单峰
    const thrust = clamp((k - 0.25) / 0.3, 0, 1);              // 爆发段
    switch (body.action) {
      case 'kick':   // 右腿弹踢：预备收腿(-0.4) → 前踢(-1.5) → 过冲回弹
        body.legR.rotation.x = -0.4 - thrust * 1.15 + pulse * 0.5;
        body.legR.position.z = 0.16 + thrust * 0.28;
        lean = -0.06 - pulse * 0.1;   // 上身后仰
        break;
      case 'dash':   // 侧倾+蹲低
        rollZ = (body.actDir || 1) * 0.35 * pulse;
        crouch = 1 - 0.14 * pulse;
        lean = 0.14 * pulse;
        break;
      case 'throw':  // 右臂前挥由视图模型承担；身体右转带肩
        lean = 0.08 * pulse;
        rollZ = -0.18 * thrust;
        break;
      case 'heal':   // 自疗：微蹲+右倾包扎姿态
        crouch = 1 - 0.06 * pulse;
        rollZ = 0.12 * pulse;
        lean = 0.1 * pulse;
        break;
      case 'swing':  // 近战挥击：左腿跨步+转肩
        body.legL.rotation.x = -0.5 * thrust;
        lean = -0.05 * pulse;
        rollZ = -0.12 * thrust;
        break;
    }
    if (body.actT <= 0) { body.action = null; body.legR.position.z = 0.16; }
  }
  body.group.rotation.x = lean;
  body.group.rotation.z = rollZ;
  body.group.scale.y = crouch;
}

// 触发动作姿态
function bodyAct(body, action, dur, dir) {
  if (!body) return;
  body.action = action;
  body.actT = dur || 0.3;
  body.actDur = dur || 0.3;
  body.actDir = dir || 1;
}

// 角色基础配色（v6.2 角色选择共用）
const CHARACTER_BODY_COLORS = {
  raven:    { shirt: 0x3a4a3e, pants: 0x2c3230, vest: 0x232a24, belt: 0x1c1e22 },
  nightingale: { shirt: 0x4a3a4e, pants: 0x2c2832, vest: 0x302838, belt: 0x1c1822 },
  bastion:  { shirt: 0x4a4438, pants: 0x33302a, vest: 0x363028, belt: 0x201c18 },
  apricot:  { shirt: 0x4a5a6a, pants: 0x2a3038, vest: 0x283442, belt: 0x1a2028 },
};
