# 测试

仓库 `tests/` 里的浏览器测试直接跑在仓库中的静态站点（`device.html` + `device-*.js` + `mode-*.js`）上，
用 Playwright（Node 包）驱动 Chromium。**测试不需要起服务器**：`tests/route.js` 由 `node -r` 预加载，
用 Playwright 的请求拦截把 `http://127.0.0.1:<任意端口>/...` 映射到仓库目录。

## 需要什么

- Node 18+
- 全局安装的 Playwright npm 包及其 Chromium（`npm i -g playwright && npx playwright install chromium`）；
  浏览器路径由调用者的 `PLAYWRIGHT_BROWSERS_PATH` 决定
- 一个 C 编译器（`cc`），用来编译冒险关卡的求解器 `tests/adv/solve.c`

## 怎么跑

    bash tests/run.sh quick     # 约 2.5 分钟（本机实测 ~145 s）
    bash tests/run.sh full      # 约 13 分钟（本机实测 ~780 s，包含 quick）

脚本先 `cd` 到仓库根目录，所以从任何地方调用都行；不带参数时默认 `quick`。
它先建 `tests/out/`，若 `tests/out/solve_c` 不存在或比 `solve.c` 旧就
`cc -O2 -o tests/out/solve_c tests/adv/solve.c`，然后逐步运行（每步打印 `== <名字>` 和秒数），
某步失败也会继续，最后给出 PASS/FAIL 汇总，有失败则退出码 1。
单独跑某一个浏览器测试时：

    node -r ./tests/route.js tests/<文件>.js ...

## 各文件检查什么

| 文件 | 检查内容 |
| --- | --- |
| `smoke.js` | 每个模拟器 fixture 在 zh 与 en 下都通过，`DEVICE.errors()` 和 `lint()` 为空（含冒险世界 2、3 的回归） |
| `input-test.js` | 距离传感器输入：手的远近、挥手、夹紧与复位（~15 s） |
| `gate-test.js` | 冒险：用手（距离传感器）或压力垫托住绞盘闸门：两者取大、阈值、越托越重、参数 |
| `wave-test.js` | 竞速：挥手擦掉水花，只影响自己 |
| `blurb-test.js` | 竞速：五条赛道的简介文字（zh/en） |
| `adv/check-w1.js` | 世界 1 的几何、物件清单、求解器可解性、用真实中央代码回放（无浏览器，~60 s） |
| `race-test.js` | 竞速全部部件（race, fix, steer, laps3, flash, sweep）× zh/en × 1200/390 px（长，~7-8 分钟；参数 `[PORT=8961] [PARTS] [LANGS] [WIDTHS]`） |
| `full-test.js` | 端到端：启动、登录、三种模式、设置、语言切换；8 种组合 + 30% 丢包（~2 分钟；参数 `[SITE] [PORT]`，环境变量 `ONLY=zh-1200-light` 等只跑一组） |
| `adv/make-cases.js` | 生成世界 1 的关卡用例（用 `tests/out/solve_c` 求解），写 `tests/out/adv-cases.json` |
| `adv/harness.js` | 在浏览器里把世界 1 玩通（solve / solo / restart / boss / bossSolo / bot，51 个用例，数分钟） |
| `adv/solve.c` | BFS 求解器（`run.sh` 负责编译） |
| `route.js` | 预加载：把所有对本机端口的请求交给仓库文件夹（测试因此不需要服务器） |

输出（截图、`adv-cases.json`、`solve_c`）都写到 `tests/out/`，该目录不提交（见根目录 `.gitignore`）。

## English

Browser tests for the static site in this repository (`device.html` + `device-*.js` + `mode-*.js`),
driven by the globally installed Playwright npm package with its Chromium.
**No server is needed**: `node -r ./tests/route.js` preloads `tests/route.js`, which answers every
request to `http://127.0.0.1:<any port>/` from the repository folder via Playwright request interception.

Requirements: Node 18+, Playwright npm package installed globally with Chromium
(`PLAYWRIGHT_BROWSERS_PATH` comes from your environment), and a C compiler for the adventure solver.

Run:

    bash tests/run.sh quick     # ~2.5 min (~145 s measured here)
    bash tests/run.sh full      # ~13 min (~780 s measured here, includes quick)

The script `cd`s to the repository root, defaults to `quick`, creates `tests/out/`, compiles
`tests/out/solve_c` from `tests/adv/solve.c` when missing or older, runs every step (a `== <name>`
header plus elapsed seconds each), keeps going after a failure, prints a PASS/FAIL summary per step,
and exits 1 if anything failed. A single browser test: `node -r ./tests/route.js tests/<file>.js ...`.

What each file checks (one line each): `smoke.js` every simulator fixture in zh and en;
`input-test.js` distance-sensor input (~15 s); `gate-test.js` adventure: hand / pad holds the winch gate;
`wave-test.js` racing: a wave wipes the splash; `blurb-test.js` racing: the five track blurbs;
`adv/check-w1.js` World 1 geometry, inventory, solver and real-central replay (no browser, ~60 s);
`race-test.js` racing all parts × zh/en × 1200/390 px (long, ~7-8 min, args `[PORT=8961] [PARTS] [LANGS] [WIDTHS]`);
`full-test.js` end-to-end: boot, login, all three modes, settings, language, 8 combinations plus 30 % packet
loss (~2 min, args `[SITE] [PORT]`, env `ONLY=zh-1200-light` etc. for one run); `adv/make-cases.js` builds the World 1
cases with the solver into `tests/out/adv-cases.json`; `adv/harness.js` plays World 1 in the browser
(solve / solo / restart / boss / bossSolo / bot, 51 cases, several minutes); `adv/solve.c` the BFS solver;
`route.js` the preload that serves the repository folder, so the tests need no server.

All output (screenshots, `adv-cases.json`, `solve_c`) goes to `tests/out/`, which is not committed
(see the repository-root `.gitignore`).
