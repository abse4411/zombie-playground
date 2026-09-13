/* ============================================================
 * 玩家实体 —— 移动 / 生命 / 护甲 / 经济 / 强化
 * ============================================================ */

// 全量 Perk 键归零：新加 Perk（如 tough/scavenger）在旧存档/旧对象上不缺失
function zeroPerks() {
  const o = {};
  for (const id in PERKS) o[id] = 0;
  return o;
}

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
    this.perks = zeroPerks();
    this.weapons = {
      primary: null,
      secondary: new WeaponInstance(WEAPONS.p92),
      melee: new WeaponInstance(WEAPONS.knife),
    };
    // 武器架（v4.5）→ 装备栏（v9.2）：每槽最多2把，超出入背包
    this.rack = {
      primary: [this.weapons.primary].filter(Boolean),
      secondary: [this.weapons.secondary],
      melee: [this.weapons.melee],
    };
    this.EQUIP_MAX = 2;   // 每装备槽上限
    // 背包仓库（v9.2）：容量制，存武器/物资，商城可扩容
    this.storage = [];       // [{kind:'weapon', inst} | {kind:'item', itemId, count}]
    this.storageMax = 6;
    this.current = 'secondary';
    this.lastWeapon = null;   // Q键切换上一把武器 {slot, defId}
    this.throwables = { frag: { count: 2 }, molotov: { count: 1 }, attractor: { count: 0 } };
    // 支援道具库存（v16.3）：背包点击使用；开局送1发战机轰炸供体验
    this.supports = { airstrike: 1, supply: 0, drone: 0, sentry: 0 };
    this.medkits = 2;   // 背包医疗包
    this.alive = true;
    this.lastDamageT = -99;
    this.slowT = 0; this.ads = false; this.onGround = true;
    this.bobPhase = 0; this.moving = false; this.sprinting = false;
    this.moveMult = 1;
    this.dashCd = 0; this.dashT = 0; this.iframesT = 0; this._dashDir = { x: 0, z: 1 };
    this.bileT = 0; this.draggedBy = null;   // L4D特感状态（v9.7）
    this.healT = 0; this.healTotal = 1.2;   // 医疗施法（v11.8）
    // 体力系统（v13.1）
    this.staminaMaxBase = GAMECONFIG.stamina.max;
    this.maxStamina = this.staminaMaxBase;
    this.stamina = this.maxStamina;
    this.staminaRegenMult = 1;
    this.exhausted = false;
    this._stamTipT = 0;
    // 肉鸽强化（v10.6）
    this.xp = 0; this.level = 1; this.xpNext = 10;
    this.rogueLevels = {}; this.rogueAtk = 1; this.rogueRof = 1; this.rogueSpd = 1;
    this.rogueRel = 1; this.critChance = 0; this.cashMult = 1; this.xpMagnet = 0;
    this.recoilAccum = 0;   // 未回复的后坐力（自动回正）
    this.fovPunch = 0;      // 终结镜头 FOV 冲击
    this.recomputePerks();
    this.armor = 0;
  }

  recomputePerks() {
    const p = this.perks;
    const ch = this.charStats || { hp: 100, speed: 1, reload: 1, dmg: 1 };
    this.maxHp = ch.hp + (p.hp > 0 ? PERKS.hp.tiers[p.hp - 1].val : 0);
    this.maxArmor = p.armor > 0 ? PERKS.armor.tiers[p.armor - 1].val : 0;
    this.speedMult = ch.speed * (1 + (p.speed > 0 ? PERKS.speed.tiers[p.speed - 1].val : 0));
    this.reserveMult = 1 + (p.ammo > 0 ? PERKS.ammo.tiers[p.ammo - 1].val : 0);
    this.reloadMult = ch.reload * (1 - (p.reload > 0 ? PERKS.reload.tiers[p.reload - 1].val : 0));
    this.dmgMult = ch.dmg * (1 + (p.ap > 0 ? PERKS.ap.tiers[p.ap - 1].val : 0));
    this.regenRate = p.regen > 0 ? PERKS.regen.tiers[p.regen - 1].val : 0;
    // 专属强化（v8.4）
    this.bulletstormOn = false; this.laststandOn = false;
    if (p.bulletstorm > 0) this.bulletstormVal = PERKS.bulletstorm.tiers[p.bulletstorm - 1].val;
    if (p.laststand > 0) this.laststandVal = PERKS.laststand.tiers[p.laststand - 1].val;
    // 体力：角色基准 + 耐力针剂 + 肾上腺素回复乘区（v13.1）
    const stamBase = (ch.staminaMax !== undefined) ? ch.staminaMax : GAMECONFIG.stamina.max;
    this.staminaMaxBase = stamBase;
    this.maxStamina = stamBase + (p.stamina > 0 ? PERKS.stamina.tiers[p.stamina - 1].val : 0);
    this.staminaRegenMult = ((ch.staminaRegen !== undefined) ? ch.staminaRegen : 1)
      * (1 + (p.adrenaline > 0 ? PERKS.adrenaline.tiers[p.adrenaline - 1].val : 0));
    if (this.stamina === undefined) this.stamina = this.maxStamina;
    if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
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
    let sens = (INPUT.touch ? GAMECONFIG.touchSensBase : GAMECONFIG.sensBase) * SAVE.data.settings.sens;
    // 狙击开镜灵敏度（v7.0）：按FOV比例缩放，倍率可在设置调整（0.2~1.5）
    const _wdef = GAME.weapons && GAME.weapons.w ? GAME.weapons.w.def : null;
    if (_wdef && _wdef.scope && this.ads) {
      const k = SAVE.data.settings.scopeSens !== undefined ? SAVE.data.settings.scopeSens : 0.7;
      sens *= Math.pow(ENGINE.camera.fov / 75, k);
    }
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

    const canSprint = !this.exhausted && this.stamina > 0;   // 疲劳/耗尽时禁冲刺（v13.1）
    const sprint = (INPUT.isDown('ShiftLeft') || INPUT.isDown('ShiftRight')) && fz < 0 && canSprint;
    const P = GAMECONFIG.player;
    let spd = (sprint ? P.sprintSpeed : P.walkSpeed) * this.speedMult;
    if (this.slowT > 0) { spd *= 0.55; this.slowT -= dt; }
    spd *= this.moveMult * (this.rogueSpd || 1) * (this.metaSpd || 1);
    // 背水一战（v8.4）：濒死移速
    if (this.laststandVal && this.hp <= this.maxHp * 0.25) spd *= 1.15;

    // ---- 闪避冲刺 ----
    this.dashCd -= dt;
    this.iframesT -= dt;
    const wantDash = INPUT.justPressed('KeyC') || INPUT.justPressed('ControlLeft');
    const DS = GAMECONFIG.stamina;
    if (wantDash && this.dashCd <= 0 && this.onGround && this.stamina < DS.dashCost) {
      // 体力不足：拒绝闪避并给一次性提示（v13.1）
      if (this._stamTipT <= 0) { HUD.toast('💨 体力不足，无法闪避'); this._stamTipT = 1.5; AUDIO.emptyClick(); }
    }
    if (wantDash && this.dashCd <= 0 && this.onGround && this.stamina >= DS.dashCost) {
      this.stamina -= DS.dashCost;
      this.dashCd = GAMECONFIG.dash.cooldown;
      this.dashT = GAMECONFIG.dash.time;
      this.iframesT = GAMECONFIG.dash.iframes;
      this._dashDir = hasInput ? { x: wx, z: wz } : { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
      AUDIO.dash();
      if (typeof GAME !== 'undefined' && GAME.playerBody) {
        // 侧向分量决定倾倒方向（相对面向）
        const sideX = this._dashDir.x * Math.cos(this.yaw) - this._dashDir.z * Math.sin(this.yaw);
        bodyAct(GAME.playerBody, 'dash', GAMECONFIG.dash.time + 0.1, sideX >= 0 ? 1 : -1);
      }
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
    // ---- 体力结算（v13.1）：冲刺耗、站立快回、走路慢回、疲劳锁定 ----
    {
      const S = GAMECONFIG.stamina;
      if (this._stamTipT > 0) this._stamTipT -= dt;
      if (this.sprinting) {
        this.stamina = Math.max(0, this.stamina - S.sprintDrain * dt);
        if (this.stamina <= 0 && !this.exhausted) { this.exhausted = true; HUD.toast('💨 体力耗尽！'); AUDIO.emptyClick(); }
      } else if (this.stamina < this.maxStamina) {
        const regen = (this.moving ? S.walkRegen : S.idleRegen) * (this.staminaRegenMult || 1);
        this.stamina = Math.min(this.maxStamina, this.stamina + regen * dt);
      }
      if (this.exhausted && this.stamina >= this.maxStamina * S.exhaustedRecover) this.exhausted = false;
    }
    const stepBound = this.bobPhase;
    this.bobPhase += dt * (this.moving ? (this.sprinting ? 11.5 : 8) : 2);
    // 脚步声（相位每跨过 π 触发一步）
    if (this.moving && Math.floor(this.bobPhase / Math.PI) !== Math.floor(stepBound / Math.PI)) {
      AUDIO.step(this.sprinting);
    }

    // 医疗施法（v11.8）
    this._healTick(dt);
    // 再生血清
    if (this.regenRate > 0 && ENGINE.time - this.lastDamageT > 5 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    }
    this.ads = INPUT.rmb;
  }

  takeDamage(dmg, game, srcPos) {
    if (!this.alive) return;
    if (this.iframesT > 0) return;   // 闪避无敌帧
    // 钢铁之躯减伤
    if (this.perks.tough > 0) dmg *= (1 - PERKS.tough.tiers[this.perks.tough - 1].val);
    const P = GAMECONFIG.player;
    if (this.armor > 0) {
      const ab = Math.min(this.armor, dmg * P.armorAbsorb);
      this.armor -= ab; dmg -= ab;
    }
    this.hp -= dmg;
    if (this.healT > 0) { this.healT = 0; HUD.toast('💥 包扎被打断！'); }
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
  /* ---------- 背包仓库（v9.2） ---------- */
  storageUsed() { return this.storage.length; }

  // 入仓：满返回 false（由调用方折现）
  storageAdd(entry) {
    if (this.storage.length >= this.storageMax) return false;
    this.storage.push(entry);
    return true;
  }

  // 尝试把武器装上装备槽：槽位有空则直接装备返回'equipped'；
  // 槽满则把手中武器退入背包再装备返回'swapped'；背包也满返回 false（拒绝）
  equipFromStorage(slot, inst) {
    const idx = this.storage.findIndex(e => e.kind === 'weapon' && e.inst === inst);
    if (idx < 0) return false;
    if (this.rack[slot].length < this.EQUIP_MAX) {
      this.storage.splice(idx, 1);
      this.rack[slot].push(inst);
      this.weapons[slot] = inst;
      this.current = slot;
      return 'equipped';
    }
    // 槽满：退手中旧枪入背包
    const old = this.weapons[slot];
    const oldIdx = this.rack[slot].indexOf(old);
    if (old && this.storageAdd({ kind: 'weapon', inst: old })) {
      this.storage.splice(idx, 1);
      if (oldIdx >= 0) this.rack[slot].splice(oldIdx, 1);
      this.rack[slot].push(inst);
      this.weapons[slot] = inst;
      this.current = slot;
      return 'swapped';
    }
    return false;   // 背包也满
  }

  // 卸下装备槽武器入背包（至少保留1把）
  unequipToStorage(slot, inst) {
    if (this.rack[slot].length <= 1) return false;   // 每槽至少1把
    const idx = this.rack[slot].indexOf(inst);
    if (idx < 0) return false;
    if (!this.storageAdd({ kind: 'weapon', inst })) return false;
    this.rack[slot].splice(idx, 1);
    if (this.weapons[slot] === inst) {
      this.weapons[slot] = this.rack[slot][0] || null;
      this.current = this.weapons[slot] ? slot : 'secondary';
    }
    return true;
  }

  // 应用肉鸽强化系数（v10.6）
  recomputeRogue() {
    this.dmgRogue = this.rogueAtk;
    this.rofRogue = this.rogueRof;
    this.spdRogue = this.rogueSpd;
    this.relRogue = this.rogueRel;
  }

  // 使用医疗包（v11.8）：1.2s施法，受击打断；带自疗动画
  useMedkit() {
    if (this.medkits <= 0 || this.hp >= this.maxHp || this.healT > 0) { AUDIO.emptyClick(); return; }
    this.healT = 1.2; this.healTotal = 1.2;
    if (typeof GAME !== 'undefined' && GAME.playerBody) bodyAct(GAME.playerBody, 'heal', 1.2);
    if (typeof GAME !== 'undefined' && GAME.weapons) GAME.weapons.healAnimT = 1.2;
    AUDIO.reloadStart();
    HUD.toast('💉 包扎中…（受击会打断）');
  }

  // 施法结算（update内调用）
  _healTick(dt) {
    if (this.healT > 0) {
      this.healT -= dt;
      if (typeof HUD !== 'undefined' && HUD.healFlash && Math.random() < dt * 4) HUD.healFlash();
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + (this.medkitHeal || GAMECONFIG.inventory.medkitHeal) * dt / this.healTotal);
      if (this.healT <= 0) {
        this.medkits--;
        if (typeof GAME !== 'undefined' && GAME && SAVE.data) SAVE.data.totalMedkits = (SAVE.data.totalMedkits || 0) + 1;
        AUDIO.purchase();
        HUD.pickup(`🧪 医疗包使用完毕（剩 ${this.medkits}）`, 1);
      }
    }
  }

  addMoney(n) {
    if (this.cashMult > 1) n *= this.cashMult;
    const v = Math.round(n);
    this.money += v;
    this.moneyEarned += v;
  }
}
