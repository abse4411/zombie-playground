/* ============================================================
 * 玩家实体 —— 移动 / 生命 / 护甲 / 经济 / 强化
 * ============================================================ */
class Player {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.pos.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.hp = GAMECONFIG.player.maxHp;
    this.money = GAMECONFIG.economy.startMoney;
    this.kills = 0; this.headshots = 0;
    this.moneyEarned = 0;
    this.perks = { hp: 0, armor: 0, speed: 0, ammo: 0, reload: 0, ap: 0, regen: 0 };
    this.weapons = {
      primary: null,
      secondary: new WeaponInstance(WEAPONS.p92),
      melee: new WeaponInstance(WEAPONS.knife),
    };
    this.current = 'secondary';
    this.throwables = { frag: { count: 2 }, molotov: { count: 1 } };
    this.medkits = 2;   // 背包医疗包
    this.alive = true;
    this.lastDamageT = -99;
    this.slowT = 0; this.ads = false; this.onGround = true;
    this.bobPhase = 0; this.moving = false; this.sprinting = false;
    this.moveMult = 1;
    this.dashCd = 0; this.dashT = 0; this.iframesT = 0; this._dashDir = { x: 0, z: 1 };
    this.recoilAccum = 0;   // 未回复的后坐力（自动回正）
    this.fovPunch = 0;      // 终结镜头 FOV 冲击
    this.recomputePerks();
    this.armor = 0;
  }

  recomputePerks() {
    const p = this.perks;
    this.maxHp = p.hp > 0 ? PERKS.hp.tiers[p.hp - 1].val : GAMECONFIG.player.maxHp;
    this.maxArmor = p.armor > 0 ? PERKS.armor.tiers[p.armor - 1].val : 0;
    this.speedMult = 1 + (p.speed > 0 ? PERKS.speed.tiers[p.speed - 1].val : 0);
    this.reserveMult = 1 + (p.ammo > 0 ? PERKS.ammo.tiers[p.ammo - 1].val : 0);
    this.reloadMult = 1 - (p.reload > 0 ? PERKS.reload.tiers[p.reload - 1].val : 0);
    this.dmgMult = 1 + (p.ap > 0 ? PERKS.ap.tiers[p.ap - 1].val : 0);
    this.regenRate = p.regen > 0 ? PERKS.regen.tiers[p.regen - 1].val : 0;
    if (this.armor > this.maxArmor) this.armor = this.maxArmor;
  }

  spawnAt(map) {
    const s = map.playerSpawn;
    this.pos.set(s.x, 0, s.z);
    this.yaw = s.yaw; this.pitch = 0;
    this.vel.set(0, 0, 0);
  }

  update(dt, game) {
    if (!this.alive) return;

    // ---- 视角 ----
    const m = INPUT.consumeMouse();
    const sens = (INPUT.touch ? GAMECONFIG.touchSensBase : GAMECONFIG.sensBase) * SAVE.data.settings.sens;
    this.yaw -= m.dx * sens;
    this.pitch = clamp(this.pitch - m.dy * sens, -1.53, 1.53);
    // 后坐力自动回正
    if (this.recoilAccum > 0.0001) {
      const rec = Math.min(this.recoilAccum, this.recoilAccum * 5.5 * dt + 0.0001);
      this.pitch = clamp(this.pitch - rec, -1.53, 1.53);
      this.recoilAccum -= rec;
    }

    // ---- 移动 ----
    let fx = 0, fz = 0;
    if (INPUT.isDown('KeyW')) fz -= 1;
    if (INPUT.isDown('KeyS')) fz += 1;
    if (INPUT.isDown('KeyA')) fx -= 1;
    if (INPUT.isDown('KeyD')) fx += 1;
    // 触屏虚拟摇杆
    if (INPUT.touch && INPUT.axis && (INPUT.axis.x || INPUT.axis.y)) {
      fx += INPUT.axis.x;
      fz += INPUT.axis.y;
    }
    const hasInput = fx !== 0 || fz !== 0;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = 0, wz = 0;
    if (hasInput) {
      wx = fz * sin + fx * cos;
      wz = fz * cos - fx * sin;
      const l = Math.hypot(wx, wz) || 1;
      wx /= l; wz /= l;
    }

    const sprint = (INPUT.isDown('ShiftLeft') || INPUT.isDown('ShiftRight')) && fz < 0;
    const P = GAMECONFIG.player;
    let spd = (sprint ? P.sprintSpeed : P.walkSpeed) * this.speedMult;
    if (this.slowT > 0) { spd *= 0.55; this.slowT -= dt; }
    spd *= this.moveMult;

    // ---- 闪避冲刺 ----
    this.dashCd -= dt;
    this.iframesT -= dt;
    const wantDash = INPUT.justPressed('KeyC') || INPUT.justPressed('ControlLeft');
    if (wantDash && this.dashCd <= 0 && this.onGround) {
      this.dashCd = GAMECONFIG.dash.cooldown;
      this.dashT = GAMECONFIG.dash.time;
      this.iframesT = GAMECONFIG.dash.iframes;
      this._dashDir = hasInput ? { x: wx, z: wz } : { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
      AUDIO.dash();
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.x = this._dashDir.x * GAMECONFIG.dash.speed;
      this.vel.z = this._dashDir.z * GAMECONFIG.dash.speed;
    } else {
      const accel = this.onGround ? 13 : 2.5;
      this.vel.x = lerp(this.vel.x, wx * spd, Math.min(1, accel * dt));
      this.vel.z = lerp(this.vel.z, wz * spd, Math.min(1, accel * dt));
    }

    // 重力 / 跳跃
    this.vel.y -= P.gravity * dt;
    if (this.onGround && INPUT.justPressed('Space')) this.vel.y = P.jumpVel;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    // 立体地形：水平推挤(可踏上台阶) + 落到支撑面高度（v4.1）
    resolveCircleAABBs(this.pos, P.radius, 1.7, this.pos.y, 0.55);
    const gh = groundHeightAt(this.pos.x, this.pos.z, P.radius, this.pos.y, 0.55);
    if (this.pos.y <= gh) {
      if (this.vel.y < -7) AUDIO.step(true);   // 落地重脚步
      this.pos.y = gh;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    const S = ENGINE.mapDef ? ENGINE.mapDef.size : 60;
    this.pos.x = clamp(this.pos.x, -S + 0.8, S - 0.8);
    this.pos.z = clamp(this.pos.z, -S + 0.8, S - 0.8);

    this.moving = hasInput && this.onGround;
    this.sprinting = sprint && this.moving;
    const stepBound = this.bobPhase;
    this.bobPhase += dt * (this.moving ? (this.sprinting ? 11.5 : 8) : 2);
    // 脚步声（相位每跨过 π 触发一步）
    if (this.moving && Math.floor(this.bobPhase / Math.PI) !== Math.floor(stepBound / Math.PI)) {
      AUDIO.step(this.sprinting);
    }

    // 再生血清
    if (this.regenRate > 0 && ENGINE.time - this.lastDamageT > 5 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    }
    this.ads = INPUT.rmb;
  }

  takeDamage(dmg, game, srcPos) {
    if (!this.alive) return;
    if (this.iframesT > 0) return;   // 闪避无敌帧
    const P = GAMECONFIG.player;
    if (this.armor > 0) {
      const ab = Math.min(this.armor, dmg * P.armorAbsorb);
      this.armor -= ab; dmg -= ab;
    }
    this.hp -= dmg;
    this.lastDamageT = ENGINE.time;
    AUDIO.playerHurt();
    ENGINE.shake(0.1 + Math.min(0.25, dmg * 0.005));
    HUD.damageFlash();
    if (srcPos && HUD.showDamageDir) HUD.showDamageDir(srcPos);
    if (game && game.onPlayerDamaged) game.onPlayerDamaged();
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false;
      if (game) game.playerDied();
    }
  }

  // 使用医疗包（H键）
  useMedkit() {
    if (this.medkits <= 0 || this.hp >= this.maxHp) { AUDIO.emptyClick(); return; }
    this.medkits--;
    this.hp = Math.min(this.maxHp, this.hp + GAMECONFIG.inventory.medkitHeal);
    AUDIO.purchase();
    HUD.pickup(`🧪 使用医疗包 +${GAMECONFIG.inventory.medkitHeal}HP（剩 ${this.medkits}）`, 1);
  }

  addMoney(n) {
    const v = Math.round(n);
    this.money += v;
    this.moneyEarned += v;
  }
}
