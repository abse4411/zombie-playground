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
      cash: $('bp-cash'), stats: $('bp-stats'),
      equip: $('bp-equip'), storage: $('bp-storage'), cap: $('bp-cap'),
      support: $('bp-support'), items: $('bp-items'),
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
    // 装备栏（v9.3）：槽数=角色配置+商城扩容（v18.1），点击卸下入背包
    this.els.equip.innerHTML = '';
    const SLOT_NAMES = { primary: '主武器', secondary: '副武器', melee: '近战' };
    for (const slot of ['primary', 'secondary', 'melee']) {
      for (let i = 0; i < (p.slotMax ? (p.slotMax[slot] || 2) : 2); i++) {
        const inst = p.rack[slot][i];
        const row = document.createElement('div');
        if (!inst) {
          row.className = 'bp-w bp-empty-slot equip-slot';
          row.innerHTML = `<span class="bp-slot">${SLOT_NAMES[slot]}${i + 1}</span><b>— 空位 —</b>`;
          this.els.equip.appendChild(row);
          continue;
        }
        const equipped = p.weapons[slot] === inst;
        row.className = 'bp-w equip-slot' + (equipped ? ' equipped' : '');
        row.innerHTML = `<span class="bp-slot">${SLOT_NAMES[slot]}${i + 1}</span><b>${inst.mastery ? '<i class="bp-star">★</i> ' : ''}${inst.def.name}${inst.mastery ? ' 精通' : inst.tierLevel ? ` · 强化${inst.tierLevel}` : ''}</b>
          <span class="bp-ammo">${inst.def.melee ? '∞' : `${inst.mag}/${inst.reserve}`}</span>`;
        const btn = document.createElement('button');
        if (equipped) {
          btn.textContent = p.rack[slot].length > 1 ? '卸下' : '手持中';
          btn.disabled = p.rack[slot].length <= 1;
          btn.addEventListener('click', () => {
            if (p.unequipToStorage(slot, inst)) { AUDIO.uiClick(); if (g.weapons) g.weapons._buildViewmodel(); this.render(); }
            else HUD.toast('⚠ 背包已满，无法卸下');
          });
        } else {
          btn.textContent = '装备';
          btn.addEventListener('click', () => { g.weapons._equip(slot, inst); this.render(); });
        }
        // v25.1：排序按钮（▲▼ 调整该槽内的切换顺序）+ 出售
        if (p.rack[slot].length > 1) {
          const mkMove = (label, delta, dis) => {
            const mb = document.createElement('button');
            mb.className = 'bp-sort';
            mb.textContent = label;
            mb.disabled = dis;
            mb.title = '调整切换顺序';
            mb.addEventListener('click', () => {
              const j = i + delta;
              if (j < 0 || j >= p.rack[slot].length) return;
              const tmp = p.rack[slot][i]; p.rack[slot][i] = p.rack[slot][j]; p.rack[slot][j] = tmp;
              AUDIO.uiClick(); this.render();
            });
            row.appendChild(mb);
          };
          mkMove('▲', -1, i === 0);
          mkMove('▼', +1, i >= p.rack[slot].length - 1);
          const sellB = document.createElement('button');
          sellB.className = 'bp-sell';
          sellB.textContent = '出售';
          sellB.title = '出售回收（上限原价50%）';
          sellB.addEventListener('click', () => {
            if (SHOP.sell(g, 'weapon', inst.def.id)) { AUDIO.uiClick(); if (g.weapons) g.weapons._buildViewmodel(); this.render(); }
          });
          row.appendChild(sellB);
        }
        row.appendChild(btn);
        this.els.equip.appendChild(row);
      }
    }
    // 背包仓库（v9.3）：容量制，点击装备（交换）
    this.els.cap.textContent = `${p.storage.length}/${p.storageMax}`;
    this.els.cap.classList.toggle('bp-cap-full', p.storage.length >= p.storageMax);
    this.els.storage.innerHTML = '';
    if (!p.storage.length) {
      const empty = document.createElement('div');
      empty.className = 'bp-w bp-empty-slot in-storage';
      empty.innerHTML = `<span class="bp-slot">空</span><b>背包空空如也——商城购买的备用武器与稀有掉落会存放在这里</b>`;
      this.els.storage.appendChild(empty);
    }
    p.storage.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = 'bp-w in-storage';
      if (entry.kind === 'weapon') {
        const inst = entry.inst;
        row.innerHTML = `<span class="bp-slot">${SLOT_NAMES[inst.def.slot]}</span><b>${inst.def.name}${inst.lvl ? ` Lv.${inst.lvl}` : ''}</b>
          <span class="bp-ammo">${inst.def.melee ? '∞' : `${inst.mag}/${inst.reserve}`}</span>`;
        const btn = document.createElement('button');
        btn.textContent = '装备';
        btn.addEventListener('click', () => {
          const res = p.equipFromStorage(inst.def.slot, inst);
          if (res === 'equipped') HUD.toast(`✔ 已装备 ${inst.def.name}`);
          else if (res === 'swapped') HUD.toast(`🔄 已换装 ${inst.def.name}（原武器入背包）`);
          else HUD.toast('⚠ 换装失败：背包已满');
          if (res) { AUDIO.uiClick(); if (g.weapons) g.weapons._buildViewmodel(); this.render(); }
        });
        const btnDrop = document.createElement('button');
        btnDrop.textContent = '丢弃';
        btnDrop.addEventListener('click', () => {
          if (typeof GAME !== 'undefined' && GAME.dropStorageEntry) {
            GAME.dropStorageEntry(idx);
            AUDIO.uiClick();
            this.render();
          }
        });
        row.appendChild(btn);
        row.appendChild(btnDrop);
      } else {
        row.innerHTML = `<span class="bp-slot">物资</span><b>${entry.name}</b><span class="bp-ammo">×${entry.count}</span>`;
        const btnDrop = document.createElement('button');
        btnDrop.textContent = '丢弃';
        btnDrop.addEventListener('click', () => {
          if (typeof GAME !== 'undefined' && GAME.dropStorageEntry) {
            GAME.dropStorageEntry(idx);
            AUDIO.uiClick();
            this.render();
          }
        });
        row.appendChild(btnDrop);
      }
      this.els.storage.appendChild(row);
    });
    // 道具栏（v18.1）：护甲板/弹药袋/肾上腺素，点击使用
    this.els.items.innerHTML = '';
    if (typeof GAMECONFIG !== 'undefined' && GAMECONFIG.items) {
      for (const id in GAMECONFIG.items) {
        if (id === 'medkit') continue;   // 医疗包在消耗品行展示
        const it = GAMECONFIG.items[id];
        const n = p.itemCount(id);
        const row = document.createElement('div');
        row.className = 'bp-w in-storage';
        row.innerHTML = `<span class="bp-slot">${it.icon}</span><b>${it.name}</b>
          <span class="bp-ammo">×${n}</span>`;
        row.title = it.desc;
        const btn = document.createElement('button');
        btn.textContent = '使用';
        btn.disabled = n <= 0;
        btn.addEventListener('click', () => {
          if (p.useItem(id)) { AUDIO.uiClick(); this.render(); }
        });
        row.appendChild(btn);
        this.els.items.appendChild(row);
      }
    }
    // 支援道具（v16.3）：点击使用（与投掷物按键即抛区分）
    this.els.support.innerHTML = '';
    if (typeof GAMECONFIG !== 'undefined' && GAMECONFIG.supports) {
      for (const id in GAMECONFIG.supports) {
        const S = GAMECONFIG.supports[id];
        const n = (p.supports && p.supports[id]) || 0;
        const row = document.createElement('div');
        row.className = 'bp-w in-storage';
        row.innerHTML = `<span class="bp-slot">${S.icon}</span><b>${S.name}</b>
          <span class="bp-ammo">×${n}</span>`;
        row.title = S.desc;
        const btn = document.createElement('button');
        btn.textContent = '使用';
        btn.disabled = n <= 0;
        btn.addEventListener('click', () => {
          if (SUPPORTFX.use(id, g)) {
            AUDIO.uiClick();
            HUD.toast(`${S.icon} ${S.name} 已启用！`);
            this.render();
          }
        });
        row.appendChild(btn);
        this.els.support.appendChild(row);
      }
    }
    // 统计
    this.els.stats.innerHTML = `
      <span>击杀 <b>${p.kills}</b></span><span>爆头 <b>${p.headshots}</b></span>
      <span>命中率 <b>${g.stats.shots ? Math.round(g.stats.hits / g.stats.shots * 100) : 0}%</b></span>
      <span>本局赚取 <b>${fmtMoney(p.moneyEarned)}</b></span>`;
  },
};
