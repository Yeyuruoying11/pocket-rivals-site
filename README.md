# Pocket Rivals 项目网站

CE346 Pocket Rivals 的静态项目网站（GitHub Pages），固件代码在私有仓库 pocket-rivals，这里只放进展数据和网页。
网址：https://yeyuruoying11.github.io/pocket-rivals-site/

`index.html` 是主页面（总览、时间线、硬件与 Pin、玩法原型、留言），`device.html` 是掌机模拟器。主页面的数据全部来自 `status.json` 和 `pins.json`（用 fetch 读取），所以要通过 HTTP 打开（见「本地运行」）。

## 主页面 `index.html` 的几个标签页

- **总览**：四张统计卡（周次、任务进度百分比、进行中的任务数、零件到手数）。下面是「系统架构」，可以切换两种视图：**硬件** 视图按 1 号玩家板 → 中央板 → 2 号玩家板排开，每块板按传感器 / 执行器分组，数据来自 `status.json` 的 `components`（`player` / `central` 两个数组）；**软件** 视图按 玩家固件 / 中央固件 / 共用 三块列出模块，数据来自 `status.json` 的 `software`（`player` / `central` / `shared`）。点击任意模块看文件、负责人和状态。再往下是「团队分工」，数据来自 `status.json` 的 `members`。导航栏的「按成员看」可以只看某个成员的任务和零件。
- **时间线**：甘特图，数据来自 `status.json` 的 `tasks`（`week`、`span`、`status`、`owner`）。可以按 全部 / 里程碑 / 模块任务 过滤，也可以「只看本周进行中的」；点任务看详情。
- **硬件与 Pin**：三部分。驱动表（`status.json` 的 `drivers`，按 `board` 分成 玩家板 / 玩家板和中央板共用 / 中央板 三组）；采购清单（`status.json` 的 `parts`，按状态分组并显示进度条）；Pin 分配图（`pins.json`）。Pin 图是每个 pin 一个方块，按当前选中的板子画出用途：玩家板看 `player.use` 和它挂的 `part`（零件颜色来自 `PIN_PARTS`），中央板只显示板载用途。没被占用的 pin 是虚线空框，板载 LED / 按钮 / Qwiic 占用的是灰底，`warn` 会在方块上打警告；顶部可以切换 玩家板 / 中央板，玩家板还能勾「停用板载 LED 点阵」把 P3、P4、P6、P7、P10 算成空闲。点任意 pin 看 nRF 引脚号、能力、当前用途和警告；下面的说明列表来自 `pins.json` 的 `extra`。
- **玩法原型**：`battle.js` 里的同屏对战原型，规则和攻击测试 / 连续格挡的手感可以现场调；参数名与默认值和固件里的 `game_config.h` 一致，可以一键复制成 C 代码。规则说明和参数区都在这页。
- **留言**：`reviews.js`。留言本身不是存在仓库文件里，而是 GitHub Issues：页面用 GitHub API 读本仓库 `Yeyuruoying11/pocket-rivals-site` 的 open issues，标题带 `[评价 Review]` 或带 `review` 标签的才算评价，按 `review.yml` 表单里的 `### 字段` 解析出评分、宠物、评价、署名。写留言时会跳到预填好的 issue 表单页（`template: review.yml`），点 Create 发布；关闭 issue 就等于隐藏这条留言。列表可以按 最新 / 评分最高 排序，也可以点「刷新」。
- **掌机模拟器 ↗**：跳到 `device.html`。

## 掌机模拟器 `device.html`

模拟两台 128×160 的掌机和一块虚拟中央板（含无线链路）：两台掌机的屏幕、按键、摇杆和压力垫都是模拟的，中央板负责跑模式逻辑，三块板之间的消息、丢包、延迟也一起模拟。

- **操作**：键盘 P1 用 W A S D 摇杆、F = A、G = B、R = SKILL、T = MENU、V = 压力垫（重）、C = 压力垫（轻）；P2 用方向键、K = A、L = B、I = SKILL、O = MENU、`,` = 压力垫（重）、`.` = 压力垫（轻）；挥手（距离传感器）P1 是 E、P2 是 P。`` ` `` 暂停 / 继续，Tab 交换两组按键控制哪台掌机。触屏 / 鼠标：屏幕下方有虚拟摇杆和 A / B / S / M 按钮，还有一根竖直压力条（手指高度当力度）和一个「挥手」键。接上手柄也能用。
- **调试面板**（`device-debug.js`）：种子与重来、把某台掌机交给电脑、暂停 / 单步 / 速度；无线预设（完美 / 一般 / 很差 / 几乎断开）、丢包、延迟、同信道冲突、拔掉无线、重启、关机、切信道、改烧录版本；硬件开关（拔摇杆、拿 SD 卡、拔压力垫、拿掉加速度计、FSR 分压反接、SPI 时钟）；每台掌机的倾斜滑杆；攻击测试公平表；每台掌机上方手的高度（模拟距离传感器）；每台掌机的画面、帧率、上一帧像素和 SPI 预算；中央板的模式 / 阶段 / 链路；消息大小和 flash 预算；字库、lint、错误列表；调参导出；今日排行榜的查看和清空。
- **URL 选项**（见 `device-core.js` 开头的注释）：`?seed=N`、`?test=1`、`?view=p1|p2|both`、`?gallery`、`?fixture=id`、`?pad=auto|on|off`、`?mode=battle|racing|adventure|echo`、`?speed=0.25..2`、`?scale=2|3|4`。`?test=1` 是给脚本和截图用的确定性模式：模拟不自己走，由测试脚本一步步推进（`DEVICE.step`），随机数按种子固定，不轮询手柄，排行榜写进内存而不是 localStorage。窗口窄于 900 px 且没写 `?view` 时只显示 P1，P2 交给电脑。
- **模式**：
  - **对抗**（`mode-battle.js`）：两人各带 3 只宠物，暗中选出场的宠物；进攻方做攻击测试（每只宠物一种：焰灵捏压力垫跟光带，潮影倾斜掌机让水珠留在浪尖，叶芽跟着喇叭的拍子按 A；分数决定伤害），防守方看时机格挡，先打倒对方 3 只宠物的一方获胜。公式和玩法原型 `battle.js` 一致。
  - **双人赛车**（`mode-racing.js`）：五条赛道，**经典**（16×16 小图，原版俯视赛道）、**林荫公园**、**八字激流**、**疾风环**、**回头湾**（这四条是 32×32 大图）。视角有三种：**俯视**、**车后**、**车内**；只有 16×16 的经典三种都能选，32×32 的赛道只有 车后 和 车内。被潮影的浪花挡住视线时，在掌机上方挥手可以更快擦掉（计划中的距离传感器，模拟器里用挥手键或调试面板的手高滑杆）。
  - **双人冒险**（`mode-adventure.js`）：两人合作，先一起投票选世界，各选一只宠物，共享 5 颗心，每个世界 4 个房间（第 4 个是 boss）。世界 1：1-1 入口、1-2 绞盘、1-3 双拉杆、1-4 守卫；世界 2（神龛主题）：2-1 双口袋、2-2 三色廊、2-3 墙中龛、2-4 独眼像；世界 3（配合主题）：3-1 接力、3-2 分头、3-3 同步、3-4 石犀。打完一个世界的 boss 可以按 A 进下一个世界（宠物保留）。每个世界有 3 颗星，看通关时间、剩余心等。
  - **今日排行榜**（`screens-menu.js`）：菜单里的「排行榜」页面，分 对抗 最高测试 / 赛车 最快一圈 / 冒险 最快通关（按世界）三个榜，进榜要输 3 个字母的名字；记录存在中央板上（`localStorage` 的 `pr.device.central.rank`），设置页里可以清榜。

## 怎么更新

- 任务 / 零件状态：改 `status.json`（`status` 可选值：任务 `done` / `doing` / `todo`；零件 `have` / `arrived` / `ordered` / `buy` / `choosing` / `later`）。
- 驱动程序：改 `status.json` 的 `drivers`（「硬件与 Pin」页最上面的表）。`board` 是 `player` / `both` / `central`（决定它出现在哪一组）；`owner` 填成员 id，空字符串或不认识时显示「待定」；`status` 是 `todo` / `doing` / `done`；计划或可选的驱动加 `"plan": "planned"` 或 `"optional"`，这一行会单独标出来。
- Pin 分配：改 `pins.json`。玩家板的用途写在每个 pin 的 `player.use`，`player.part` 决定方块颜色；板载用途写 `builtin`，警告写 `warn`，补充说明写在 `extra` 数组里。

push 后大约一分钟网站会更新。

## 中文 / English

页面顶部（"Pocket Rivals" 标题上方）的 **EN / 中文** 按钮切换界面语言，选择会记在浏览器里；第一次打开时按浏览器语言决定。

数据文件里中文照常写在原来的字段，英文写在同一条里的 `en` 对象中，字段名相同。没写英文的字段在英文界面显示中文，所以英文可以晚点补，但最好一起写好（课程老师和 TA 看英文版）。

- 任务（`status.json` 的 `tasks`）：`"en": {"group": "Milestones", "name": "...", "desc": "..."}`。`group` 只有两种：里程碑 → `Milestones`，模块任务 → `Module tasks`。
- 零件 / 模块 / 成员：同样加 `en`，例如零件 `"en": {"name": "...", "model": "...", "use": "..."}`（只写含中文的字段）。
- Pin（`pins.json`）：pin 的 `builtin`、`warn` 写在 pin 自己的 `en` 里，`player.use` 写在 `player` 的 `en` 里；最外层的 `en` 放 `note` 和 `extra`。

界面上的固定文字在各个脚本开头的 `I18N.add({zh: {...}, en: {...}})` 里（主页面是 `app.js`），用词参考 `i18n.js` 里的术语表。

## 本地运行

页面用 fetch 读 JSON，直接双击打开会被浏览器拦下，需要一个静态服务器。在本文件夹里：

```
python3 -m http.server
```

然后打开 http://localhost:8000/index.html 和 http://localhost:8000/device.html 。

## 数据文件

- `status.json`，顶层六段：`members`（成员名单、角色和分工，总览的团队分工和导航的成员过滤用）、`tasks`（任务和时间线甘特图用）、`parts`（采购清单用）、`components`（总览硬件架构视图里的板载传感器 / 执行器用）、`software`（总览软件架构视图里的模块用）、`drivers`（硬件与 Pin 页的驱动表用）。
- `pins.json`：每个 pin 的 `nrf`、`caps`、`builtin`、`player`、`warn`，加上最外层的 `note` 和 `extra`，画「硬件与 Pin」页的 Pin 分配图用。

## 文件一览

- `index.html`：主页面结构。
- `app.js`：总览、时间线、硬件与 Pin 的渲染，界面文字（`I18N.add`）。
- `battle.js`：玩法原型（战斗手感与参数调节）。
- `pet-trials.js`：三只宠物的攻击测试（光带、倾斜、节拍）、§2C 的 bot 模型和公平测试；原型、模拟器和 Node 测试共用。
- `reviews.js`：留言页，读 GitHub Issues、拼预填的发布链接。
- `i18n.js`：中英文切换和术语表。
- `style.css`：主页面与模拟器共用的样式。
- `device.html`：掌机模拟器页面。
- `device-core.js`：模拟器核心：两台掌机、中央板、无线、消息、测试钩子 `window.DEVICE`。
- `device-font.js`：模拟器用的字库表。
- `device-debug.js`：调试面板、手柄、截图和 fixture 运行器。
- `device.css`：模拟器专用样式。
- `screens-boot-login.js`：开机、登录等掌机画面。
- `screens-menu.js`：菜单、设置、今日排行榜等画面。
- `mode-battle.js`：模拟器里的 对抗 模式。
- `mode-racing.js`：模拟器里的 双人赛车 模式（赛道、视角、绘制）。
- `mode-adventure.js`：模拟器里的 双人冒险 模式。
- `status.json`：任务、零件、模块、成员、驱动数据。
- `pins.json`：pin 分配数据。
- `.github/ISSUE_TEMPLATE/review.yml`：留言用的 issue 表单，字段名和 `reviews.js` 对应。

## English

Project site for CE346 Pocket Rivals, served from GitHub Pages; the firmware lives in the private repo pocket-rivals. `index.html` has five tabs plus the handheld-simulator link:

- **Overview**: stats cards, the system architecture with a Hardware view (boards, from `components` in `status.json`) and a Software view (modules, from `software`), and the team list (from `members`).
- **Timeline**: a Gantt chart of `tasks`.
- **Hardware & pins**: the driver table (`drivers`, grouped by board), the parts list (`parts`), and the pin map drawn from `pins.json` (per-pin use, colour by part, warnings, board switch, LED-matrix toggle).
- **Battle prototype**: the local two-player battle prototype in `battle.js`, including tunable parameters.
- **Guestbook**: reviews are GitHub issues on this repo, read through the GitHub API and parsed with the `review.yml` form headings; writing one opens the pre-filled issue form, closing an issue hides the entry.

`device.html` is the handheld simulator: two 128×160 handhelds plus a virtual central board and radio, keyboard (P1 WASD / F G R T V C, wave E; P2 arrows / K L I O , ., wave P), touch sticks and pressure bar, and a debug panel (seed, bots, speed, radio loss / latency, hardware faults, SPI budget, leaderboard). URL options include `?test=1` (deterministic, fixtures and screenshots), `?seed=N`, `?view=p1|p2|both`, `?mode=...`, `?speed=`, `?scale=`. Modes: Battle 对抗 (`mode-battle.js`; one attack trial per pet from `pet-trials.js`: Ember the pad band, Tide tilting, Sprout the beat), two-player Racing 双人赛车 (`mode-racing.js`: five tracks, Classic, Park Avenue, Riptide Eight, Gale Loop and Switchback Bay; views Top / Chase / Cockpit, only the 16×16 Classic offers Top), co-op Adventure 双人冒险 (`mode-adventure.js`: three worlds of four rooms, the fourth a boss), and Today's Best 今日排行榜 (three boards kept on the central board).

Run it locally with `python3 -m http.server` in this folder, then open `http://localhost:8000/index.html` or the `device.html` on the same port — the pages fetch JSON, so a static server is required.

Data: `status.json` (`members`, `tasks`, `parts`, `components`, `software`, `drivers`) and `pins.json`. Both carry an `en` object next to the Chinese fields; missing English falls back to Chinese. UI strings live in each script's `I18N.add({zh, en})`.
