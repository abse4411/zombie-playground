/* ============================================================
 * 成就系统（v8.2 重构）—— 48 项分级成就 + 奖励解锁 + 进度追踪
 * 分级：bronze 铜 → silver 银 → gold 金 → platinum 白金
 * 类别：combat 战斗 / survival 生存 / explore 探索 / story 剧情 / collect 收集
 * ============================================================ */
const ACHIEVEMENTS = [
  /* ---------- 战斗 combat ---------- */
  { id: 'first_blood', cat: 'combat', tier: 'bronze', name: '初次狩猎', desc: '完成第一次击杀', goal: d => [Math.min(d.totalKills, 1), 1] },
  { id: 'killer10',    cat: 'combat', tier: 'bronze', name: '小试牛刀', desc: '累计击杀 10 只感染体', goal: d => [Math.min(d.totalKills, 10), 10] },
  { id: 'killer100',   cat: 'combat', tier: 'bronze', name: '百人斩',   desc: '累计击杀 100 只感染体', goal: d => [Math.min(d.totalKills, 100), 100] },
  { id: 'killer500',   cat: 'combat', tier: 'silver', name: '尸潮收割机', desc: '累计击杀 500 只感染体', goal: d => [Math.min(d.totalKills, 500), 500] },
  { id: 'killer1000',  cat: 'combat', tier: 'gold',   name: '千人斩',   desc: '累计击杀 1,000 只感染体', goal: d => [Math.min(d.totalKills, 1000), 1000] },
  { id: 'killer5000',  cat: 'combat', tier: 'platinum', name: '赤潮清道夫', desc: '累计击杀 5,000 只感染体', goal: d => [Math.min(d.totalKills, 5000), 5000] },
  { id: 'head10',      cat: 'combat', tier: 'bronze', name: '瞄得准',   desc: '累计爆头击杀 10 只', goal: d => [Math.min(d.totalHeadshots || 0, 10), 10] },
  { id: 'head50',      cat: 'combat', tier: 'silver', name: '神枪手',   desc: '累计爆头击杀 50 只', goal: d => [Math.min(d.totalHeadshots || 0, 50), 50] },
  { id: 'head300',     cat: 'combat', tier: 'gold',   name: '爆头艺术家', desc: '累计爆头击杀 300 只', goal: d => [Math.min(d.totalHeadshots || 0, 300), 300] },
  { id: 'streak5',     cat: 'combat', tier: 'bronze', name: '连杀新手', desc: '单局打出 5 连杀', goal: d => [Math.min(d.bestStreak || 0, 5), 5] },
  { id: 'streak10',    cat: 'combat', tier: 'silver', name: '连杀大师', desc: '单局打出 10 连杀', goal: d => [Math.min(d.bestStreak || 0, 10), 10] },
  { id: 'streak20',    cat: 'combat', tier: 'gold',   name: '杀戮旋风', desc: '单局打出 20 连杀', goal: d => [Math.min(d.bestStreak || 0, 20), 20] },
  { id: 'melee10',     cat: 'combat', tier: 'bronze', name: '白刃新手', desc: '单局近战击杀 10 只', goal: d => [Math.min(d.bestMeleeKills || 0, 10), 10] },
  { id: 'melee30',     cat: 'combat', tier: 'silver', name: '电锯艺术家', desc: '单局近战击杀 30 只', goal: d => [Math.min(d.bestMeleeKills || 0, 30), 30] },
  { id: 'fragkill20',  cat: 'combat', tier: 'silver', name: '爆破专家', desc: '累计手雷击杀 20 只', goal: d => [Math.min(d.totalFragKills || 0, 20), 20] },
  { id: 'burn10',      cat: 'combat', tier: 'silver', name: '纵火狂',   desc: '累计烧死 10 只感染体', goal: d => [Math.min(d.totalBurnKills || 0, 10), 10] },

  /* ---------- 生存 survival ---------- */
  { id: 'wave5',       cat: 'survival', tier: 'bronze', name: '站稳脚跟', desc: '狩猎模式抵达第 5 波', goal: d => [Math.min(d.huntBest.wave || 0, 5), 5] },
  { id: 'wave10',      cat: 'survival', tier: 'silver', name: '老练猎人', desc: '狩猎模式抵达第 10 波', goal: d => [Math.min(d.huntBest.wave || 0, 10), 10] },
  { id: 'wave15',      cat: 'survival', tier: 'gold',   name: '波次终结者', desc: '狩猎模式抵达第 15 波', goal: d => [Math.min(d.huntBest.wave || 0, 15), 15] },
  { id: 'wave20',      cat: 'survival', tier: 'platinum', name: '不朽猎手', desc: '狩猎模式抵达第 20 波', goal: d => [Math.min(d.huntBest.wave || 0, 20), 20] },
  { id: 'flawless',    cat: 'survival', tier: 'silver', name: '完美防御', desc: '一整波不受任何伤害', goal: d => [d.flawless ? 1 : 0, 1] },
  { id: 'flawless3',   cat: 'survival', tier: 'gold',   name: '无伤大师', desc: '单局 3 次无伤波次', goal: d => [Math.min(d.bestFlawless || 0, 3), 3] },
  { id: 'lowhp_kill',  cat: 'survival', tier: 'bronze', name: '命悬一线', desc: '生命低于 15% 时完成击杀', goal: d => [d.lowhpKills ? 1 : 0, 1] },
  { id: 'medic10',     cat: 'survival', tier: 'bronze', name: '自救者',   desc: '累计使用 10 个医疗包', goal: d => [Math.min(d.totalMedkits || 0, 10), 10] },
  { id: 'runs20',      cat: 'survival', tier: 'bronze', name: '常客',     desc: '累计出战 20 场', goal: d => [Math.min(d.totalRuns, 20), 20] },
  { id: 'runs100',     cat: 'survival', tier: 'silver', name: '沙场老将', desc: '累计出战 100 场', goal: d => [Math.min(d.totalRuns, 100), 100] },

  /* ---------- 探索 explore ---------- */
  { id: 'visit_all',   cat: 'explore', tier: 'silver', name: '环球猎人', desc: '在全部 9 张地图各完成 1 场', goal: d => [Object.keys(d.mapDone || {}).length, 9] },
  { id: 'crate20',     cat: 'explore', tier: 'bronze', name: '搜刮者',   desc: '累计开启 20 个补给箱', goal: d => [Math.min(d.totalCrates || 0, 20), 20] },
  { id: 'barrel10',    cat: 'explore', tier: 'bronze', name: '拆迁办主任', desc: '累计引爆 10 个爆炸桶', goal: d => [Math.min(d.totalBarrels || 0, 10), 10] },
  { id: 'spinoff_all', cat: 'explore', tier: 'gold',   name: '支线全清', desc: '完成全部 3 个番外章节', goal: d => [Object.keys(d.spinoffsDone || {}).length, 3] },
  { id: 'loot500',     cat: 'explore', tier: 'silver', name: '战场拾荒队', desc: '累计拾取 500 件战利品', goal: d => [Math.min(d.totalLoots || 0, 500), 500] },

  /* ---------- 剧情 story ---------- */
  { id: 'chapter5',    cat: 'story', tier: 'bronze', name: '黎明英雄', desc: '通关第一幕全部 5 章', goal: d => [Math.min(d.missionsDone, 5), 5] },
  { id: 'chapter7',    cat: 'story', tier: 'silver', name: '灯塔熄灭', desc: '通关第一幕 7 章（第一部完）', goal: d => [Math.min(d.missionsDone, 7), 7] },
  { id: 'chapter10',   cat: 'story', tier: 'gold',   name: '赤潮终结', desc: '通关全部 10 章主线', goal: d => [Math.min(d.missionsDone, 10), 10] },
  { id: 'boss1',       cat: 'story', tier: 'bronze', name: '屠魔者',   desc: '击倒任意 Boss', goal: d => [Math.min(d.totalBossKills || 0, 1), 1] },
  { id: 'boss10',      cat: 'story', tier: 'silver', name: 'Boss猎人', desc: '累计击倒 10 个 Boss', goal: d => [Math.min(d.totalBossKills || 0, 10), 10] },
  { id: 'boss_warden', cat: 'story', tier: 'gold',   name: '泵体终结者', desc: '击倒母体泵守护者', goal: d => [d.bossWarden ? 1 : 0, 1] },
  { id: 'rating_s',    cat: 'story', tier: 'silver', name: 'S级行动', desc: '任意章节获得 S 评级', goal: d => [d.bestRating && Object.values(d.bestRating).includes('S') ? 1 : 0, 1] },
  { id: 'rating_all_s', cat: 'story', tier: 'platinum', name: '完美主义者', desc: '全部主线章节获得 S 评级', goal: d => [Object.values(d.bestRating || {}).filter(r => r === 'S').length, 10] },
  { id: 'tutorial',    cat: 'story', tier: 'bronze', name: '训练营毕业', desc: '完成全部新手教学', goal: d => [d.tutorialDone ? 1 : 0, 1] },

  /* ---------- 收集 collect ---------- */
  { id: 'rich',        cat: 'collect', tier: 'bronze', name: '万贯家财', desc: '单局赚取 $10,000', goal: d => [Math.min(d.bestMoneyEarned || 0, 10000), 10000] },
  { id: 'rich50k',     cat: 'collect', tier: 'silver', name: '军火贩子', desc: '累计赚取 $50,000', goal: d => [Math.min(d.totalMoneyEarned || 0, 50000), 50000] },
  { id: 'buy10',       cat: 'collect', tier: 'bronze', name: '军火商常客', desc: '累计购买 10 次商城商品', goal: d => [Math.min(d.totalPurchases || 0, 10), 10] },
  { id: 'perk_max1',   cat: 'collect', tier: 'silver', name: '强化之道', desc: '单局内任意 Perk 升满级', goal: d => [d.perkMaxed ? 1 : 0, 1] },
  { id: 'upgrade3',    cat: 'collect', tier: 'silver', name: '紫色品质', desc: '任意武器强化至 Lv.3', goal: d => [d.weaponLv3 ? 1 : 0, 1] },
  { id: 'skin_all',    cat: 'collect', tier: 'gold',   name: '衣柜指挥官', desc: '解锁全部 4 款成就作战服', goal: d => [Math.min(d.unlockedSkins ? d.unlockedSkins.length - 1 : 0, 4), 4] },
  { id: 'throw_all',   cat: 'collect', tier: 'bronze', name: '扔个不停', desc: '单局投掷 8 个投掷物', goal: d => [Math.min(d.bestThrows || 0, 8), 8] },
];

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
