/* ============================================================
 * 背包面板（v4.7）—— Tab 打开：消耗品 / 武器架 / 战斗统计
 * ============================================================ */
const BACKPACK = {
  isOpen: false, game: null, els: {},

  init() {
    const $ = id => document.getElementById(id);
    this.els = {
      panel: $('backpack'), close: $('bp-close'),
      meds: $('bp-meds'), frags: $('bp-frags'), molos: $('bp-molos'),
      cash: $('bp-cash'), weapons: $('bp-weapons'), stats: $('bp-stats'),
    };
    this.els.close.addEventListener('click', () => this.close());
  },

  toggle(game) { this.isOpen ? this.close() : this.open(game); },

  open(game) {
    this.game = game;
    this.isOpen = true;
    AUDIO.init(); AUDIO.resume();
    INPUT.releaseLock();
    this.els.panel.classList.remove('hidden');
    this.render();
  },

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.els.panel.classList.add('hidden');
    if (GAME && GAME.state === 'playing' && !SHOPUI.isOpen && !STORY.active) GAME.requestLock();
  },

  render() {
    const g = this.game, p = g.player;
    if (!p) return;
    const T = INPUT.touch;
    this.els.meds.textContent = `${p.medkits} / ${GAMECONFIG.inventory.medkitMax}`;
    this.els.frags.textContent = `${p.throwables.frag.count} / ${THROWABLES.frag.max}`;
    this.els.molos.textContent = `${p.throwables.molotov.count} / ${THROWABLES.molotov.max}`;
    this.els.cash.textContent = fmtMoney(p.money);
    // 武器架
    this.els.weapons.innerHTML = '';
    for (const slot of ['primary', 'secondary', 'melee']) {
      const label = slot === 'primary' ? '主武器' : slot === 'secondary' ? '副武器' : '近战';
      for (const inst of p.rack[slot]) {
        const row = document.createElement('div');
        row.className = 'bp-w' + (p.weapons[slot] === inst ? ' equipped' : '');
        row.innerHTML = `<span class="bp-slot">${label}</span><b>${inst.def.name}${inst.lvl ? ` Lv.${inst.lvl}` : ''}</b>
          <span class="bp-ammo">${inst.def.melee ? '∞' : `${inst.mag}/${inst.reserve}`}</span>`;
        const btn = document.createElement('button');
        btn.textContent = p.weapons[slot] === inst ? '手持中' : '装备';
        btn.disabled = p.weapons[slot] === inst;
        btn.addEventListener('click', () => {
          g.weapons._equip(slot, inst);
          this.render();
        });
        row.appendChild(btn);
        this.els.weapons.appendChild(row);
      }
    }
    // 统计
    this.els.stats.innerHTML = `
      <span>击杀 <b>${p.kills}</b></span><span>爆头 <b>${p.headshots}</b></span>
      <span>命中率 <b>${g.stats.shots ? Math.round(g.stats.hits / g.stats.shots * 100) : 0}%</b></span>
      <span>本局赚取 <b>${fmtMoney(p.moneyEarned)}</b></span>`;
  },
};
