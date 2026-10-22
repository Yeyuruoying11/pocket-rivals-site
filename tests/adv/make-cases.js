// Build the play-through cases: World 1, every room, with a scripted 2-player solution per pet
// order. Maps are read from the site's mode-adventure.js, solutions come from the solver (solve_c).
// Boss rooms carry no path: they are driven by the policies in boss-policy.js.
// (World 2 / 3 are covered by the simulator's own adv.w2 / adv.w3 / adv.pairs fixtures in smoke.js.)
// usage: node tests/adv/make-cases.js [siteDir]   (siteDir default: the repository root)
//   solver: process.env.SOLVE_C, or tests/out/solve_c (compile tests/adv/solve.c into it)
//   writes tests/out/adv-cases.json (the folder is created if missing)
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), {execFileSync} = require("child_process");
const HERE = __dirname, ROOT = path.resolve(HERE, "..", "..");
const SITE = path.resolve(process.argv[2] || ROOT);
const SOLVE = process.env.SOLVE_C || path.join(HERE, "..", "out", "solve_c");
const OUTDIR = path.join(HERE, "..", "out"), OUT = path.join(OUTDIR, "adv-cases.json");
const ORDERS = [[0, 1], [1, 0], [0, 2], [2, 0], [1, 2], [2, 1]];
const tag = o => "ETS"[o[0]] + "ETS"[o[1]];

function siteRooms(file) {
  const src = fs.readFileSync(file, "utf8");
  const a = src.indexOf("const ROOMS = [");
  // the ROOMS literal ends at the first line that is exactly "  ];"
  const end = src.indexOf("\n  ];", a);
  return vm.runInNewContext("(" + src.slice(a + "const ROOMS = ".length, end + 4) + ")", {});
}
function solve(map, gateBack, a, b) {
  const sh = 3 - a - b;
  const out = execFileSync(SOLVE,
    [map.join(""), String(gateBack == null ? 0 : gateBack), String(a), String(b), String(sh), "0", "2", "4", "0", "-1"]).toString();
  const r = {};
  for (const line of out.trim().split("\n")) { const [k, ...v] = line.split(" "); r[k] = v; }
  if (r.solvable[0] !== "1") return null;
  return r.path.join(" ");
}

const cases = [];
const w1 = siteRooms(path.join(SITE, "mode-adventure.js")).slice(0, 4);   // ROOMS holds all 3 worlds; World 1 = the first 4
w1.forEach((r, i) => {
  const c = {id: "1-" + (i + 1), world: 1, room: i + 1, map: r.map, gateBack: r.gateBack == null ? null : r.gateBack, boss: !!r.boss,
    bossType: r.boss ? "warden" : null,
    coop: i > 0,          // 1-1 ENTRY is a teaching room: each pet walks through its own barrier, no co-op claim
    solutions: {}};
  if (!r.boss) for (const o of ORDERS) c.solutions[tag(o)] = solve(r.map, r.gateBack, o[0], o[1]);
  cases.push(c);
});
fs.mkdirSync(OUTDIR, {recursive: true});
fs.writeFileSync(OUT, JSON.stringify(cases, null, 1));
for (const c of cases) console.log(c.id.padEnd(4), c.boss ? "boss " + c.bossType : Object.entries(c.solutions).map(([k, v]) => k + ":" + (v ? v.split(" ").length : "NO")).join(" "));
