/* ============================================================
 * 成就引擎（v17.1 从 js/config/achievements.js 拆出）
 * —— v12.1 资源架构重构时该引擎随数据文件一起掉出加载列表，
 *    导致成就在运行时从未解锁（ACHV.event 全部静默跳过）、
 *    图鉴成就页引用 ACHV.progress 直接抛错。此处恢复为正式系统。
 * 成就数据 ACHIEVEMENTS 由 RES.boot 从 assets/data/achievements.json 装配。
 * ============================================================ */

/* 奖励表：达成即解锁（v8.3/v8.4 扩充角色/武器挂点） */
const ACHV_REWARDS = {
  head50:      { skin: 'arctic',   label: '作战服：极地雪-compatible' },
  streak10:    { skin: 'midnight', label: '作战服：午夜行动' },
  rich:        { skin: 'hazard',   label: '作战服：橙色警戒' },
  crate20:     { money: 2000,      label: '酬金 +$2,000（下局开局生效）' },
  boss10:      { money: 5000,      label: '酬金 +$5,000（下局开局生效）' },
};

const ACHV = {
  unlock(id) {
    if (!SAVE.data.achievements) SAVE.data.achievements = [];
    if (SAVE.data.achievements.includes(id)) return;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    SAVE.data.achievements.push(id);
    // 解锁角色检测（v8.3）：成就为解锁条件的新干员
    if (typeof CHARACTERS !== 'undefined') {
      const ch = CHARACTERS.find(c => c.unlockBy === id);
      if (ch) {
        if (!SAVE.data.unlockedChars) SAVE.data.unlockedChars = ['raven', 'nightingale', 'bastion', 'apricot'];
        if (!SAVE.data.unlockedChars.includes(ch.id)) {
          SAVE.data.unlockedChars.push(ch.id);
          HUD.banner('🎖 新干员加入：' + ch.name, ch.prof + ' · ' + (ch.passiveText || ''));
        }
      }
    }
    // 解锁专属强化提示（v8.4 Perk 在商城出现）
    if (typeof PERKS !== 'undefined') {
      const pk = Object.values(PERKS).find(x => x.unlockBy === id);
      if (pk) HUD.banner('🏆 强化解锁：' + pk.name, pk.desc);
    }
    // NERO科技收集（v10.5）：达标自动解锁电击棍
    if (id === 'nero6') { /* 电击棍unlockBy=nero6 由通用武器解锁钩处理 */ }
    // 解锁专属武器检测（v8.4）
    if (typeof WEAPONS !== 'undefined') {
      const w = Object.values(WEAPONS).find(x => x.unlockBy === id);
      if (w) {
        if (!SAVE.data.unlockedWeapons) SAVE.data.unlockedWeapons = [];
        if (!SAVE.data.unlockedWeapons.includes(w.id)) {
          SAVE.data.unlockedWeapons.push(w.id);
          HUD.banner('🎖 专属武器入库：' + w.name, '下局开局自动装备在武器架');
        }
      }
    }
    // 奖励发放（皮肤入 unlockedSkins / 酬金挂账开局发放）
    const rw = ACHV_REWARDS[id];
    if (rw) {
      if (!SAVE.data.unlockedSkins) SAVE.data.unlockedSkins = ['default'];
      if (rw.skin && !SAVE.data.unlockedSkins.includes(rw.skin)) SAVE.data.unlockedSkins.push(rw.skin);
      if (rw.money) SAVE.data.bonusMoney = (SAVE.data.bonusMoney || 0) + rw.money;
      HUD.banner('🏆 成就解锁：' + a.name, '奖励：' + rw.label);
    } else {
      const tierName = { bronze: '铜', silver: '银', gold: '金', platinum: '白金' }[a.tier] || '';
      HUD.toast(`🏆 ${tierName}成就解锁：${a.name}`);
    }
    SAVE.commit();
    AUDIO.streak();
  },

  // 进度读取（图鉴渲染用）
  progress(a) {
    try { return a.goal(SAVE.data); } catch (e) { return [0, 1]; }
  },

  // 游戏事件钩子
  event(type, game, data) {
    const d = SAVE.data;
    const p = game.player;
    switch (type) {
      case 'kill':
        this.unlock('first_blood');
        if (d.totalKills >= 10) this.unlock('killer10');
        if (d.totalKills >= 100) this.unlock('killer100');
        if (d.totalKills >= 500) this.unlock('killer500');
        if (d.totalKills >= 1000) this.unlock('killer1000');
        if (d.totalKills >= 5000) this.unlock('killer5000');
        if ((d.totalHeadshots || 0) >= 10) this.unlock('head10');
        if ((d.totalHeadshots || 0) >= 50) this.unlock('head50');
        if ((d.totalHeadshots || 0) >= 300) this.unlock('head300');
        if ((d.bestStreak || 0) >= 5) this.unlock('streak5');
        if ((d.bestStreak || 0) >= 10) this.unlock('streak10');
        if ((d.bestStreak || 0) >= 20) this.unlock('streak20');
        if ((d.bestMeleeKills || 0) >= 10) this.unlock('melee10');
        if ((d.bestMeleeKills || 0) >= 30) this.unlock('melee30');
        if ((d.totalFragKills || 0) >= 20) this.unlock('fragkill20');
        if ((d.totalBurnKills || 0) >= 10) this.unlock('burn10');
        if (p && p.alive && p.hp <= p.maxHp * 0.15) { d.lowhpKills = 1; this.unlock('lowhp_kill'); }
        break;
      case 'boss':
        d.totalBossKills = (d.totalBossKills || 0) + 1;
        this.unlock('boss1');
        if ((d.totalBossKills || 0) >= 10) this.unlock('boss10');
        if (data === 'pumpWarden') { d.bossWarden = 1; this.unlock('boss_warden'); }
        break;
      case 'wave':
        if (data >= 5) this.unlock('wave5');
        if (data >= 10) this.unlock('wave10');
        if (data >= 15) this.unlock('wave15');
        if (data >= 20) this.unlock('wave20');
        break;
      case 'tutorial':
        this.unlock('tutorial');
        break;
      case 'chapter':
        this.unlock('chapter5');
        if (d.missionsDone >= 7) this.unlock('chapter7');
        if (d.missionsDone >= 10) this.unlock('chapter10');
        break;
      case 'hardWin':
        d.hardWins = (d.hardWins || 0) + 1;
        this.unlock('hard_win1');
        if ((d.hardWins || 0) >= 5) this.unlock('hard_win5');
        break;
      case 'nightmareWin':
        d.nightmareWins = (d.nightmareWins || 0) + 1;
        this.unlock('nightmare1');
        break;
      case 'flawless':
        d.flawless = 1;
        game._flawlessCount = (game._flawlessCount || 0) + 1;
        d.bestFlawless = Math.max(d.bestFlawless || 0, game._flawlessCount);
        this.unlock('flawless');
        if ((d.bestFlawless || 0) >= 3) this.unlock('flawless3');
        break;
      case 'runEnd':
        if (p) {
          d.bestMoneyEarned = Math.max(d.bestMoneyEarned || 0, p.moneyEarned || 0);
          d.totalMoneyEarned = (d.totalMoneyEarned || 0) + (p.moneyEarned || 0);
          d.bestThrows = Math.max(d.bestThrows || 0, game._throwCount || 0);
        }
        d.totalPurchases = (d.totalPurchases || 0) + (game._buyCount || 0);
        if (game._lastMapId && game._lastWin) {
          if (!d.mapDone) d.mapDone = {};
          d.mapDone[game._lastMapId] = 1;
          if (Object.keys(d.mapDone).length >= Object.keys(MAPS).length) this.unlock('visit_all');
        }
        if (Object.keys(d.spinoffsDone || {}).length >= 3) this.unlock('spinoff_all');
        if (d.bestRating && Object.values(d.bestRating).includes('S')) this.unlock('rating_s');
        if (Object.values(d.bestRating || {}).filter(r => r === 'S').length >= 10) this.unlock('rating_all_s');
        if (d.perkMaxed) this.unlock('perk_max1');
        if (d.weaponLv3) this.unlock('upgrade3');
        break;
    }
  },
};
