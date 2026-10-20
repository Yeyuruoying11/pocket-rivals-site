# Pocket Rivals 进展网站

CE346 Pocket Rivals 项目的公开进展页（代码在私有仓库 pocket-rivals）。
网址：https://yeyuruoying11.github.io/pocket-rivals-site/

## 怎么更新

- 发进展：在 `updates.json` 最上面加一条（网站“进展”页有生成器，可以直接复制），push 到 `main`。
- 任务 / 零件状态：改 `status.json`（`status` 可选值：任务 `done` / `doing` / `todo`；零件 `have` / `arrived` / `ordered` / `buy` / `choosing` / `later`）。
- Pin 分配：改 `pins.json`。

push 后大约一分钟网站会更新。
