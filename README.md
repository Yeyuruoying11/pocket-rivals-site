# Pocket Rivals 进展网站

CE346 Pocket Rivals 项目的公开进展页（代码在私有仓库 pocket-rivals）。
网址：https://yeyuruoying11.github.io/pocket-rivals-site/

## 怎么更新

- 任务 / 零件状态：改 `status.json`（`status` 可选值：任务 `done` / `doing` / `todo`；零件 `have` / `arrived` / `ordered` / `buy` / `choosing` / `later`）。
- 驱动程序：改 `status.json` 的 `drivers`（「硬件与 Pin」页最上面的表）。`board` 是 `player` / `both` / `central`；`owner` 填成员 id，空字符串显示「待定」；`status` 是 `todo` / `doing` / `done`；计划或可选的驱动加 `"plan": "planned"` 或 `"optional"`，表里会显示成虚线、淡色。
- Pin 分配：改 `pins.json`。

push 后大约一分钟网站会更新。

## 中文 / English

页面顶部（“Pocket Rivals”标题上方）的 **EN / 中文** 按钮切换界面语言，选择会记在浏览器里；第一次打开时按浏览器语言决定。

数据文件里中文照常写在原来的字段，英文写在同一条里的 `en` 对象中，字段名相同。没写英文的字段在英文界面显示中文，所以英文可以晚点补，但最好一起写好（课程老师和 TA 看英文版）。

- 任务（`status.json` 的 `tasks`）：`"en": {"group": "Milestones", "name": "...", "desc": "..."}`。`group` 只有两种：里程碑 → `Milestones`，模块任务 → `Module tasks`。
- 零件 / 模块 / 成员：同样加 `en`，例如零件 `"en": {"name": "...", "model": "...", "use": "..."}`（只写含中文的字段）。
- Pin（`pins.json`）：pin 的 `builtin`、`warn` 写在 pin 自己的 `en` 里，`player.use` 写在 `player` 的 `en` 里；最外层的 `en` 放 `note` 和 `extra`。

界面上的固定文字在各个脚本开头的 `I18N.add({zh: {...}, en: {...}})` 里（主页面是 `app.js`），用词参考 `i18n.js` 里的术语表。
