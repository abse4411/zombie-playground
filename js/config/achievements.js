/* ============================================================
 * 成就系统 —— 12 项成就 + 解锁检测
 * ============================================================ */
const ACHIEVEMENTS = [
  { id: 'first_blood', name: '初次狩猎', desc: '完成第一次击杀' },
  { id: 'killer100',   name: '百人斩',   desc: '累计击杀 100 只感染体' },
  { id: 'killer1000',  name: '千人斩',   desc: '累计击杀 1000 只感染体' },
  { id: 'head50',      name: '神枪手',   desc: '累计爆头击杀 50 只' },
  { id: 'streak10',    name: '连杀大师', desc: '单局打出 10 连杀' },
  { id: 'wave10',      name: '老练猎人', desc: '狩猎模式抵达第 10 波' },
  { id: 'boss1',       name: '屠魔者',   desc: '击倒暴君 Ω' },
  { id: 'melee10',     name: '白刃 Expert', desc: '单局近战击杀 10 只' },
  { id: 'rich',        name: '万贯家财', desc: '单局赚取 $10,000' },
  { id: 'tutorial',    name: '训练营毕业', desc: '完成全部新手教学' },
  { id: 'chapter5',    name: '黎明英雄', desc: '通关全部 5 章剧情' },
  { id: 'flawless',    name: '完美防御', desc: '一整波不受任何伤害' },
];

const ACHV = {
  unlock(id) {
    if (!SAVE.data.achievements) SAVE.data.achievements = [];
    if (SAVE.data.achievements.includes(id)) return;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    SAVE.data.achievements.push(id);
    SAVE.commit();
    HUD.toast(`🏆 成就解锁：${a.name}`);
    AUDIO.streak();
  },

  // 游戏事件钩子
  event(type, game, data) {
    const d = SAVE.data;
    const p = game.player;
    switch (type) {
      case 'kill':
        this.unlock('first_blood');
        if (d.totalKills >= 100) this.unlock('killer100');
        if (d.totalKills >= 1000) this.unlock('killer1000');
        if (p.headshots >= 50) this.unlock('head50');
        if (game.killStreak >= 10) this.unlock('streak10');
        if (p.moneyEarned >= 10000) this.unlock('rich');
        if (data === 'melee') {
          this._meleeCount = (this._meleeCount || 0) + 1;
          if (this._meleeCount >= 10) this.unlock('melee10');
        }
        break;
      case 'boss':
        this.unlock('boss1');
        break;
      case 'wave':
        if (data >= 10) this.unlock('wave10');
        break;
      case 'tutorial':
        this.unlock('tutorial');
        break;
      case 'chapter':
        const mainTotal = MISSIONS.filter(m => !m.spinoff).length;
        if (d.missionsDone >= mainTotal) this.unlock('chapter5');
        break;
      case 'flawless':
        this.unlock('flawless');
        break;
    }
  },
};
