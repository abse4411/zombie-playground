/* ============================================================
 * 角色系统（v6.2）—— 4名可选角色（男女/职业/属性差异）
 * ============================================================ */
const CHARACTERS = [
  {
    id: 'raven', name: '渡鸦', gender: '男', prof: '突击兵',
    hp: 100, speed: 1.0, reload: 1.0, armorStart: 0, medkits: 2, dmg: 1.0,
    desc: '前特种部队狙击手，全能型。没有短板，也没有超能力——他有的是几千小时的训练。',
  },
  {
    id: 'nightingale', name: '夜莺', gender: '女', prof: '侦察兵',
    hp: 85, speed: 1.14, reload: 0.85, armorStart: 0, medkits: 2, dmg: 1.0,
    desc: '前侦察连射手。全队最快的双腿与最顺滑的换弹节奏，代价是防护薄弱。',
  },
  {
    id: 'bastion', name: '堡垒', gender: '男', prof: '重装兵',
    hp: 140, speed: 0.9, reload: 1.15, armorStart: 50, medkits: 2, dmg: 1.05,
    desc: '破门专家。自带50点装甲与厚实的生命，代价是笨重的移动。',
  },
  {
    id: 'apricot', name: '杏林', gender: '女', prof: '战地医护',
    hp: 90, speed: 1.05, reload: 0.9, armorStart: 0, medkits: 4, medkitHeal: 70, dmg: 0.95,
    desc: '战地医生。携带4个医疗包且治疗效果更强——她的存在就是全队的保险。',
  },
];

function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}
