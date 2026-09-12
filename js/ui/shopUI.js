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
      // 3D 预览（v7.4）：悬停/点击卡片展示武器模型
      if (item.def || item.id === 'frag' || item.id === 'molotov') {
        const prevDef = item.def || THROWABLES[item.id];
        const showIt = () => GUNPREVIEW.show(prevDef, item.name);
        card.addEventListener('mouseenter', showIt);
        card.addEventListener('click', showIt);
      }
      this.els.items.appendChild(card);
    }
    // 默认展示第一个含模型的商品
    const first = items.find(i => i.def || i.id === 'frag' || i.id === 'molotov');
    if (first) GUNPREVIEW.show(first.def || THROWABLES[first.id], first.name);
  },
};
