# plotloop 命名约定

## 对外分发的技能

- 技能名（目录名 / SKILL.md `name` / 市场里的名字）：`plotloop-<功能>`，例：`plotloop-align-host`
- `<功能>` 段必须一眼看懂用途，因为 `plotloop` 本身不说明用途
- 中文展示名（README 标题、公众号）：`plotloop <中文名>`，例：plotloop 对齐会主持人
- 产物署名（视频片尾、页面页脚）：`plotloop · <功能>`
- 打包时：`@plotloop/<功能>`
- 数据格式 schema id 不带品牌：`<功能>.<对象>.v1`，例：`align-host.agenda.v1`

为什么：技能会在技能市场和公众号文章里脱离仓库单独流传，名字是唯一一定会被带走的东西。

## 不加前缀

自用脚本、内部工具（如 `scripts/mimo-balance`）。

## 公开部署

全局唯一的资源名加前缀：`plotloop-<主题>`（如 Cloudflare Pages `plotloop-meeting-host`）。
