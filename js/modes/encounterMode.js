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
    AUDIO.victory();
    const finish = early ? '（提前清空全场！）' : '';
    STORY.play([{ s: '任务完成', t: `坚守目标达成${finish}` }, ...this.m.outro],
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
    return [
      ['任务结果', outcome, outcome === '任务失败' ? 'red' : 'gold'],
      ['总击杀', `${p.kills}`, 'red'],
      ['爆头击杀', `${p.headshots}`, ''],
      ['命中率', g.stats.shots ? Math.round(g.stats.hits / g.stats.shots * 100) + '%' : '—', ''],
      ['剩余时间', fmtTime(this.m.duration - this.elapsed), ''],
      ['赚取资金', fmtMoney(p.moneyEarned), 'gold'],
    ];
  }
}
