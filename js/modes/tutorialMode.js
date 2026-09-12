/* ============================================================
 * 新手教学模式 —— 分步教学关卡
 * 训练假人站桩挨打，逐步解锁操作：移动→疾跑→射击→爆头→
 * 换弹→近战→手雷→闪避→脚踢→商店→毕业
 * ============================================================ */
class TutorialMode {
  constructor(game) {
    this.game = game;
    this.stepIdx = -1;
    this.moveDist = 0;
    this.sprintT = 0;
    this.shotKills = 0;
    this.hsKills = 0;
    this.meleeKill = false;
    this.fragKill = false;
    this.dashed = false;
    this.kicked = false;
    this.bought = false;
    this.lastPos = null;
    this.shopStep = false;
    this.done = false;
    this.dummies = [];
    this.spawnT = 0;
  }

  start() {
    HUD.banner('新兵训练营', '跟着提示逐步完成操作');
    HUD.showObjective(['跟着左侧目标清单行动', '按 ESC 可退出教学']);
    SAVE.data.totalRuns++;
    SAVE.commit();
  }

  /* ---------- 训练假人 ---------- */
  _clearDummies() {
    for (const d of this.dummies) { d.dead = true; d.deadT = 99; d.remove = true; }
    this.dummies = [];
  }

  _spawnDummy(offsets, typeId = 'walker') {
    const g = this.game;
    const p = g.player;
    const base = { x: p.pos.x - Math.sin(p.yaw) * 7, z: p.pos.z - Math.cos(p.yaw) * 7 };
    for (const o of offsets) {
      const z = new Zombie(typeId, base.x + o.x, base.z + o.z, { hp: 0.4, speed: 0, dmg: 0, reward: 0 }, { dummy: true });
      z.riseT = 0.2;
      g.zombies.push(z);
      this.dummies.push(z);
    }
  }

  _aliveDummies() { return this.dummies.filter(d => !d.dead); }

  steps() {
    const T = INPUT.touch;
    return [
      {
        text: T ? '推动左侧摇杆 移动一段距离' : '用 W A S D 移动一段距离',
        hint: T ? '左下角摇杆控制移动' : '前方是训练场，随意的走两步',
        check: (g, dt) => {
          const p = g.player;
          if (this.lastPos) this.moveDist += dist2d(p.pos.x, p.pos.z, this.lastPos.x, this.lastPos.z);
          this.lastPos = { x: p.pos.x, z: p.pos.z };
          return this.moveDist > 7;
        },
        after: () => { this.lastPos = null; },
      },
      {
        text: T ? '推动摇杆到底 疾跑（再试试跳跃）' : '按住 Shift 疾跑，试试空格跳跃',
        hint: T ? '摇杆推到最外圈即疾跑' : '疾跑比走路快得多，跳跃可以翻过矮障碍',
        check: (g) => g.player.sprinting && (this.sprintT += 1 / 60) > 1.2,
        after: () => { this._spawnDummy([{ x: 0, z: 0 }, { x: 1.4, z: 0.6 }, { x: -1.4, z: 0.6 }]); },
      },
      {
        text: T ? '按住🔥开火键 击倒 3 只训练假人' : '左键射击！击倒 3 只训练假人',
        hint: T ? '右侧大火按钮开火' : '准星对准假人躯干，站远一点也没关系',
        check: (g) => this.shotKills >= 3,
      },
      {
        text: '爆头击倒 1 只 —— 命中有额外奖金',
        hint: '瞄准头部（黄色眼睛的位置）',
        check: (g) => this.hsKills >= 1,
      },
      {
        text: T ? '按 ↻ 换弹' : '按 R 换弹',
        hint: '弹匣打空会自动装填，但主动换弹永远是好习惯',
        check: (g) => {
          const w = g.weapons.w;
          if (!w || w.def.melee) return false;
          if (w.mag < w.def.mag) this._wasLow = true;
          return g.weapons.reloadT > 0 || (this._wasLow && w.mag === w.def.mag);
        },
      },
      {
        text: T ? '按 3 切近战，击倒 1 只' : '按 3 切换近战，砍倒 1 只假人',
        hint: '近战无声且弹药免费，被贴脸时的保命手段',
        check: (g) => this.meleeKill,
      },
      {
        text: T ? '按 💣 投掷手雷' : '按 G 投掷手雷，炸倒假人',
        hint: '手雷碰到丧尸会立即引爆，注意自己也别站太近',
        check: (g) => this.fragKill,
      },
      {
        text: T ? '按 ⚡ 闪避冲刺' : '按 C（或 Ctrl）闪避冲刺',
        hint: '冲刺瞬间有无敌帧，能穿过尸群的扑咬',
        check: (g) => this.dashed,
      },
      {
        text: T ? '按 👟 脚踢' : '按 F 脚踢！把假人踹飞',
        hint: 'Dying Light 式群体控制：大硬直+大击退，冷却1秒',
        check: (g) => this.kicked,
      },
      {
        text: '走到绿色光环的补给站，按 B 打开并购买任意商品',
        hint: '资金已备好——买把 MP5 试试火力',
        init: (g) => {
          this.shopStep = true;
          g.player.addMoney(1500);
          this._shopMoney = g.player.money;
          HUD.toast('教学补贴 +$1500');
        },
        check: (g) => g.player.money <= this._shopMoney - 100,
        after: () => { this.shopStep = false; },
      },
      {
        text: '毕业考核：在 25 秒内击倒全部假人！',
        hint: '综合运用：射击+脚踢+闪避',
        init: (g) => {
          this._clearDummies();
          this._spawnDummy([{ x: 0, z: 0 }, { x: 1.6, z: 0.8 }, { x: -1.6, z: 0.8 }, { x: 0.8, z: -1.4 }, { x: -0.8, z: -1.4 }], 'runner');
          this.examT = 25;
        },
        check: (g, dt) => {
          this.examT -= dt;
          return this._aliveDummies().length === 0 || this.examT <= 0;
        },
      },
    ];
  }

  // 假人被击杀时由 Zombie.die 调用
  onDummyKilled(z, headshot, slot, fragWindow) {
    AUDIO.dummyHit();
    // 手雷归因优先：手雷步骤通常紧跟近战步骤，玩家手里还是军刀，
    // 若先判 slot==='melee' 会把手雷击杀记到近战上，导致手雷步骤永远过不去
    if (fragWindow) this.fragKill = true;
    else if (slot === 'melee') this.meleeKill = true;
    else if (headshot) this.hsKills++;
    else this.shotKills++;
  }

  update(dt) {
    const g = this.game;
    // 闪避 / 脚踢 完成检测（观察玩家实际行为）
    if (g.player && g.player.dashT > 0) this.dashed = true;
    if (g.weapons && g.weapons.kickCd > GAMECONFIG.kick.cooldown - 0.45) this.kicked = true;
    // 补充假人（当前步骤需要但已全部倒下）
    this.spawnT -= dt;
    if (this.stepIdx >= 0 && this.stepIdx < this.steps().length && this.spawnT <= 0) {
      const step = this.steps()[this.stepIdx];
      const needDummies = [2, 3, 4, 5, 6, 7, 8, 9].includes(this.stepIdx);
      if (needDummies && this._aliveDummies().length === 0 && !this.done) {
        this._spawnDummy([{ x: 0, z: 0 }, { x: 1.4, z: 0.6 }, { x: -1.4, z: 0.6 }]);
        this.spawnT = 2;
      }
    }

    // 当前步骤
    if (this.stepIdx < 0) {
      this._next();
      return;
    }
    const steps = this.steps();
    if (this.stepIdx >= steps.length) {
      if (!this.done) this._finish();
      return;
    }
    const step = steps[this.stepIdx];
    if (step.check(g, dt)) {
      if (step.after) step.after(g);
      this._next();
    }
  }

  _next() {
    this.stepIdx++;
    const steps = this.steps();
    if (this.stepIdx >= steps.length) { this._finish(); return; }
    const step = steps[this.stepIdx];
    if (step.init) step.init(this.game);
    HUD.setObjective(step.text, step.hint || '', this.stepIdx + 1, steps.length);
    AUDIO.waveClear();
  }

  _finish() {
    this.done = true;
    SAVE.data.tutorialDone = true;
    SAVE.commit();
    if (typeof ACHV !== 'undefined') ACHV.event('tutorial', this.game);
    HUD.setObjective('✔ 教学完成！', '', 0, 0);
    HUD.banner('训练营毕业！', '去主菜单开始你的狩猎吧');
    AUDIO.victory();
    const g = this.game;
    setTimeout(() => { if (g.state === 'playing') g.quitToMenu(); }, 3500);
  }

  getTopInfo() {
    return {
      wave: '🎓 新手教学',
      objective: `第 ${this.stepIdx + 1}/11 步 · 按 ESC 暂停可退出`,
    };
  }

  resultStats() {
    return [['教学进度', `${Math.min(this.stepIdx + 1, 11)}/11 步`, 'gold']];
  }
}
