/* ============================================================
 * 遭遇战模式 —— 带剧情的定时防御任务
 * 胜利条件：坚守到任务时间结束，或全波次清空
 * ============================================================ */
class EncounterMode {
  constructor(game, missionIdx, skipIntro) {
    this.game = game;
    this.idx = missionIdx;
    this.m = MISSIONS[missionIdx];
    this.skipIntro = !!skipIntro;
    this.elapsed = 0;
    this.wavePtr = 0;
    this.brutePtr = 0;
    this.miniPtr = 0;   // 小Boss脚本指针（v15.4）
    this.finaleSpawned = false;   // 幕末Boss（v6.9）
    this.finaleHordeSpawned = false;   // L4D finale尸潮（v9.9）
    // CSOL大灾变式阶段制（v10.0）：defend→destroy→boss
    this.phaseIdx = -1;
    this.reactorSpawned = false;
    this.doorsSpawned = false;
    this.bossPhaseSpawned = false;
    this.midPlayed = false;
    this.ended = false;
    this.earlyWin = false;
    this.rating = '';
    this.killsAtStart = game.player ? game.player.kills : 0;
    // ---- 挑战任务（每局随机3条） ----
    const T = Math.round(missionIdx * 1.5);
    const pool = [
      { id: 'hs', text: `爆头击杀 ${8 + T} 只`, check: g => g.player.headshots >= 8 + T, bonus: 300 },
      { id: 'dmg', text: `累计受击不超过 ${5} 次`, check: g => (g.mode.elapsed || 0) > 60 && g.runStats.damageTaken <= 5, bonus: 350 },
      { id: 'kills', text: `击杀 ${30 + T * 8} 只感染体`, check: g => g.player.kills - this.killsAtStart >= 30 + T * 8, bonus: 300 },
      { id: 'frag', text: `手雷击杀 ${4} 只`, check: g => g.runStats.fragKills >= 4, bonus: 250 },
      { id: 'streak', text: `打出一次 6 连杀`, check: g => g.killStreak >= 6, bonus: 300 },
    ];
    this.challenges = [];
    const cp = [...pool];
    while (this.challenges.length < 3 && cp.length) {
      this.challenges.push({ ...cp.splice(Math.floor(Math.random() * cp.length), 1)[0], done: false });
    }
  }

  start() {
    HUD.banner(this.m.name, this.m.objective);
    SAVE.data.totalRuns++;
    SAVE.commit();
    if (!this.skipIntro) {
      STORY.play([{ s: '遭遇战简报', t: this.m.brief }, ...this.m.intro], () => GAME.onStoryDone());
    } else {
      GAME.onStoryDone();
    }
  }

  update(dt) {
    if (this.ended) return;
    const g = this.game;
    const m = this.m;
    this.elapsed += dt;

    // 按时间表投放波次
    while (this.wavePtr < m.waves.length && m.waves[this.wavePtr].at <= this.elapsed) {
      // 难度倍率（v8.5）：章节难度 × 玩家选择难度
      const df = DIFFICULTIES[GAME._missionDiff] || DIFFICULTIES.normal;
      g.spawner.setMults({
        hp: m.hpMult * df.hp,
        speed: (1 + (m.hpMult - 1) * 0.15) * df.speed,
        dmg: (1 + (m.hpMult - 1) * 0.3) * df.dmg,
        reward: m.rewardMult * df.reward,
      });
      g.spawner.addComposition(m.waves[this.wavePtr].comp);
      // 武装人类波次播报（v15.2）：敌人里有活人枪手时给出战术提示
      const comp = m.waves[this.wavePtr].comp;
      const hasHuman = Object.keys(comp).some(id => ZOMBIE_TYPES[id] && ZOMBIE_TYPES[id].human);
      if (hasHuman) {
        HUD.banner(`第 ${this.wavePtr + 1} 波来袭 · ⚠ 武装人类`, '活人枪手混在尸群里——找掩体，别站桩对枪');
        if (!this._humanTipShown) {
          this._humanTipShown = true;
          HUD.killfeed('⚠ 人类枪手：开枪前有明显瞄准停顿；对它造成伤害可打断瞄准；换弹时是击杀窗口', 'big');
        }
      } else {
        HUD.banner(`第 ${this.wavePtr + 1} 波来袭`, m.name);
      }
      AUDIO.waveHorn();
      this.wavePtr++;
    }

    // 终章：精英暴君登场
    if (m.eliteBrutes) {
      while (this.brutePtr < m.eliteBrutes.length && m.eliteBrutes[this.brutePtr].at <= this.elapsed) {
        const eb = m.eliteBrutes[this.brutePtr];
        for (let i = 0; i < eb.count; i++) g.spawner.spawnOne('brute');
        HUD.killfeed('⚠ 守门人 · 暴君 已苏醒！', 'big');
        AUDIO.scream(0);
        ENGINE.shake(0.35);
        this.brutePtr++;
      }
    }

    // 小Boss登场（v15.4）：剧情到点召唤（登场三件套在 spawnMiniboss 内）
    if (m.minibosses) {
      while (this.miniPtr < m.minibosses.length && m.minibosses[this.miniPtr].at <= this.elapsed) {
        g.spawner.spawnMiniboss(m.minibosses[this.miniPtr].id);
        this.miniPtr++;
      }
    }

    // ---- CSOL大灾变阶段制（v10.0）----
    if (m.phases) this._phaseTick(g);
    // L4D式finale尸潮（v9.9）：坦克+持续尸潮压阵
    if (m.finaleHorde && !this.finaleHordeSpawned && this.elapsed >= m.finaleHorde.at) {
      this.finaleHordeSpawned = true;
      for (let i = 0; i < m.finaleHorde.tanks; i++) {
        const tk = g.spawner.spawnOne('tank');
        if (tk) HUD.killfeed('⚠ TANK 出现了！！', 'big');
      }
      AUDIO.hordeHorn();
      ENGINE.shake(0.4);
      HUD.banner('🚨 FINALE', '坦克 + 尸潮——守住！');
    }
    // 幕末Boss战（v6.9）：到点召唤专属Boss，击杀是胜利前提
    if (m.finaleBoss && !this.finaleSpawned && this.elapsed >= m.finaleBoss.at) {
      this.finaleSpawned = true;
      const b = g.spawner.spawnOne('brute', undefined, undefined, { boss: true, bossId: m.finaleBoss.id });
      if (b) {
        g.onBossSpawned(b);
        STORY.cancel();
        HUD.banner('☠ ' + b.displayName, '消灭它才能完成任务');
        AUDIO.hordeHorn();
        ENGINE.shake(0.5);
      }
    }

    // 中段剧情
    if (!this.midPlayed && this.elapsed > m.duration * 0.5) {
      this.midPlayed = true;
      STORY.play(m.mid, () => GAME.onStoryDone());
      return;
    }

    g.spawner.update(dt);

    // 挑战任务检测
    for (const c of this.challenges) {
      if (!c.done && c.check(g)) {
        c.done = true;
        g.player.addMoney(c.bonus);
        HUD.toast(`🏅 挑战完成：${c.text} +$${c.bonus}`);
        AUDIO.streak();
      }
    }

    // ---- 胜利判定 ----
    if (this.elapsed >= m.duration && (!m.finaleBoss || this.finaleSpawned)) {
      if (m.finaleBoss && g.boss && !g.boss.dead) {
        // Boss未死：拖延至击杀（时间到后Boss仍在场则继续坚守）
        if (this.elapsed >= m.duration && !this._otShown) { this._otShown = true; HUD.toast('☠ ' + (g.boss.displayName || 'Boss') + ' 仍在场——击杀它完成任务！'); }
      } else { this.win(false); return; }
    }
    const allSpawned = this.wavePtr >= m.waves.length
      && (!m.eliteBrutes || this.brutePtr >= m.eliteBrutes.length)
      && (!m.minibosses || this.miniPtr >= m.minibosses.length)
      && (!m.finaleBoss || (this.finaleSpawned && !g.boss));
    if (allSpawned && g.spawner.exhausted() && g.aliveZombies() === 0 && this.elapsed > 12) {
      this.win(true);
    }
  }

  win(early) {
    if (this.ended) return;
    this.ended = true;
    this.earlyWin = early;
    const m = this.m;   // 番外判定/评级都要用（此前漏定义导致 win 崩溃）
    // 番外篇：独立完成标记，不影响主战役解锁链
    if (m.spinoff) {
      SAVE.data.spinoffsDone = SAVE.data.spinoffsDone || {};
      SAVE.data.spinoffsDone[m.id] = true;
      SAVE.commit();
    } else {
      SAVE.completeMission(this.idx);
      if (typeof ACHV !== 'undefined') ACHV.event('chapter', this.game);
    }
    // ---- 章节评级（命中率40% + 击杀效率30% + 承伤30%）----
    const g = this.game, p = g.player;
    // 难度加成（v8.5）：困难章末奖金+30% 噩梦+60% + 难度成就
    const df = DIFFICULTIES[GAME._missionDiff] || DIFFICULTIES.normal;
    if (GAME._missionDiff === 'hard') this.chapterBonus = Math.round((this.chapterBonus || 0) * 1.3);
    if (GAME._missionDiff === 'nightmare') this.chapterBonus = Math.round((this.chapterBonus || 0) * 1.6);
    if (GAME._missionDiff !== 'normal' && typeof ACHV !== 'undefined') {
      if (GAME._missionDiff === 'hard') ACHV.event('hardWin', g);
      if (GAME._missionDiff === 'nightmare') ACHV.event('nightmareWin', g);
    }
    const acc = g.stats.shots ? g.stats.hits / g.stats.shots : 0.5;
    const kpm = p.kills / (this.m.duration / 60);
    const dmgK = Math.max(0, 1 - g.runStats.damageTaken / 12);
    const score = Math.min(100, Math.round(acc * 40 + Math.min(1, kpm / 12) * 30 + dmgK * 30));
    this.rating = score >= 80 ? 'S' : score >= 65 ? 'A' : score >= 45 ? 'B' : 'C';
    const best = SAVE.data.bestRating || (SAVE.data.bestRating = {});
    if (!best[this.idx] || 'SABC'.indexOf(this.rating) < 'SABC'.indexOf(best[this.idx])) {
      best[this.idx] = this.rating;
    }
    // ---- 战役继承快照：仅主战役章节（番外独立结算）----
    const E = GAMECONFIG.economy;
    if (!m.spinoff) {
      this.chapterBonus = E.chapterBonusBase + E.chapterBonusPerChapter * this.idx;
      const weapons = {};
      for (const slot of ['primary', 'secondary', 'melee']) {
        weapons[slot] = p.rack[slot].map(inst => ({ id: inst.def.id, lvl: inst.lvl }));
      }
      weapons.current = p.current;
      SAVE.data.carry = {
        nextIdx: this.idx + 1,
        money: p.money + this.chapterBonus,
        perks: { ...p.perks },
        frag: THROWABLES.frag.max,
        molo: THROWABLES.molotov.max,
        weapons,
      };
    } else {
      this.chapterBonus = Math.round(E.chapterBonusBase * 0.6);
    }
    SAVE.commit();
    AUDIO.victory();
    const finish = early ? '（提前清空全场！）' : '';
    STORY.play([{ s: '任务完成', t: `坚守目标达成${finish} · 评级 ${this.rating}` }, ...this.m.outro],
      () => GAME.showVictory(this.idx));
  }

  /* ---------- CSOL大灾变阶段系统（v10.0） ---------- */
  _phaseTick(g) {
    const phases = this.m.phases;
    const cur = phases[this.phaseIdx];
    // 推进条件
    let advance = false;
    if (this.phaseIdx === -1) advance = true;   // 进入第一阶段
    else if (cur.type === 'defend' && this.elapsed >= cur.until) advance = true;
    else if (cur.type === 'destroy' && g.destructibles.filter(d => d.kind === 'reactor' && !d.dead).length === 0 && this.reactorSpawned) advance = true;
    else if (cur.type === 'breach' && this.doorsSpawned && g.destructibles.filter(d => d.isMissionDoor && !d.dead).length === 0) advance = true;
    if (advance) {
      this.phaseIdx++;
      const ph = phases[this.phaseIdx];
      if (!ph) return;
      // 转场演出（v10.2）：闪白+慢镜+横幅
      HUD.banner('▣ ' + ph.label, '阶段 ' + (this.phaseIdx + 1) + ' / ' + phases.length);
      AUDIO.waveHorn();
      ENGINE.shake(0.3);
      this.game.slowmo(0.6);
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:200;pointer-events:none;opacity:.85;transition:opacity .5s';
      document.body.appendChild(flash);
      requestAnimationFrame(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 600); });
      if (ph.type === 'breach' && !this.doorsSpawned) {
        // 剧情破坏门（v11.2）：3道封锁门三角布置
        this.doorsSpawned = true;
        const S2 = Math.min(26, ENGINE.mapDef.size - 12);
        const spots = [[-S2 * 0.4, S2 * 0.3], [S2 * 0.45, -S2 * 0.2], [0, -S2 * 0.5]];
        this._doorsTotal = spots.length;
        spots.forEach(([x, z], i) => {
          const d = new Destructible(i === 0 ? 'door' : (i === 1 ? 'woodwall' : 'door'), x, z, rand(0, TAU));
          d.isMissionDoor = true;
          g.destructibles.push(d);
          PARTICLES.dust(x, 1, z, 8);
        });
        HUD.toast(`🚪 破坏全部 ${this._doorsTotal} 道封锁门突进！（可射击/近战/爆炸）`);
      }
      if (ph.type === 'destroy' && !this.reactorSpawned) {
        // 生成3座反应堆（围绕地图中心三角布置）
        this.reactorSpawned = true;
        const S = Math.min(30, ENGINE.mapDef.size - 10);
        const spots = [[-S * 0.5, -S * 0.5], [S * 0.5, -S * 0.4], [0, S * 0.55]];
        for (const [x, z] of spots) {
          const d = new Destructible('reactor', x, z, rand(0, TAU));
          g.destructibles.push(d);
          PARTICLES.dust(x, 1, z, 10);
        }
        HUD.toast('💥 摧毁全部 3 座赤潮反应堆！');
      }
      if (ph.type === 'boss' && !this.bossPhaseSpawned) {
        this.bossPhaseSpawned = true;
        const b = g.spawner.spawnOne('brute', undefined, undefined, { boss: true, bossId: 'xt300' });
        if (b) { g.onBossSpawned(b); HUD.killfeed('⚠ 钢铁哨兵 XT-300 启动！', 'big'); }
      }
    }
    // defend 阶段提示
    if (cur && cur.type === 'defend') {
      const left = Math.max(0, Math.ceil(cur.until - this.elapsed));
      if (left !== this._lastDefendLeft) { this._lastDefendLeft = left; }
    }
  }

  getTopInfo() {
    const g = this.game;
    return {
      wave: `任务时间 ${fmtTime(this.m.duration - this.elapsed)}`,
      objective: `${this.m.objective} · 剩余丧尸 ${g.aliveZombies() + g.spawner.remaining()}`,
    };
  }

  resultStats() {
    const g = this.game, p = g.player;
    const outcome = !p.alive ? '任务失败'
      : (this.earlyWin ? '提前肃清' : '坚守成功');
    const rows = [
      ['任务结果', outcome, outcome === '任务失败' ? 'red' : 'gold'],
      ['任务评级', this.rating || '—', this.rating === 'S' ? 'gold' : ''],
      ['挑战完成', `${this.challenges.filter(c => c.done).length}/3`, ''],
      ['过关奖励', this.chapterBonus !== undefined ? fmtMoney(this.chapterBonus) : '—', 'gold'],
    ];
    return rows.concat([
      ['总击杀', `${p.kills}`, 'red'],
      ['爆头击杀', `${p.headshots}`, ''],
      ['命中率', g.stats.shots ? Math.round(g.stats.hits / g.stats.shots * 100) + '%' : '—', ''],
      ['剩余时间', fmtTime(this.m.duration - this.elapsed), ''],
      ['赚取资金', fmtMoney(p.moneyEarned), 'gold'],
    ]);
  }
}
