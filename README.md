# Pocket Rivals 进展网站

CE346 Pocket Rivals 项目的公开进展页（代码在私有仓库 pocket-rivals）。
网址：https://yeyuruoying11.github.io/pocket-rivals-site/

## 怎么更新

- 发进展：在 `updates.json` 最上面加一条（网站“进展”页有生成器，可以直接复制），push 到 `main`。
- 任务 / 零件状态：改 `status.json`（`status` 可选值：任务 `done` / `doing` / `todo`；零件 `have` / `arrived` / `ordered` / `buy` / `choosing` / `later`）。
- Pin 分配：改 `pins.json`。

push 后大约一分钟网站会更新。

## 中文 / English

页面顶部（“Pocket Rivals”标题上方）的 **EN / 中文** 按钮切换界面语言，选择会记在浏览器里；第一次打开时按浏览器语言决定。

数据文件里中文照常写在原来的字段，英文写在同一条里的 `en` 对象中，字段名相同。没写英文的字段在英文界面显示中文，所以英文可以晚点补，但最好一起写好（课程老师和 TA 看英文版）。

- 进展（`updates.json`）：生成器里有「英文标题 / 英文内容（可选）」，填了就会在复制出的 JSON 里带上 `en`：

  ```json
  {
    "date": "2026-10-22",
    "author": "harvey",
    "area": "显示",
    "title": "TFT 能显示角色了",
    "body": "……",
    "en": {"area": "Display", "title": "The TFT now shows a character", "body": "..."}
  }
  ```

  常用分类（无线、网站、玩法、硬件、显示、音效、规划、其他）在英文界面会自动翻译，`en.area` 可以不写；新的分类请写上 `en.area`。
- 任务（`status.json` 的 `tasks`）：`"en": {"group": "Milestones", "name": "...", "desc": "..."}`。`group` 只有两种：里程碑 → `Milestones`，模块任务 → `Module tasks`。
- 零件 / 模块 / 成员：同样加 `en`，例如零件 `"en": {"name": "...", "model": "...", "use": "..."}`（只写含中文的字段）。
- Pin（`pins.json`）：pin 的 `builtin`、`warn` 写在 pin 自己的 `en` 里，`player.use` 写在 `player` 的 `en` 里；最外层的 `en` 放 `note` 和 `extra`。

界面上的固定文字在各个脚本开头的 `I18N.add({zh: {...}, en: {...}})` 里（主页面是 `app.js`），用词参考 `i18n.js` 里的术语表。
