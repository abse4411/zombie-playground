/* ============================================================
 * 商城系统 —— 库存构建与购买逻辑
 * ============================================================ */
const SHOP = {
  tabs: [
    { id: 'primary', name: '🔫 主武器' },
    { id: 'secondary', name: '🔫 副武器' },
    { id: 'melee', name: '🔪 近战' },
    { id: 'throw', name: '💣 投掷物' },
    { id: 'support', name: '🛠 支援' },
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
          // 通用6线 + 按武器特征附加专属线（v11.11）
          const lines = [];
          for (const L of getUpgradeLines(inst.def)) {
            const lv = (inst.upgrades && inst.upgrades[L.id]) || 0;
            const maxed = lv >= L.max;
            lines.push({
              upId: L.id, name: L.name, lv, max: L.max, gain: L.gain, drawback: L.drawback,
              maxed, price: maxed ? 0 : L.price(inst.def.price, lv),
            });
          }
          const star = inst.mastery ? ' ★精通' : (inst.tierLevel ? ` · 强化${inst.tierLevel}级` : '');
          items.push({
            kind: 'upbench', id: 'bench_' + inst.def.id, def: inst.def, slot, inst,
            name: `${inst.def.name}${star}`,
            desc: inst.def.desc,
            price: 0, state: 'bench', lines, sellPrice: this.sellPriceForWeapon(inst),
            stats: inst.def.melee
              ? [['伤害', Math.round(inst.def.damage * inst.dmgMult)], ['范围', (inst.def.range + ((inst.upgrades && inst.upgrades.rng) || 0) * 0.25).toFixed(1) + 'm']]
              : [['伤害', Math.round(inst.def.damage * inst.dmgMult) * ((inst.def.pellets || 1) + ((inst.upgrades && inst.upgrades.pel) || 0))], ['弹匣', inst.magSize], ['换弹', (inst.def.reloadTime * inst.reloadTimeMult).toFixed(1) + 's']],
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
    } else if (tabId === 'support') {
      // 支援道具（v16.3）：限购次数制，背包中点击使用
      for (const id in GAMECONFIG.supports) {
        const S = GAMECONFIG.supports[id];
        const cur = p.supports[id] || 0;
        items.push({
          kind: 'support', id,
          name: `${S.icon} ${S.name} ×${S.pack}`,
          desc: S.desc,
          price: S.price,
          state: cur >= S.max ? 'maxed' : 'buy',
          stats: [...S.stats, ['持有', `${cur}/${S.max}`]],
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
        kind: 'ammoAll', id: 'ammoAll', name: '📦 全弹药补给', desc: '补满主武器与副武器槽内全部武器的备弹与弹匣（含升级弹匣）。',
        price: Math.round(E.ammoPrice * 0.8), state: 'buy',
        stats: [['覆盖', '主武器槽 + 副武器槽']],
      });
      // 主/副武器分类补给（v19.6）
      items.push({
        kind: 'ammoP', id: 'ammoP', name: '🟢 主武器弹药补给', desc: '只补满主武器槽内全部武器的备弹与弹匣。',
        price: 250, state: 'buy',
        stats: [['覆盖', '主武器槽'], ['效果', '备弹+弹匣全满']],
      });
      items.push({
        kind: 'ammoS', id: 'ammoS', name: '🔵 副武器弹药补给', desc: '只补满副武器槽内全部武器的备弹与弹匣。',
        price: 150, state: 'buy',
        stats: [['覆盖', '副武器槽'], ['效果', '备弹+弹匣全满']],
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
      // 道具（v18.1）：护甲板/弹药袋/肾上腺素
      for (const id in GAMECONFIG.items) {
        const it = GAMECONFIG.items[id];
        if (id === 'medkit') continue;   // 医疗包走 heal/拾取体系
        const cur = p.itemCount(id);
        items.push({
          kind: 'item', id,
          name: `${it.icon} ${it.name}`,
          desc: it.desc,
          price: it.price,
          state: cur >= it.max ? 'maxed' : 'buy',
          stats: [['持有', `${cur}/${it.max}`], ['使用', '道具槽[5]·左键']],
        });
      }
      // 武器栏位扩容（v18.1）：主/副/近战各槽 +1，上限3
      const SU = GAMECONFIG.slotUpgrade;
      const SLOT_META = { primary: '主武器', secondary: '副武器', melee: '近战武器' };
      const chDef = getCharacter(SAVE.data.character || 'raven');
      for (const slot of ['primary', 'secondary', 'melee']) {
        const base = (chDef.slots && chDef.slots[slot]) || ({ primary: 2, secondary: 1, melee: 1 })[slot];
        const cur = p.slotMax ? p.slotMax[slot] : base;
        const lv = Math.max(0, cur - base);   // 已扩容档数
        const prices = SU.price[slot];
        const maxed = cur >= SU.cap;
        items.push({
          kind: 'slotUp', id: 'slotUp_' + slot, slot,
          name: `🎖 ${SLOT_META[slot]}栏位 +1`,
          desc: `${SLOT_META[slot]}装备栏位 ${cur} → ${Math.min(SU.cap, cur + 1)} 把，火力配置更灵活。`,
          price: maxed ? 0 : (prices[lv] !== undefined ? prices[lv] : prices[prices.length - 1]),
          state: maxed ? 'maxed' : 'buy',
          stats: [['栏位', `${cur} → ${Math.min(SU.cap, cur + 1)}`], ['上限', SU.cap + ' 把']],
        });
      }
    }
    return items;
  },

  // 出售回收价（v20.9）：武器上限原价50%，品质等级越高折得越多（每级-4%，下限30%）；道具40%
  sellPriceForWeapon(inst) {
    const tier = inst.tierLevel || 0;
    const mult = Math.max(0.3, 0.5 - tier * 0.04);
    return Math.max(50, Math.round(inst.def.price * mult / 10) * 10);
  },
  sellPriceForItem(id) {
    const def = GAMECONFIG.items[id];
    return def ? Math.max(20, Math.round(def.price * 0.4 / 10) * 10) : 0;
  },

  // 出售（v20.9）：武器（升级台卡片）/ 道具（道具卡片）
  sell(game, kind, id) {
    const p = game.player;
    if (kind === 'weapon') {
      let inst = null, slot = null;
      for (const sl of ['primary', 'secondary', 'melee']) {
        const found = p.rack[sl].find(r => r.def.id === id);
        if (found) { inst = found; slot = sl; break; }
      }
      if (!inst) return false;
      if (p.rack[slot].length <= 1) { AUDIO.denied(); HUD.toast('该栏位只剩这一把武器，不能出售'); return false; }
      const price = this.sellPriceForWeapon(inst);
      p.rack[slot] = p.rack[slot].filter(r => r !== inst);
      if (p.weapons[slot] === inst) {
        p.weapons[slot] = p.rack[slot][p.rack[slot].length - 1] || null;
        if (p.current === slot && game.weapons) {
          if (p.weapons[slot]) game.weapons._equip(slot);
          else game.weapons._cycle(['secondary', 'primary', 'melee'].find(s2 => p.weapons[s2]) ? 1 : 0);
        }
      }
      if (p.storage) p.storage = p.storage.filter(it => !(it && it.kind === 'weapon' && it.inst === inst));
      p.addMoney(price);
      HUD.pickup(`💵 出售 \${inst.def.name} +$\${price}`, 1);
      AUDIO.purchase();
      return true;
    }
    if (kind === 'item') {
      if ((p.items[id] || 0) <= 0) return false;
      const price = this.sellPriceForItem(id);
      p.items[id]--;
      p.addMoney(price);
      HUD.pickup(`💵 出售 \${GAMECONFIG.items[id].name} +$\${price}`, 1);
      AUDIO.purchase();
      return true;
    }
    return false;
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
          if (p.rack[slot].length < (p.slotMax ? p.slotMax[slot] : 2)) {
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
          // 武器特点上限（v18.7）：达到有效上限则拒绝（双保险，UI 层已禁用）
          const line = getUpgradeLines(inst.def).find(L => L.id === item.upId);
          if (line && (inst.upgrades[item.upId] || 0) >= line.max) { AUDIO.denied(); return false; }
          inst.upgrades = inst.upgrades || {};
          inst.upgrades[item.upId] = (inst.upgrades[item.upId] || 0) + 1;
          // 即时生效：满弹引用新弹容
          if (item.upId === 'mag' || item.upId === 'dmg') inst.mag = inst.magSize;
          if (item.upId === 'pel' || item.upId === 'rel') inst.reserve = Math.min(inst.reserve, Math.floor(inst.def.reserve * p.reserveMult * (inst.reserveMaxMult || 1) * 1.2));
          // 满级精通（v11.11）：全部可用线满级 → ★精通
          if (inst.mastery && !inst._masteryToasted) {
            inst._masteryToasted = true;
            inst._mastery = true;
            HUD.banner(`⭐ ${inst.def.name} 精通！`, '全部升级线已满级 —— 该武器已臻化境');
            AUDIO.streak();
          }
        }
        break;
      }
      case 'throw': {
        const t = THROWABLES[item.id];
        p.throwables[item.id].count = Math.min(t.max, p.throwables[item.id].count + t.pack);
        break;
      }
      case 'support': {
        // 支援道具入库（v16.3）
        const S = GAMECONFIG.supports[item.id];
        p.supports[item.id] = Math.min(S.max, (p.supports[item.id] || 0) + S.pack);
        HUD.toast(`${S.icon} ${S.name} 已入背包——打开背包 [Tab] 点击使用`);
        break;
      }
      case 'item': {
        // 道具入库（v18.1）：道具槽[5]·左键使用
        const it = GAMECONFIG.items[item.id];
        p.items[item.id] = Math.min(it.max, (p.items[item.id] || 0) + 1);
        HUD.toast(`${it.icon} ${it.name} 已入道具栏 [5]`);
        break;
      }
      case 'slotUp': {
        // 武器栏位扩容（v18.1）
        if (!p.slotMax) p.slotMax = { primary: 2, secondary: 1, melee: 1 };
        p.slotMax[item.slot] = Math.min(GAMECONFIG.slotUpgrade.cap, p.slotMax[item.slot] + 1);
        const names = { primary: '主武器', secondary: '副武器', melee: '近战武器' };
        HUD.toast(`🎖 ${names[item.slot]}栏位扩容至 ${p.slotMax[item.slot]} 把`);
        break;
      }
      case 'perk': {
        const oldMax = p.maxHp;
        p.perks[item.id]++;
        p.recomputePerks();
        if (item.id === 'hp') p.hp += p.maxHp - oldMax;
        if (item.id === 'armor') p.armor = p.maxArmor;
        if (item.id === 'stamina') p.stamina = p.maxStamina;   // 耐力针剂：购买即回满（v13.2）
        break;
      }
      case 'heal': p.hp = p.maxHp; break;
      case 'ammoAll':
        // v19.6 修复：弹匣容量按升级后的 magSize（原 def.mag 会把 +5级扩容弹匣缩回基础值）
        for (const s of ['primary', 'secondary']) {
          for (const inst of p.rack[s]) {
            if (!inst || inst.def.melee) continue;
            inst.reserve = Math.floor(inst.def.reserve * p.reserveMult * (inst.reserveMaxMult || 1));
            inst.mag = inst.magSize;
          }
        }
        break;
      case 'ammoP':
      case 'ammoS': {
        // 主/副武器分类补给（v19.6）
        const slot = item.kind === 'ammoP' ? 'primary' : 'secondary';
        for (const inst of p.rack[slot]) {
          if (!inst || inst.def.melee) continue;
          inst.reserve = Math.floor(inst.def.reserve * p.reserveMult * (inst.reserveMaxMult || 1) * 1.2);
          inst.mag = inst.magSize;
        }
        break;
      }
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
