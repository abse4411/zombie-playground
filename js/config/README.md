# js/config —— 数据源文件（构建时提取，运行时不加载）

> v12.1 资源架构改造后，本目录的数据表**不再被 index.html 加载**。
> 它们是 `assets/data/*.json` 的**构建源**：修改内容后运行

```bash
node tools/extract-data.js
```

重新生成外置资源，然后刷新页面即可生效。

| 源文件 | 外置产物 | 说明 |
|---|---|---|
| weapons.js | assets/data/weapons.json | 武器 + 投掷物 |
| zombies.js | assets/data/zombies.json | 感染体数据表 |
| characters.js | assets/data/characters.json | 可选角色 |
| perks.js | assets/data/perks.json | valName 函数 → `{v}`/`{v%}` 模板 |
| achievements.js | assets/data/achievements.json | goal 函数 → {stat,target} 数据 |
| story.js | assets/data/missions/index.json + missions/m*.json | 波次/对话按任务懒加载 |
| maps.js | assets/data/maps/index.json + maps/<id>.json | 地图数据懒加载 |
| gameConfig.js | **保留在代码中直接加载** | 平衡调参常量（非内容资源） |
| maps.js 的 STRUCTS | js/systems/mapStructs.js | 特殊建筑构建器（代码，随包加载） |

运行时装配逻辑见 `js/core/resources.js`（RES.boot / RES.loadMap / RES.loadMission）。
