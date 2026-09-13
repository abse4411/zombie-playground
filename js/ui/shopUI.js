/* ============================================================
 * 商店界面
 * ============================================================ */
const SHOPUI = {
  isOpen: false, game: null, tab: 'primary', els: {},

  init() {
    const $ = id => document.getElementById(id);
    this.els = { shop: $('shop'), money: $('shop-money'), tabs: $('shop-tabs'), items: $('shop-items'), close: $('shop-close') };
    // 生成页签
    for (const t of SHOP.tabs) {
      const b = document.createElement('button');
      b.className = 'shop-tab';
      b.textContent = t.name;
      b.dataset.tab = t.id;
      b.addEventListener('click', () => { this.tab = t.id; AUDIO.uiClick(); this.render(); });
      this.els.tabs.appendChild(b);
    }
    this.els.close.addEventListener('click', () => this.close());
    // 3D 预览渲染器（v7.4）
    GUNPREVIEW.init(document.getElementById('gun-preview'), document.getElementById('gp-name'));
  },

  open(game) {
    this.game = game;
    this.isOpen = true;
    AUDIO.init(); AUDIO.resume();
    INPUT.releaseLock();
    this.els.shop.classList.remove('hidden');
    this.render();
  },

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.els.shop.classList.add('hidden');
    if (GAME && GAME.state === 'playing') GAME.requestLock();
  },

  render() {
    if (!this.game) return;
    const p = this.game.player;
    this.els.money.textContent = fmtMoney(p.money);
    for (const b of this.els.tabs.children) b.classList.toggle('active', b.dataset.tab === this.tab);
    const items = SHOP.stock(this.game, this.tab);
    this.els.items.innerHTML = '';
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'shop-item';

      const h4 = document.createElement('h4');
      h4.innerHTML = `<span>${item.name}</span><span class="si-price">${item.state === 'maxed' ? '已满级' : item.state === 'owned' ? '已持有' : item.state === 'locked' ? '需强化' : fmtMoney(item.price)}</span>`;
      card.appendChild(h4);

      const desc = document.createElement('div');
      desc.className = 'si-desc';
      desc.textContent = item.desc;
      card.appendChild(desc);

      const stats = document.createElement('div');
      stats.className = 'si-stats';
      for (const [k, v] of item.stats) {
        const s = document.createElement('span');
        s.innerHTML = `${k} <b>${v}</b>`;
        stats.appendChild(s);
      }
      card.appendChild(stats);

      // 升级工作台（v11.10）：每武器一张聚合卡，逐行升级按钮
      if (item.kind === 'upbench') {
        const box = document.createElement('div');
        box.className = 'si-lines';
        for (const L of item.lines) {
          const row = document.createElement('div');
          row.className = 'si-line';
          const dots = '●'.repeat(L.lv) + '<i>' + '○'.repeat(L.max - L.lv) + '</i>';
          row.innerHTML = `<div class="si-line-top"><span class="si-line-name">${L.name}</span>
            <span class="si-line-dots${L.maxed ? ' maxed' : ''}">${dots}</span></div>
            <div class="si-line-desc"><b>${L.gain}</b>｜${L.drawback ? `<span class="si-drawback">代价：${L.drawback}</span>` : '<span class="si-nodraw">无副作用</span>'}</div>`;
          const lbtn = document.createElement('button');
          if (L.maxed) {
            lbtn.textContent = '已满级';
            lbtn.className = 'si-line-btn maxed';
            lbtn.disabled = true;
          } else {
            lbtn.textContent = `升级 ${fmtMoney(L.price)}`;
            lbtn.className = 'si-line-btn';
            if (p.money < L.price) lbtn.classList.add('poor');
            lbtn.addEventListener('click', () => {
              if (SHOP.buy(this.game, { kind: 'weaponUp', def: item.def, upId: L.upId, price: L.price, state: 'buy' })) {
                AUDIO.uiClick(); this.render(); HUD.update(this.game);
              }
            });
          }
          row.querySelector('.si-line-top').appendChild(lbtn);   // 按钮放进首行右侧（v18.3 防竖排挤压）
          // 升级预览（v18.4）：悬浮/点击升级项 → 面板只显示受影响的属性变化
          const showPreview = (e) => {
            if (e && e.target && e.target.closest && e.target.closest('button')) return;   // 按钮点击走购买
            this.renderWPreview(item.inst, L.upId, L.name);
          };
          row.addEventListener('mouseenter', () => this.renderWPreview(item.inst, L.upId, L.name));
          row.addEventListener('click', showPreview);
          box.appendChild(row);
        }
        card.appendChild(box);
        this.els.items.appendChild(card);
        // 属性面板联动（v18.3）：点卡片=展示模型+属性变化；移出卡片=恢复当前属性
        const showBench = () => {
          GUNPREVIEW.show(item.def, item.name);
          this.renderWStats(item.inst);
        };
        card.addEventListener('click', showBench);
        card.addEventListener('mouseenter', showBench);
        card.addEventListener('mouseleave', () => this.renderWStats(item.inst));
        continue;
      }

      const btn = document.createElement('button');
      btn.className = 'si-btn';
      if (item.state === 'buy') {
        btn.textContent = `购买 ${fmtMoney(item.price)}`;
        if (p.money < item.price) btn.classList.add('poor');
        btn.addEventListener('click', () => {
          if (SHOP.buy(this.game, item)) { this.render(); HUD.update(this.game); }
        });
      } else if (item.state === 'ammo') {
        btn.textContent = `补满弹药 ${fmtMoney(item.price)}`;
        btn.classList.add('owned');
        if (p.money < item.price) btn.classList.add('poor');
        btn.addEventListener('click', () => {
          if (SHOP.buy(this.game, item)) { this.render(); HUD.update(this.game); }
        });
      } else if (item.state === 'owned') {
        btn.textContent = '已持有 · 状态良好';
        btn.classList.add('owned');
      } else if (item.state === 'maxed') {
        btn.textContent = '已满级';
        btn.classList.add('maxed');
      } else {
        btn.textContent = '需要先购买强化';
        btn.classList.add('maxed');
      }
      card.appendChild(btn);
      // 3D 预览（v7.4）+ 属性面板（v18.3）：悬停/点击卡片展示武器模型与属性变化
      if (item.def || item.id === 'frag' || item.id === 'molotov') {
        const prevDef = item.def || THROWABLES[item.id];
        const showIt = () => {
          GUNPREVIEW.show(prevDef, item.name);
          this.renderWStats(item.inst || null);
        };
        card.addEventListener('mouseenter', showIt);
        card.addEventListener('click', showIt);
      }
      this.els.items.appendChild(card);
    }
    // 默认展示第一个含模型的商品
    const first = items.find(i => i.def || i.id === 'frag' || i.id === 'molotov');
    if (first) {
      GUNPREVIEW.show(first.def || THROWABLES[first.id], first.name);
      this.renderWStats(first.inst || null);
    }
  },

  /* 武器属性面板（v18.3）：武器模型旁显示 基础 → 升级后当前值 */
  renderWStats(inst) {
    const el = document.getElementById('gp-stats');
    if (!el) return;
    if (!inst || typeof weaponStatRows !== 'function') { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const rows = weaponStatRows(inst);
    const changed = rows.some(r => r.better !== 0);
    el.classList.remove('hidden');
    el.innerHTML = `<div class="wst-head">属性面板${changed ? ' · <i>基础 → 当前</i>' : ' · <i>全部基础值</i>'}</div>` +
      `<div class="wst-grid">` + rows.map(r => {
        const arrow = r.better > 0 ? '↑' : r.better < 0 ? '↓' : '＝';
        const cls = r.better > 0 ? 'up' : r.better < 0 ? 'down' : 'same';
        const cur = r.better === 0 ? `<b>${r.base}</b>` : `<b>${r.cur}</b> <i class="${cls}">${arrow}</i>`;
        return `<div class="wst-row"><span class="wst-k">${r.k}</span><span class="wst-v"><i class="wst-base">${r.base}</i>→ ${cur}</span></div>`;
      }).join('') + `</div>`;
  },

  /* 升级预览（v18.4）：悬浮/点击升级项 → 只显示该级会变化的属性 */
  renderWPreview(inst, upId, lineName) {
    const el = document.getElementById('gp-stats');
    if (!el || !inst) return;
    if (typeof weaponPreviewRows !== 'function') return;
    const rows = weaponPreviewRows(inst, upId);
    el.classList.remove('hidden');
    el.innerHTML = `<div class="wst-head">升级预览 · <i>${lineName}</i>（下一级）</div>` +
      (rows.length
        ? `<div class="wst-grid">` + rows.map(r => {
          const arrow = r.better > 0 ? '↑' : r.better < 0 ? '↓' : '＝';
          const cls = r.better > 0 ? 'up' : r.better < 0 ? 'down' : 'same';
          return `<div class="wst-row"><span class="wst-k">${r.k}</span><span class="wst-v"><i class="wst-base">${r.cur}</i>→ <b>${r.next}</b> <i class="${cls}">${arrow}</i></span></div>`;
        }).join('') + `</div>`
        : `<div class="wst-head">该升级不影响面板数值</div>`);
  },
};
