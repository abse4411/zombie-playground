/* ============================================================
 * 商城系统 —— 库存构建与购买逻辑
 * ============================================================ */
const SHOP = {
  tabs: [
    { id: 'primary', name: '🔫 主武器' },
    { id: 'secondary', name: '🔫 副武器' },
    { id: 'melee', name: '🔪 近战' },
    { id: 'throw', name: '💣 投掷物' },
    { id: 'upgrade', name: '🔧 升级台' },
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
        if (w.unlockBy) continue;   // 成就专属武器不入商城（v8.4）
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
          upSum: inst ? inst.tierLevel : 0,
          stats: w.melee
            ? [['伤害', Math.round(w.damage * (inst ? inst.dmgMult : 1))], ['攻速', Math.round(w.rpm / 10) + ''], ['范围', w.range.toFixed(1) + 'm']]
            : [['伤害', Math.round(w.damage * (inst ? inst.dmgMult : 1)) * (w.pellets || 1)], ['射速', w.rpm], ['弹匣', inst ? inst.magSize : w.mag]],
        });
      }
    } else if (tabId === 'upgrade') {
      // 升级工作台（v11.10）：每把已拥有武器一张聚合卡，逐行升级
      for (const slot of ['primary', 'secondary', 'melee']) {
        for (const inst of p.rack[slot]) {
          if (!inst || !inst.def) continue;
          const lines = [];
          for (const upId in W_UPGRADES) {
            const U = W_UPGRADES[upId];
            const lv = (inst.upgrades && inst.upgrades[upId]) || 0;
            const maxed = lv >= U.max;
            lines.push({
              upId, name: U.name, lv, max: U.max, gain: U.gain, drawback: U.drawback,
              maxed, price: maxed ? 0 : U.price(inst.def.price, lv),
            });
          }
          items.push({
            kind: 'upbench', id: 'bench_' + inst.def.id, def: inst.def, slot,
            name: `${inst.def.name}${inst.tierLevel ? ` · 强化${inst.tierLevel}级` : ''}`,
            desc: inst.def.desc,
            price: 0, state: 'bench', lines,
            stats: inst.def.melee
              ? [['伤害', Math.round(inst.def.damage * inst.dmgMult)], ['范围', (inst.def.range + ((inst.upgrades && inst.upgrades.rng) || 0) * 0.25).toFixed(1) + 'm']]
              : [['伤害', Math.round(inst.def.damage * inst.dmgMult) * (inst.def.pellets || 1)], ['弹匣', inst.magSize], ['换弹', (inst.def.reloadTime * inst.reloadTimeMult).toFixed(1) + 's']],
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
        if (k.unlockBy && !(SAVE.data.achievements || []).includes(k.unlockBy)) continue;   // 成就专属Perk未解锁不显示
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
      // 背包扩容（v9.4）：6→9→12
      const BAG_TIERS = [{ cap: 9, price: 2200 }, { cap: 12, price: 4800 }];
      const nextBag = BAG_TIERS.find(t => t.cap > p.storageMax);
      if (nextBag) {
        items.push({
          kind: 'bagUp', id: 'bagUp', name: '🎒 战术背包扩容', desc: `背包容量 ${p.storageMax} → ${nextBag.cap} 格。可存放更多武器与物资。`,
          price: nextBag.price, state: 'buy',
          stats: [['容量', `${p.storageMax} → ${nextBag.cap}`], ['当前', `${p.storage.length}/${p.storageMax}`]],
        });
      } else {
        items.push({
          kind: 'bagUp', id: 'bagUp', name: '🎒 战术背包 · 已满级', desc: '背包已扩容至 12 格上限。',
          price: 0, state: 'maxed', stats: [['容量', '12']],
        });
      }
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
          inst.reserve = Math.min(Math.floor(inst.def.reserve * p.reserveMult * (inst.reserveMaxMult || 1) * 1.2), inst.reserve + Math.floor(inst.def.reserve * p.reserveMult));
          inst.mag = inst.magSize;
          if (p.weapons[slot] === inst && game.weapons) game.weapons.reloadT = 0;
        } else {
          // 新武器（v9.4 流转）：直接装备该槽；槽满(2把)则手中旧枪退入背包
          const inst = new WeaponInstance(item.def);
          inst.reserve = Math.floor(item.def.reserve * p.reserveMult);
          if (p.rack[slot].length < p.EQUIP_MAX) {
            p.rack[slot].push(inst);
            p.weapons[slot] = inst;
          } else {
            const old = p.weapons[slot];
            const oldIdx = p.rack[slot].indexOf(old);
            if (old && p.storageAdd({ kind: 'weapon', inst: old })) {
              if (oldIdx >= 0) p.rack[slot].splice(oldIdx, 1);
              p.rack[slot].push(inst);
              p.weapons[slot] = inst;
              HUD.toast(`🎒 ${old.def.name} 已存入背包`);
            } else {
              HUD.toast('⚠ 装备槽与背包已满——旧武器仍在手（本次购买自动改装弹）');
              // 槽和背包都满：只补弹不换枪
              const cur = p.weapons[slot];
              if (cur) { cur.reserve = Math.floor(cur.def.reserve * p.reserveMult); cur.mag = cur.magSize; }
              p.money -= item.price * 0;   // 退款由下方统一扣除——这里标记取消
              p.money += item.price;       // 退还
              AUDIO.denied();
              return false;
            }
          }
          p.current = slot;
          if (game.weapons) game.weapons._buildViewmodel();
        }
        break;
      }
      case 'weaponUp': {
        // 分项升级（v11.6）
        const inst = p.rack[item.def.slot].find(r => r.def.id === item.def.id);
        if (inst && item.upId) {
          inst.upgrades = inst.upgrades || {};
          inst.upgrades[item.upId] = (inst.upgrades[item.upId] || 0) + 1;
          inst.lvl = inst.tierLevel - (inst.lvl || 0) >= 0 ? inst.lvl : inst.lvl;   // 旧品质字段保留
          // 即时生效：满弹引用新弹容
          if (item.upId === 'mag' || item.upId === 'dmg') inst.mag = inst.magSize;
        }
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
      case 'bagUp': {
        const BAG_TIERS2 = [{ cap: 9, price: 2200 }, { cap: 12, price: 4800 }];
        const nb = BAG_TIERS2.find(t => t.cap > p.storageMax);
        if (nb) p.storageMax = nb.cap;
        break;
      }
    }
    p.money -= item.price;
    if (game._buyCount !== undefined) game._buyCount++;
    AUDIO.purchase();
    return true;
  },
};
