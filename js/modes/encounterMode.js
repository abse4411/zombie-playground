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
      g.spawner.setMults({
        hp: m.hpMult,
        speed: 1 + (m.hpMult - 1) * 0.15,
        dmg: 1 + (m.hpMult - 1) * 0.3,
        reward: m.rewardMult,
      });
      g.spawner.addComposition(m.waves[this.wavePtr].comp);
      HUD.banner(`第 ${this.wavePtr + 1} 波来袭`, m.name);
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
    if (this.elapsed >= m.duration) { this.win(false); return; }
    const allSpawned = this.wavePtr >= m.waves.length
      && (!m.eliteBrutes || this.brutePtr >= m.eliteBrutes.length);
    if (allSpawned && g.spawner.exhausted() && g.aliveZombies() === 0 && this.elapsed > 12) {
      this.win(true);
    }
  }

  win(early) {
    if (this.ended) return;
    this.ended = true;
    this.earlyWin = early;
    SAVE.completeMission(this.idx);
    if (typeof ACHV !== 'undefined') ACHV.event('chapter', this.game);
    // ---- 章节评级（命中率40% + 击杀效率30% + 承伤30%）----
    const g = this.game, p = g.player;
    const acc = g.stats.shots ? g.stats.hits / g.stats.shots : 0.5;
    const kpm = p.kills / (this.m.duration / 60);
    const dmgK = Math.max(0, 1 - g.runStats.damageTaken / 12);
    const score = Math.min(100, Math.round(acc * 40 + Math.min(1, kpm / 12) * 30 + dmgK * 30));
    this.rating = score >= 80 ? 'S' : score >= 65 ? 'A' : score >= 45 ? 'B' : 'C';
    const best = SAVE.data.bestRating || (SAVE.data.bestRating = {});
    if (!best[this.idx] || 'SABC'.indexOf(this.rating) < 'SABC'.indexOf(best[this.idx])) {
      best[this.idx] = this.rating;
    }
    SAVE.commit();
    AUDIO.victory();
    const finish = early ? '（提前清空全场！）' : '';
    STORY.play([{ s: '任务完成', t: `坚守目标达成${finish} · 评级 ${this.rating}` }, ...this.m.outro],
      () => GAME.showVictory(this.idx));
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
