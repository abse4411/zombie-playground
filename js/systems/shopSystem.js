/* ============================================================
 * 商城系统 —— 库存构建与购买逻辑
 * ============================================================ */
const SHOP = {
  tabs: [
    { id: 'primary', name: '🔫 主武器' },
    { id: 'secondary', name: '🔫 副武器' },
    { id: 'melee', name: '🔪 近战' },
    { id: 'throw', name: '💣 投掷物' },
    { id: 'perk', name: '💉 强化' },
    { id: 'supply', name: '🩹 补给' },
  ],

  stock(game, tabId) {
    const p = game.player;
    const items = [];

    if (tabId === 'primary' || tabId === 'secondary' || tabId === 'melee') {
      for (const id in WEAPONS) {
        const w = WEAPONS[id];
        if (w.slot !== tabId) continue;
        const rackInst = p.rack[tabId].find(r => r.def.id === id);
        const owned = !!rackInst;
        const equipped = p.weapons[tabId] && p.weapons[tabId].def.id === id;
        const inst = equipped ? p.weapons[tabId] : rackInst;
        // 近战无弹药概念：永不显示"补充弹药"
        const fullAmmo = w.melee || (inst && inst.mag >= inst.magSize && inst.reserve >= Math.floor(w.reserve * p.reserveMult));
        const needAmmo = owned && !w.melee && !fullAmmo;
        items.push({
          kind: 'weapon', id, def: w,
          name: w.name,
          desc: w.desc,
          price: owned ? (w.melee ? 0 : GAMECONFIG.economy.ammoPrice) : w.price,
          owned, state: owned ? (needAmmo ? 'ammo' : 'owned') : 'buy',
          lvl: inst ? inst.lvl : 0,
          stats: w.melee
            ? [['伤害', Math.round(w.damage * (inst ? inst.dmgMult : 1))], ['攻速', Math.round(w.rpm / 10) + ''], ['范围', w.range.toFixed(1) + 'm']]
            : [['伤害', Math.round(w.damage * (inst ? inst.dmgMult : 1)) * (w.pellets || 1)], ['射速', w.rpm], ['弹匣', inst ? inst.magSize : w.mag]],
        });
        // 武器强化（已持有且未满级）
        if (owned && inst && inst.lvl < 3) {
          const upPrice = Math.round((w.price > 0 ? w.price * 0.5 : 500) * (inst.lvl + 1));
          items.push({
            kind: 'weaponUp', id: id + '_up', def: w,
            name: `⚙ ${w.name} 强化 Lv.${inst.lvl + 1}`,
            desc: '伤害 +15%、弹匣 +20%。品质提升：白 → 绿 → 蓝 → 紫。',
            price: upPrice, state: 'buy',
            stats: [['伤害', `+15%`], ['弹匣', `+20%`], ['品质', ['白', '绿', '蓝', '紫'][inst.lvl + 1]]],
          });
        }
      }
    } else if (tabId === 'throw') {
      for (const id in THROWABLES) {
        const t = THROWABLES[id];
        const cur = p.throwables[id];
        items.push({
          kind: 'throw', id,
          name: `${t.name} ×${t.pack}`,
          desc: t.desc,
          price: t.price,
          state: cur.count >= t.max ? 'maxed' : 'buy',
          stats: t.damage
            ? [['爆炸', t.damage], ['半径', t.radius + 'm'], ['持有', `${cur.count}/${t.max}`]]
            : [['灼烧', t.dps + '/s'], ['时长', t.duration + 's'], ['持有', `${cur.count}/${t.max}`]],
        });
      }
    } else if (tabId === 'perk') {
      for (const id in PERKS) {
        const k = PERKS[id];
        const tier = p.perks[id] || 0;   // 旧存档可能缺新Perk键
        if (tier >= k.tiers.length) {
          items.push({ kind: 'perk', id, name: `${k.icon} ${k.name} MAX`, desc: k.desc, price: 0, state: 'maxed', stats: [['等级', 'MAX']] });
        } else {
          const t = k.tiers[tier];
          items.push({
            kind: 'perk', id,
            name: `${k.icon} ${k.name} Lv.${tier + 1}`,
            desc: k.desc, price: t.price, state: 'buy',
            stats: [['效果', k.valName(t.val)], ['等级', `${tier + 1}/${k.tiers.length}`]],
          });
        }
      }
    } else if (tabId === 'supply') {
      const E = GAMECONFIG.economy;
      items.push({
        kind: 'heal', id: 'heal', name: '🩹 战地急救', desc: '立即恢复全部生命值。',
        price: E.healPrice, state: p.hp >= p.maxHp ? 'maxed' : 'buy',
        stats: [['生命', `${Math.ceil(p.hp)}/${p.maxHp}`]],
      });
      items.push({
        kind: 'ammoAll', id: 'ammoAll', name: '📦 全弹药补给', desc: '补满主武器与副武器的全部备弹。',
        price: Math.round(E.ammoPrice * 0.8), state: 'buy',
        stats: [['覆盖', '主武器 + 副武器']],
      });
      items.push({
        kind: 'armorFix', id: 'armorFix', name: '🛡 护甲修复', desc: '修复护甲至上限。需先购买“装甲板甲”强化。',
        price: E.armorPrice,
        state: p.maxArmor <= 0 ? 'locked' : (p.armor >= p.maxArmor ? 'maxed' : 'buy'),
        stats: [['护甲', `${Math.round(p.armor)}/${p.maxArmor}`]],
      });
    }
    return items;
  },

  buy(game, item) {
    const p = game.player;
    if (item.state === 'maxed' || item.state === 'locked' || item.state === 'owned') {
      if (item.state !== 'owned') AUDIO.denied();
      return false;
    }
    if (p.money < item.price) { AUDIO.denied(); HUD.toast('资金不足！'); return false; }

    switch (item.kind) {
      case 'weapon': {
        const slot = item.def.slot;
        if (item.owned) {
          // 已拥有：补满该把武器弹药（无论是否在手中）
          const inst = p.rack[slot].find(r => r.def.id === item.id);
          inst.reserve = Math.floor(inst.def.reserve * p.reserveMult);
          inst.mag = inst.magSize;
          if (p.weapons[slot] === inst && game.weapons) game.weapons.reloadT = 0;
        } else {
          // 新武器：入武器架并自动装备（旧武器保留，1/2/3循环或Q切换）
          const inst = new WeaponInstance(item.def);
          inst.reserve = Math.floor(item.def.reserve * p.reserveMult);
          p.rack[slot].push(inst);
          p.weapons[slot] = inst;
          p.current = slot;
          if (game.weapons) game.weapons._buildViewmodel();
        }
        break;
      }
      case 'weaponUp': {
        // 强化对应武器架中的实例（无论是否在手中）
        const inst = p.rack[item.def.slot].find(r => r.def.id === item.def.id);
        if (inst && inst.lvl < 3) inst.lvl++;
        break;
      }
      case 'throw': {
        const t = THROWABLES[item.id];
        p.throwables[item.id].count = Math.min(t.max, p.throwables[item.id].count + t.pack);
        break;
      }
      case 'perk': {
        const oldMax = p.maxHp;
        p.perks[item.id]++;
        p.recomputePerks();
        if (item.id === 'hp') p.hp += p.maxHp - oldMax;
        if (item.id === 'armor') p.armor = p.maxArmor;
        break;
      }
      case 'heal': p.hp = p.maxHp; break;
      case 'ammoAll':
        for (const s of ['primary', 'secondary']) {
          const w = p.weapons[s];
          if (w) { w.reserve = Math.floor(w.def.reserve * p.reserveMult); w.mag = w.def.mag; }
        }
        break;
      case 'armorFix': p.armor = p.maxArmor; break;
    }
    p.money -= item.price;
    AUDIO.purchase();
    return true;
  },
};
