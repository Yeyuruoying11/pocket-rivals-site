// Pocket Rivals handheld simulator: core runtime (device-core.js)
//
// Spec: pocket-rivals docs/ui-design.md §8 (and §2-3, §7.6-7.7). Two player
// boards (128x160 TFT each) and a virtual central board, connected only by
// byte messages over a simulated 802.15.4 radio, so anything playable here
// can be built on the three micro:bits. Plain <script>, no build step, loaded
// right after i18n.js (which sits in <head>). Feature files register
// themselves at load time (no DOM, no timers); DOMContentLoaded -> start().
//
// Sections (in this order): 1 constants + registries, 2 random numbers,
// 3 palette + drawing, 4 fonts, 5 shared sprites + DEVICE.ui, 6 input,
// 7 radio + message codec, 8 central host + stub session, 9 handheld,
// 10 sound, 11 DEVICE.trial / DEVICE.padLevel, 12 main loop, DOM, test hook,
// stub helpers and the echo mode.
//
// The function names, parameters and return values below are FROZEN after
// step 0 (§8.1). The core owner may fix bugs and add optional fields; items
// marked [+] are additions to the spec, all optional and backwards compatible.
//
// ======================= MODULE API (load time) =======================
//
// DEVICE.registerStrings(prefix, {zh: {...}, en: {...}})
//   Every key must start with prefix. Calls I18N.add, records keys (missing
//   English -> lint "missingEn") and Chinese characters (font export). Every
//   character must be in the m charset (ASCII, CJK, ！？：，、。…「」); write
//   icons as {A} {B} {S} {M} {STICK} {PAD} {OK} {NO} {STAR} {L} {R} {UP} {DN}
//   {DEL} {DICE} {GEAR}, never as ✓ ▶ ⚄ (lint "charset"). dev.page.* (HTML
//   page text) is exempt. Placeholders are {name}; icon names are reserved.
//   [+] Once device-font.js is loaded, a non-ASCII character that is not in it
//   is linted "missingGlyph" (at start for every string, and when drawn):
//   re-run software/tools/make_font.py.
// DEVICE.registerSprites(prefix, {"adv.slime": {w, h, mirror, frames: [[rows]],
//   map: {letter: paletteName}}})   rows = left halves when mirror; "." = clear;
//   name must start with prefix; duplicate names throw; <= 15 colors.
// DEVICE.registerSfx(group, {id: {ch: "DF", file, prio, ms} | {ch: "BEEP",
//   tones: [[hz, ms], ...], ui: bool}})   ids and DF file numbers exactly as in
//   the §2.6 table (they do not share a prefix: "lap", "finish", "send_out");
//   group is a label. Lint "sfxDup" (id registered twice), "sfxFile" (two ids
//   on one DF file). Core sounds: ui_move ui_ok ui_back ui_deny key_type
//   tick_in_band stage_up sweep_start block_perfect block_good block_miss
//   count_tick count_go link_lost boot rival_join mode_agree ready_go
//   link_back error victory defeat menu_bgm. ui: true = muted by "Clicks off".
// DEVICE.registerMessage(name, typeId, fields, {kind: "mode"|"session"|"uplink", legacyLayout})
//   fields: "name:u8|i8|u16|i16", "name:u8[6]", ["name", count, [subfields]].
//   Header (version, type, src, dst, seq; 5 B) is added. > 64 B throws.
//   Top-level fields may not be called "name" or "hdr" (unpack uses them).
//   kind "mode" needs step:u16, phase:u8, flags:u8, match:u8 right after the
//   header (legacyLayout: only that step/phase/flags exist). Little-endian.
//   At start the §7.6 types are checked (lint "msgSize"): battle.state 0x41
//   47 B mode, race.input 0x04 23 B uplink, race.state 0x43 55 B mode,
//   adv.state 0x44 61 B mode. An "uplink" message a board sends with
//   ctx.send() reaches the running mode's central.message().
// DEVICE.registerScreen(id, def)     see SCREEN DEF
// DEVICE.registerSession(def)        screens-menu.js only; replaces the stub session
// DEVICE.registerMode(def)           see MODE DEF
// DEVICE.registerFixture(id, {titleKey, run(T)})   T = test API (see TEST HOOK)
// DEVICE.modes() -> [modeDef]        registered, visible (not hidden), sorted by order
// DEVICE.mode(idOrModeId) -> modeDef | null                                  [+]
// DEVICE.params(modeId) -> {key: value}   mode params (defaults < saved tuning < reset({params}))  [+]
// DEVICE.setParams(modeId, patch)         saved to localStorage pr.device.params.<id> [+]
// DEVICE.battleParams() -> battle prototype params (localStorage pr.params.v4,
//   read only; game_config.h defaults)                                     [+]
// DEVICE.onStart(fn(dom))   called after the DOM is built: dom = {root,
//   toolbar, debug, handhelds: [{shell, canvas, controls, buttons, pad, stick}]}
//   (device-debug.js)                                                       [+]
// DEVICE.on(name, fn)       "reset" (world rebuilt), "tab" (fn(swapped): Tab
//   was pressed, the core has already swapped the key groups), "frame"
//   (fn({p, rects, stats}): rects pushed by this present(), for the
//   "show changed blocks" flash)                                           [+]
// DEVICE.onLobby(fn(ctx, msg, prev))   every lobby message on every board,
//   whatever screen or overlay is up: the session file turns its ev_* events
//   (LEFT, QUIT, LOGOUT...) into ctx.toast() here. The core itself already
//   toasts dev.core.pauseLater to the board whose PAUSE was deferred.     [+]
// DEVICE.defaultSettings() -> fresh default settings (S09 "S: restore")   [+]
// DEVICE.stubMode(opts) / DEVICE.stubScreen(id, def)   placeholder builders
//   used by the step-0 stub files and the echo mode (see section 12)        [+]
//
// ======================= SCREEN DEF =======================
//
// DEVICE.registerScreen("race.hud", {
//   enter(ctx, params), exit(ctx),
//   input(ctx, ev),          // edge events (§8.6); the overlay gets them first
//   tick(ctx, dt),           // every TICK_MS
//   state(ctx, msg, prev),   // each new state message: system screens get
//                            //   "lobby", mode screens (id prefix = the mode's
//                            //   stateMsg prefix, e.g. "race.") their mode state
//   draw(ctx, g),            // required; immediate mode, whole screen each frame
//   overlay: false, local: false, secret: false,
//   fps: 30 | (ctx) => n, repeat: {delay: 400, rate: 200}, toastY: 14,
//   toastX: [0, 128],        // [+] toast strip x and width (racing: [24, 80])
//   holdBarAt: [86, 147, 38, 12],  // [+] where the core draws the hold-M bar
//   antennaAt: [116, 3],     // [+] where the "no signal" / "paused" icon
//                            //     blinks while the screen is quiet
//   linger(ctx) -> ms,       // overlays: keep showing this long after the
//                            //   condition ends (ctx.lingering is then true)
//   bot(ctx, ctl),
// });
// Ids: local pages login login.name login.avatar login.color settings
// settings.cal (local: true, only via ctx.go); system boot connect menu lobby
// results; overlays ov.pause ov.nosignal ov.linklost ov.error ov.confirm;
// mode screens battle.pick battle.hud race.pick race.hud adv.pick adv.room.
// The boot screen ends itself with ctx.local.booted = true.
// After every screen or overlay change, presses ("down", "click", "long",
// stick edges) are ignored for 150 ms (SCREEN_LOCK_MS); a stick already
// pushed on entry counts only after it comes back to the middle.
// Overlays get every state message (lobby and mode) and all input while up;
// the MENU "long" reaches an overlay (S17's hold-M quit); the hold-M pause
// bar is drawn only for mode screens, so an overlay draws its own progress
// with ctx.held("MENU").
//
// BOTS (DEVICE.bot(p, true), §8.3): every tick, before input is read. With
// an overlay up only the overlay's bot runs. Otherwise the screen's bot runs,
// then the mode's bot, but the mode's bot only on the mode's own screens
// (its stateMsg prefix: race.pick, race.hud; never results or menus); when
// it stops, whatever it held is let go. ctl = {press(btn, ms = 50),
// hold(btn, down), stick(x, y), pressure(0..255), rng: {int(n), float()}}
// (rng = the bot.<p> stream; never Math.random). A bot's presses are held
// back until the 150 ms lock has passed, so it may act on its first tick.
//
// ======================= MODE DEF =======================
//
// DEVICE.registerMode({
//   id: "racing", modeId: 1, order: 1, titleKey, subKey, subVars(params), icon,
//   coop, status: "firmware"|"prototype", needsStick, hidden [+], stateMsg,
//   params: [{key, c, labelKey, min, max, step, def, unit}], rules: {...},
//   lobby: {badgeKey, badgeVars(params), goals: [k1, k2], keys: [[icon, nameKey, whatKey], ...]},
//   central: {periodMs, create(api, opts) -> {
//     tick(now) (every TICK_MS while not paused; use api.gameNow() for clocks
//       that must stop during a pause), action(p, action, arg, data, info) -> bool
//       (also called while paused: the mode decides, §4.11), input(p, fields)
//       (every MSG_INPUT: joyX joyY buttons pressure ui; also while paused),
//     message(p, name, fields), snapshot() -> fields, over() -> null |
//     {winner: 0|1|null, coop, quit: p|null, res: [u8 x4]}, canPause(p) ->
//     "now"|"defer"|"no", pause(), resume(), debug(cmd, arg) (DEVICE.debug),
//     quit(p) [+] session QUIT: end the match so over() reports quit: p and
//       both boards reach S19. Implement it: without it QUIT just ends the
//       mode and both boards go straight back to the menu.
//     carry() [+] (state kept by a retry-room rematch -> opts.carry) }},
//     opts = {first, params, profiles, rematch, retryRoom, carry}
//   player: {create(ctx) -> m, destroy(ctx), onState(ctx, msg, prev),
//     tick(ctx, dt), route(ctx) -> id | {id, params}, busy(ctx) -> bool,
//     inputBits(ctx) -> u8 (bits 4-7 of heartbeat buttons), pauseItems:
//       [{labelKey, confirmKey, action, arg}] (S15 lists them after Quit; on
//       confirm it sends ctx.rt(action, arg)),
//     heartbeat: true | false | (ctx) => bool (false: the core skips MSG_INPUT
//       while in the mode, except on pick / results screens and while paused),
//     uplink(ctx, {joyX, joyY, buttons, pressure}) -> same [+]: patch each
//       MSG_INPUT this board sends while in the mode (inputBits already ORed
//       in; pressure is the pad, or without a pad the padLevel equivalent of
//       holding A). Adventure: the 6 s no-pad winch cap and 1 s re-hold (§6.3).
//     newMatch(ctx, msg, prev) -> bool [+]: legacy layouts only (no match
//       field: battle.state). The core takes the match number from the lobby,
//       which goes out just before the mode state; if that lobby was lost the
//       mode may say "msg starts a new match" (battle: GAME_OVER -> SEND_OUT)
//       and m is re-created at once (normally not again when the lobby
//       catches up; under heavy loss it can be, so rebuild m from the state).
//     results(ctx) -> {titleKey, titleColor, scoreText, drawArt(g, ctx, x, y, w, h),
//       rows: [{labelKey, you, other} | {labelKey, shared, star}], noteKey,
//       noteVars, again: {labelKey, kind: "rematch"|"retryRoom"},
//       stats [+]: {battleWins, bestLapCs, advStars} for this board's profile:
//       the results screen passes it once to ctx.profiles.bumpStats after the
//       1.5 s lock. Decide noteKey ("NEW BEST!") before that and keep it in
//       ctx.m: after the bump the profile already holds the new record.
//       win [+]: true (won / cleared: confetti, "victory"), false ("defeat"),
//       null (neither: YOU QUIT, GAVE UP); sfx [+]: a sound id that replaces that
//       choice. The results screen plays it once on enter.}},
//   bot(ctx, ctl),
// });
// A new match (match field changed, or a different mode) calls
// player.destroy on the old m, then create, then onState(ctx, msg, null).
// Leaving the mode (the lobby says it ended) calls destroy and stops tone().
//
// ======================= SESSION + CENTRAL API =======================
//
// DEVICE.registerSession({create(api) -> {hello(p, profile, nonce),
//   ui(p, hover, presence), action(p, action, arg, data) -> bool, tick(now),
//   snapshot() -> lobby fields (host fills step, flags, centralBoot, match,
//   helloNonce), modeOver(result), pausePending [+] (optional [bool, bool],
//   shown by DEVICE.central())}})
// Lobby fields the session owns: phase (C.LOBBY), mode, hover[p] =
// (presence << 4) | card, vote, readyMask, rematchMask, pausedBy, wins
// (player * 3 + modeId), profile[2] (blank while that player's presence is
// LOGIN), modesBuilt, error (2 = E2), modeRes (over().res), and the latest
// event: evId (new value per event, never 0), evType (C.SEV.*), evWho (the
// player it is about). The core toasts dev.core.pauseLater to evWho when
// evType is PAUSE_LATER; other events are the session file's (DEVICE.onLobby).
// ?mode=x and DEVICE.reset({mode}) always use the core's stub session.
// api = {now(), rand(), randInt(n), step(), nextStep(), broadcast(), links(),
//   profiles(), pause(by), resume(), paused(), startMode(id, opts), endMode(),
//   mode(), match(), params, log(msg),
//   gameNow() [+] -> central ms without the time spent paused,
//   canPause(p) [+] -> mode's canPause or "now" ("no" without a mode),
//   over() [+] -> the running mode's over() or null,
//   quitMode(p) [+] -> mode.quit(p) if defined, else endMode()}
// startMode fills opts.carry from the outgoing instance's carry() when
// opts.retryRoom is set. Host rules (§8.7): one step counter (only
// nextStep() moves it; startMode / endMode call it), ACK for every action,
// turn actions (< 0x10) once per player per step, live actions (>= 0x10)
// deduplicated by counter window, 1 s silence -> LINK bit 0 + PAUSED (in a
// mode), flags bits 0-2 ORed into every state, lobby 10 Hz outside a mode,
// 1 Hz inside, and at once whenever a field changes. In one tick the lobby
// goes out before the mode state; frames from one board are never
// reordered on the air (only lost).
//
// ======================= HANDHELD CONTEXT ctx =======================
//
// ctx = {p, now(), gameNow(), g, input, hw: {caps: {joy, pad, snd}, invert(ms), shake()},
//   lobby, state, stateAge(), link: {up, gotState, rxPerSec, helloAcked, inMode, match},
//   rival(), settings, s, m, local, t(key, vars), rng: {int(n), float()},
//   go(id, params), back(), confirm({textKey, vars, holdMs, c, onYes, onNo}) ([+] c = text colour),
//   profiles: {list(), current(), select(slot, guestProfile), save(slot, profile),
//     remove(slot), logout(), bumpStats({battleWins, bestLapCs, advStars}) -> {newBest}},
//   [+] current() also carries matchColor: null, or the colour P2 plays this match
//   in because its saved colour was the rival's (§2.2; me() / color() / HELLO use it)
//   saveSettings(patch), setLanguage(lang), setHover(card),
//   act(action, arg, data), rt(action, arg, data) -> bool, send(msgName, fields),
//   sendInputNow(), padLevel(st, dt), sfx(id), tone(hz),
//   fx: {wipe(), border(color, ms), pop(text, x, y, color), dissolve(x, y, w, h)},
//   toast(key, vars, ms),
//   [+] screenId, overlayId, lingering, me() -> my profile | null,
//   [+] color() -> my palette color name, padOn() -> pad in use (settings + detection),
//   [+] held(btn) -> ms the button has been held (0 = up), mode() -> running mode def,
//   [+] params(modeId) -> DEVICE.params, error() -> null | {code, board, central},
//   [+] closeConfirm(yes), setPresence(v | null) (pause settings subpage = 2;
//       cleared when that overlay closes), hw.protocol (this board's flashed
//       protocol version), hw.channel (radio channel now), hw.fwBuild}
// ctx.local = {booted, stack: [{id, params}], loggedIn, confirm, hover,
//   flashReset [+] (the stored profiles were unreadable and were reset: W3), ...}
//   It lives in RAM for the whole power-on (screens keep things like the
//   last session event id they toasted here; ctx.s is new on every enter).
// Time: ctx.now() = this board's clock (its own offset; never compare two
// boards' clocks), ctx.gameNow() = the same without the time the state said
// PAUSED. Random: ctx.rng (decoration, fx.<p> stream), api.rand* (rules,
// central stream), ctl.rng (bots). Never Math.random / Date / performance.now.
// The core does for every screen: hold-M pause (+ progress bar), presence in
// the heartbeat, mode create / destroy on a new match, stack clearing (mode
// start, central reboot, logout), the wipe on every screen change, linger,
// the 150 ms input lock after a screen change, toasts, fx layers.
//
// ======================= DRAWING g (per handheld) =======================
//
// Before each frame the back buffer is cleared to "void". Colors are palette
// names (unknown -> throws); coordinates are floored; drawing is clipped.
// g.clear(c); g.rect(x, y, w, h, c); g.frame(x, y, w, h, c, t = 1)
// g.dither(x, y, w, h, c1, c2)   (c2 null = transparent); g.hline(x, y, w, c);
// g.vline(x, y, h, c); g.px(x, y, c)
// g.text(x, y, str, {c, font: "m"|"s", scale, align: "l"|"c"|"r", w, key}) -> {w, h}
//   (x, y) = top-left of the 14 px text row (x = middle / right edge for c / r);
//   m glyphs at +1, s glyphs and icons at +3 (times scale). m: CJK 12 px,
//   ASCII 6 px; s: 5x7 ASCII in a 6 px cell, plus "\x01".."\x08" = → ← ↑ ↓ ✓ ✗ ★ °
//   (DEVICE.SSYM). Icons 8 px + 2 px gap; {PAD} draws {A} without a pad.
//   Over budget w -> 1 px danger box + lint "overflow".
// g.textBox(x, y, w, h, str, opt) -> {lines, overflow}; g.measure(str, opt) -> {w, h}
// g.sprite(name, x, y, {scale, flipX, flipY, transpose, frame, color, map [+]})
//   color = whole sprite in one color; map = per-letter color overrides
// g.spriteSize(name) -> {w, h, frames}; g.clip(x, y, w, h); g.unclip()
// g.overBudgetOk [+]: a screen sets it to true while drawing a frame that may
//   go over the §7.2 SPI budget on purpose (a simulator-only look, e.g. the
//   full-detail 3D racing views, §5.10): still counted in overBudget, no
//   redFrame lint. Cleared before every frame.
// g.stats() -> {fps, px, rects, bytes, spiMs, level}; g.present() (core calls it)
//
// DEVICE.ui: topBar(g, ctx, titleKey, {right, signal, title [+], vars [+], titleW [+]}),
//   hintBar(g, ctx, [[icon, key, vars], ...], {disabled, blink}) (icon "A" "B" "S"
//   "M" "STICK" "PAD" "LR" or null; [+] a cell after a full 30 px label moves 2 px
//   right when its own label is <= 28 px), list(g, x, y, w, items, sel, {rowH, disabled})
//   (items: string | {label, value, arrows, disabled}), hpBar(g, x, y, w, hp, max, {h}),
//   petCard(g, x, y, petIdx, {hp, max, selected, fainted, hidden, scale, color, w, h}),
//   avatar(g, x, y, profile, {scale}), signal(g, x, y, bars),
//   bandBar(g, x, y, w, h, {center, width, level, inside}),
//   banner(g, ctx, key, vars, {c, scale, y, x [+], w [+]}),
//   pickScreen(g, ctx, {titleKey, badgeKey, noteKey, sel, locked, statusKey,
//     statusVars, info: [k1, k2], cards: [{pet, line1, line2, disabled, takenBy,
//     mark}], hints [+]}), pickInput(ctx, ev, st, {count, canPick(i), bUnlocks})
//   -> {pick: i} | {unlock: true} | null, dim(g), panel(g, x, y, w, h)
// Shared sprites: pet.ember pet.tide pet.sprout, av.kid av.robot av.cat,
// ui.mode.battle ui.mode.race ui.mode.adv ui.mode.settings, ui.car ui.carDiag,
// icon.A icon.B icon.S icon.M icon.STICK icon.PAD icon.OK icon.NO icon.STAR
// icon.L icon.R icon.UP icon.DN icon.DEL icon.DICE icon.GEAR icon.heart
// icon.heartEmpty icon.bolt icon.flame icon.drop icon.leaf icon.shield
// icon.hourglass icon.antenna icon.pause. Tables: DEVICE.PALETTE, DEVICE.PETS,
// DEVICE.AVATARS, DEVICE.PLAYER_COLORS, DEVICE.guestProfile(rng).
//
// ======================= INPUT =======================
//
// ctx.input = {x, y (-100..100, + = up), a, b, skill, menu, pressure (0..255),
//   padPresent, aDownMs, bDownMs, stickClick, aBtn [+] (A without the stick
//   click: trial, throttle and winch "hold A" use this), raw: {fsr, joyX, joyY}}
//   Only this board's input; the central sees each player's MSG_INPUT in
//   central.input(p, fields).
// ev = {btn: "A"|"B"|"SKILL"|"MENU"|"UP"|"DOWN"|"LEFT"|"RIGHT",
//   type: "down"|"up"|"click" (released < 500 ms)|"long" (held 1000 ms)|"repeat",
//   t (board ms), fromStick [+] (A came from the stick click)}
// Keyboard (event.code, so layout / IME do not matter):
//          stick     A   B   SKILL  MENU  pad hard (230)  pad light (130)
//   P1     W A S D   F   G   R      T     V               C
//   P2     arrows    K   L   I      O     ,               .
//   ` (Backquote) pauses / resumes the simulation; Tab swaps which handheld
//   each key group drives (DEVICE.keySwap(), badge in the toolbar), then
//   tells DEVICE.on("tab").
// Touch / mouse: under each screen a virtual stick (drag, dead zone 15),
// A / B / S / M buttons and a vertical pressure bar (finger height = force).
// Pad force goes through a simulated FSR (lag 120 / 60 ms, seeded +-3 noise,
// 12-bit raw reading) and settings.padCal into pressure 0..255.
//
// ======================= TEST HOOK window.DEVICE =======================
//
// DEVICE.ready; DEVICE.reset({seed, skipBoot, profiles, mode, loss, latency,
//   collisions, pad, caps, freshFlash [+], params [+], battleParams [+]});
//   pause(); resume(); step(ms); now();   params = {modeId: {key: value}} and
//   battleParams = {key: value} (DEVICE.battleParams keys): this world only,
//   win over saved tuning, never written to localStorage (fixtures pass the
//   values they depend on). mode = start it at once with the stub session.
// press(p, btn, holdMs = 50) (btn also "UP".."RIGHT", "PAD", "PAD_LIGHT", "STICK");
// hold(p, btn, down); stick(p, x, y); pressure(p, v); bot(p, on);
//   (unlike a bot's, these are not held back: a script, like a person, loses
//   a press made within 150 ms of a screen change, so step(200) after one)
// screen(p) -> {id, overlay, mode, params}; texts(p); find(p, substr);
// pixels(p); hash(p); png(p, scale = 4); central(); radio.set({loss, latency,
// collisions}); radio.stats(); radio.unplug(p, on); radio.powerCentral(on);
// radio.channel(p, ch) (p = "central" or -1 [+]: the central board);
// radio.version(node, v) [+]; reboot(p); rules(modeId);
// fixtures(); fixture(id) -> Promise<{id, ok, error, log, shots}>; stats(p); lint();
// errors() -> [{where, message, stack, t, count}] (one entry per distinct error);
// msgSizes(); msgSize(name); glyphs(); sfxLog(p); exportStrings();
// pack(name, obj, hdr); unpack(bytes); trial; padLevel; ui; C; opts.
// Inside a fixture, T = DEVICE + {log(msg), assert(cond, msg), shot(label)
// [+]}; the simulation does not run by itself while it runs (use T.step).
// shot() keeps both screens (PNG ×2, screen ids, SPI stats) for the gallery:
// fixture(id) -> Promise<{id, ok, error, log, shots: [{label, screens, stats, png}]}>.
// URL: ?seed=N ?test=1 ?view=p1|p2|both ?gallery ?fixture=id ?pad=auto|on|off
//      ?mode=battle|racing|adventure|echo ?speed=0.25..2 ?scale=2|3|4
//      Without ?view a page under 900 px wide (phone) shows P1 only with P2
//      on its bot (§8.12); bot(p) without `on` says whether p is a bot [+];
//      outside ?test=1 a reset keeps who is a bot.
// [+] also: DEVICE.speed(v), seed(), world(), hh(p) (internal handheld object),
//     registry (registries), clearLint(), bytesToStr(arr), mapPressure(raw, min, max),
//     SSYM, KEYMAP, opts, rng(seed, name) (mulberry32 stream),
//     trial.defaults() / cfgFrom(battleParams) / endMs(cfg) / stageAt(t, cfg) /
//     ready(T) / pct(inside, scored), stubModeScreens(prefix, titleKey, hud),
//     debug(cmd, arg) (the running mode's central.debug; broadcasts next tick),
//     ctl(p, "script"|"pad"|"touch") (a ctl on that input source: gamepads go
//     on "pad"), caps(p, {joy, pad, snd}) (unplug the stick / pull the SD card
//     at run time; HELLO caps follow), keySwap(on) (Tab), world().fsrInverted
//     (FSR divider wired the other way), world().spiMhz (8 | 16).
//
// ======================= BASE MESSAGES (§7.6) =======================
//
// input 0x01 (10 B): joyX:i8 joyY:i8 buttons:u8 pressure:u8 ui:u8 (low nibble
//   menu cursor, 0xf off the menu; high nibble presence 0 login, 1 menu / lobby,
//   2 settings, 3 game)
// action 0x02 (13 B): step:u16 action:u8 arg:u8 flags:u8 (live-action counter) data:u8[3]
// hello 0x03 (16 B): nick:u8[6] avatar:u8 color:u8 caps:u8 bootNonce:u8 fwBuild:u8
//   (the C struct's name[6] is "nick" here: "name" is reserved by unpack)
// ack 0x40 (10 B): step:u16 ackedSeq:u8 accepted:u8 counter:u8
// lobby 0x42 (52 B): step:u16 phase:u8 flags:u8 centralBoot:u8 match:u8 mode:u8
//   hover:u8[2] vote:u8[2] readyMask:u8 rematchMask:u8 pausedBy:u8 wins:u8[6]
//   (player * 3 + modeId) profile[2]{name:u8[6] avatar:u8 color:u8}
//   helloNonce:u8[2] modesBuilt:u8 evId:u8 evType:u8 evWho:u8 error:u8 modeRes:u8[4]
// Reserved: echo.state 0x4e (core echo mode). Constants: DEVICE.C (MSG, ACT,
// LOBBY phases, FLAG, PRESENCE, SEV session events, NODE, protocol / controls values).

(() => {
  "use strict";

  const I18N = window.I18N || {lang: "zh", t: k => k, add() {}, set() {}, apply() {}};
  const LANG = I18N.lang === "en" ? "en" : "zh";

  /* ================= 1. constants, namespace, registries ================= */

  const C = Object.freeze({
    W: 128, H: 160,
    // protocol.h (v6 values)
    STATE_PERIOD_MS: 100, INPUT_PERIOD_MS: 100, ACTION_RETRY_MS: 60,
    PLAYER_TIMEOUT_MS: 1000, CENTRAL_TIMEOUT_MS: 1000, MAX_MSG: 64, PROTOCOL_VERSION: 6,
    HELLO_MS: 500, LOBBY_IDLE_MS: 100, LOBBY_MODE_MS: 1000,
    // controls_config.h
    CTL_PRESS_PRESENT: 30, CTL_PRESS_START: 40, CTL_PRESS_RELEASE: 20, CTL_PRESS_FULL: 220,
    CTL_JOY_PUSH: 60, CTL_JOY_RELEASE: 30, CTL_JOY_REPEAT_DELAY_MS: 400, CTL_JOY_REPEAT_MS: 200,
    // game_config.h (battle defaults; the tuning sliders win, DEVICE.battleParams)
    TRIAL_READY_MS: 600, TRIAL_STAGE_MS: 1500, TRIAL_STAGES: 3, TRIAL_BAND_PCT: 24,
    TRIAL_SPEEDS: Object.freeze([35, 65, 100]), TRIAL_RISE_PER_S: 140, TRIAL_FALL_PER_S: 140,
    TIER_STRONG_SCORE: 50, TIER_ULTIMATE_SCORE: 80,
    // simulator
    TICK_MS: 2, FRAME_MS: 33, CLICK_MS: 500, LONG_MS: 1000, SCREEN_LOCK_MS: 150,
    TOAST_MS: 1500, FSR_REST: 200, FSR_PEAK: 3500, SPI_MHZ: 8,
    BUDGET_GREEN: 5000, BUDGET_YELLOW: 12000,
    NODE: Object.freeze({CENTRAL: 0, P1: 1, P2: 2, BROADCAST: 0xff}),
    MSG: Object.freeze({INPUT: 0x01, ACTION: 0x02, HELLO: 0x03, RACE_INPUT: 0x04, ACK: 0x40,
      BATTLE_STATE: 0x41, LOBBY: 0x42, RACE_STATE: 0x43, ADV_STATE: 0x44, ECHO_STATE: 0x4e}),
    ACT: Object.freeze({SEND_OUT: 1, ATTACK: 2, SKILL: 3, DEFEND: 4, REMATCH_V5: 5, SWITCH: 6,
      VOTE: 0x10, READY: 0x12, LEAVE: 0x13, PAUSE: 0x14, REMATCH: 0x15, QUIT: 0x16,
      RACE_PICK: 0x20, RACE_SKILL: 0x21,
      ADV_PICK: 0x30, ADV_USE: 0x31, ADV_POWER: 0x32, ADV_PING: 0x33, ADV_SWAP: 0x34,
      ADV_CORE: 0x35, ADV_RESTART_ROOM: 0x36,
      STUB_PICK: 0x7a, STUB_PRESS: 0x7b, STUB_END: 0x7c}),
    LOBBY: Object.freeze({WAIT: 0, SELECT: 1, AGREED: 2, LOBBY: 3, IN_MODE: 4}),
    FLAG: Object.freeze({PAUSED: 1, P1_LINK: 2, P2_LINK: 4, ATTACKER_TRIAL: 8}),
    PRESENCE: Object.freeze({LOGIN: 0, MENU: 1, SETTINGS: 2, GAME: 3}),
    SEV: Object.freeze({NONE: 0, LEFT: 1, QUIT: 2, PAUSE_LATER: 3, LOGOUT: 4, REMATCH: 5}),
    BTN_BIT: Object.freeze({A: 1, B: 2, SKILL: 4, MENU: 8}),
    NO_PET: 0xff, NONE: 0xff,
  });

  const DEVICE = window.DEVICE = {C, version: "0.1"};
  const R = {   // registries
    screens: {}, modes: [], session: null, fixtures: {}, sprites: {}, sfx: {},
    msgs: {}, msgByType: {}, strings: {keys: new Set(), zh: {}, en: {}, cjk: new Set()},
    startHooks: [], listeners: {}, lobbyHooks: [],
  };
  const lints = [], lintSeen = new Set(), errors = [];
  let world = null;     // the simulation (section 12c)

  function lint(kind, where, detail) {
    const k = kind + "|" + where + "|" + JSON.stringify(detail === undefined ? null : detail);
    if (lintSeen.has(k)) return;
    lintSeen.add(k);
    lints.push({kind, where, detail});
  }
  // The same error from a callback that runs every tick is kept once, with a
  // count (and logged to the console once), so it cannot flood devtools
  const errorSeen = new Map();
  function recordError(where, e) {
    const message = e && e.message ? e.message : String(e);
    const k = where + "|" + message, old = errorSeen.get(k);
    if (old) { old.count++; return; }
    const rec = {where, message, stack: e && e.stack ? String(e.stack) : "", t: world ? world.clock : 0, count: 1};
    if (errors.length < 200) { errors.push(rec); errorSeen.set(k, rec); }
    if (!world || !world.test) console.error("[device] " + where + ": " + message, e);
  }
  // Run a module callback; errors are recorded, never thrown
  function safe(where, fn, ...args) {
    try { return fn(...args); } catch (e) { recordError(where, e); return undefined; }
  }
  function emit(name, arg) {
    for (const fn of R.listeners[name] || []) safe("on:" + name, fn, arg);
  }
  DEVICE.on = (name, fn) => { (R.listeners[name] = R.listeners[name] || []).push(fn); };
  DEVICE.onStart = fn => { R.startHooks.push(fn); if (DEVICE._dom) safe("onStart", fn, DEVICE._dom); };
  DEVICE.onLobby = fn => { R.lobbyHooks.push(fn); };

  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);

  /* ================= 2. random numbers ================= */

  function hashStr(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // Independent named streams: central, radio, bot.0/1, fx.0/1, input.0/1, world
  function makeStream(seed, name) {
    const f = mulberry32((seed ^ hashStr(name)) >>> 0);
    return {name, float: f, int: n => Math.floor(f() * n)};
  }
  DEVICE.rng = makeStream;

  /* ================= 3. palette and drawing ================= */

  const PALETTE_DEF = [
    ["void", 0x10A4], ["panel", 0x2127], ["line", 0x41EB], ["muted", 0x8C74],
    ["white", 0xFFFF], ["fireDk", 0x5943], ["fire", 0xE327], ["gold", 0xF569],
    ["waterDk", 0x19CB], ["water", 0x347A], ["waterLt", 0x9EBE], ["grassDk", 0x2243],
    ["grass", 0x4CE7], ["grassLt", 0xA6CE], ["accent", 0x841F], ["danger", 0xDA48],
  ];
  const COLOR = {};
  const RGB = new Uint32Array(16);     // ABGR for ImageData (little-endian)
  const PALETTE = PALETTE_DEF.map(([name, v], i) => {
    const r5 = v >> 11, g6 = (v >> 5) & 63, b5 = v & 31;
    const r = (r5 << 3) | (r5 >> 2), g = (g6 << 2) | (g6 >> 4), b = (b5 << 3) | (b5 >> 2);
    COLOR[name] = i;
    RGB[i] = (0xff << 24 | b << 16 | g << 8 | r) >>> 0;
    const hex = "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
    return Object.freeze({index: i, name, rgb565: v, hex});
  });
  DEVICE.PALETTE = Object.freeze(PALETTE);
  function col(c) {
    const i = COLOR[c];
    if (i === undefined) throw new Error("unknown color: " + c);
    return i;
  }

  const W = C.W, H = C.H;

  function makeGfx(hh) {
    const back = new Uint8Array(W * H);
    const front = new Uint8Array(W * H).fill(255);   // power-on: nothing valid on the glass
    let cx0 = 0, cy0 = 0, cx1 = W, cy1 = H;
    let wipeFrame = -1;
    const st = {fps: 0, px: 0, rects: 0, bytes: 0, spiMs: 0, level: "green"};
    const presentTimes = [];
    let lastRed = -1e9;

    function put(x, y, i) {
      if (x < cx0 || y < cy0 || x >= cx1 || y >= cy1) return;
      back[y * W + x] = i;
    }
    function fill(x, y, w, h, i) {
      x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
      const x0 = Math.max(x, cx0), y0 = Math.max(y, cy0), x1 = Math.min(x + w, cx1), y1 = Math.min(y + h, cy1);
      // a rect wholly left of the clip would give a negative end on row 0, and
      // TypedArray.fill counts that from the end of the buffer (found by gfx.c's fuzz)
      if (x1 <= x0) return;
      for (let yy = y0; yy < y1; yy++) back.fill(i, yy * W + x0, yy * W + x1);
    }

    const g = {
      hh,
      clear(c) { back.fill(col(c)); },
      rect(x, y, w, h, c) { if (w > 0 && h > 0) fill(x, y, w, h, col(c)); },
      frame(x, y, w, h, c, t = 1) {
        const i = col(c);
        fill(x, y, w, t, i); fill(x, y + h - t, w, t, i);
        fill(x, y + t, t, h - 2 * t, i); fill(x + w - t, y + t, t, h - 2 * t, i);
      },
      dither(x, y, w, h, c1, c2) {
        const i1 = col(c1), i2 = c2 == null ? -1 : col(c2);
        x = Math.floor(x); y = Math.floor(y);
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
          const i = ((x + xx + y + yy) & 1) === 0 ? i1 : i2;
          if (i >= 0) put(x + xx, y + yy, i);
        }
      },
      hline(x, y, w, c) { fill(x, y, w, 1, col(c)); },
      vline(x, y, h, c) { fill(x, y, 1, h, col(c)); },
      px(x, y, c) { put(Math.floor(x), Math.floor(y), col(c)); },
      clip(x, y, w, h) {
        cx0 = clamp(Math.floor(x), 0, W); cy0 = clamp(Math.floor(y), 0, H);
        cx1 = clamp(Math.floor(x + w), 0, W); cy1 = clamp(Math.floor(y + h), 0, H);
      },
      unclip() { cx0 = 0; cy0 = 0; cx1 = W; cy1 = H; },
      text(x, y, str, opt) { return drawText(g, hh, x, y, str, opt || {}); },
      measure(str, opt) { return measureText(hh, str, opt || {}); },
      textBox(x, y, w, h, str, opt) { return drawTextBox(g, hh, x, y, w, h, str, opt || {}); },
      sprite(name, x, y, opt) { drawSprite(put, name, x, y, opt || {}); },
      spriteSize(name) {
        const s = R.sprites[name];
        if (!s) throw new Error("unknown sprite: " + name);
        return {w: s.w, h: s.h, frames: s.frames.length};
      },
      stats() { return Object.assign({}, st); },
      _put: put,
      _back: back,
      _front: front,
      wipe() { wipeFrame = 0; },
      get wiping() { return wipeFrame >= 0; },
      overBudgetOk: false,
      begin() { back.fill(0); g.unclip(); g.overBudgetOk = false; },
      // §8.5 present(): compare 8x8 blocks, merge runs per 8-row band, push
      // only the changed rects (4 frames of 32 px strips while wiping)
      present(now) {
        let px = 0, rects = 0;
        const pushed = [];
        const strip = wipeFrame;
        for (let by = 0; by < H / 8; by++) {
          let run = -1;
          for (let bx = 0; bx <= W / 8; bx++) {
            let changed = false;
            if (bx < W / 8 && (strip < 0 || (bx >> 2) === strip)) {
              const base = by * 8 * W + bx * 8;
              for (let r = 0; r < 8 && !changed; r++) {
                const o = base + r * W;
                for (let c = 0; c < 8; c++) if (back[o + c] !== front[o + c]) { changed = true; break; }
              }
            }
            if (changed && run < 0) run = bx;
            if (!changed && run >= 0) {
              pushed.push([run * 8, by * 8, (bx - run) * 8, 8]);
              rects++; px += (bx - run) * 64; run = -1;
            }
          }
        }
        for (const [x, y, w, h] of pushed) {
          for (let yy = y; yy < y + h; yy++) front.set(back.subarray(yy * W + x, yy * W + x + w), yy * W + x);
        }
        if (wipeFrame >= 0 && ++wipeFrame > 3) wipeFrame = -1;
        const bytes = px * 2 + rects * 11;
        const mhz = world ? world.spiMhz : C.SPI_MHZ;
        st.px = px; st.rects = rects; st.bytes = bytes;
        st.spiMs = bytes * 8 / (mhz * 1000) + rects * 0.03;
        st.level = px <= C.BUDGET_GREEN ? "green" : px <= C.BUDGET_YELLOW ? "yellow" : "red";
        presentTimes.push(now);
        while (presentTimes.length && presentTimes[0] <= now - 1000) presentTimes.shift();
        st.fps = presentTimes.length;
        if (st.level === "red" && strip < 0) {
          // one-off transitions may be red, at most once per 300 ms
          if (now - lastRed < 300) { hh.overBudget++; if (!g.overBudgetOk) lint("redFrame", "P" + (hh.p + 1) + " " + hh.screenId, {px}); }
          lastRed = now;
        }
        return pushed;
      },
    };
    return g;
  }

  /* ================= 4. fonts ================= */

  // s font: classic 5x7, column bytes (bit 0 = top row), ASCII 0x20..0x7E
  const S_FONT_HEX =
    "0000000000" + "00005f0000" + "0007000700" + "147f147f14" + "242a7f2a12" + "2313086462" + "3649552250" + "0005030000" +
    "001c224100" + "0041221c00" + "14083e0814" + "08083e0808" + "0050300000" + "0808080808" + "0060600000" + "2010080402" +
    "3e5149453e" + "00427f4000" + "4261514946" + "2141454b31" + "1814127f10" + "2745454539" + "3c4a494930" + "0171090503" +
    "3649494936" + "064949291e" + "0036360000" + "0056360000" + "0814224100" + "1414141414" + "0041221408" + "0201510906" +
    "324979413e" + "7e1111117e" + "7f49494936" + "3e41414122" + "7f4141221c" + "7f49494941" + "7f09090901" + "3e4149497a" +
    "7f0808087f" + "00417f4100" + "2040413f01" + "7f08142241" + "7f40404040" + "7f020c027f" + "7f0408107f" + "3e4141413e" +
    "7f09090906" + "3e4151215e" + "7f09192946" + "4649494931" + "01017f0101" + "3f4040403f" + "1f2040201f" + "3f4038403f" +
    "6314081463" + "0708700807" + "6151494543" + "007f414100" + "0204081020" + "0041417f00" + "0402010204" + "4040404040" +
    "0001020400" + "2054545478" + "7f48444438" + "3844444420" + "384444487f" + "3854545418" + "087e090102" + "0c5252523e" +
    "7f08040478" + "00447d4000" + "2040443d00" + "7f10284400" + "00417f4000" + "7c04180478" + "7c08040478" + "3844444438" +
    "7c14141408" + "081414187c" + "7c08040408" + "4854545420" + "043f444020" + "3c4040207c" + "1c2040201c" + "3c4030403c" +
    "4428102844" + "0c5050503c" + "4464544c44" + "0008364100" + "00007f0000" + "0041360800" + "0804081008";
  // s font symbols 0x01..0x08: → ← ↑ ↓ ✓ ✗ ★ °
  const S_SYM_HEX = "08082a1c08" + "081c2a0808" + "04027f0204" + "10207f2010" + "1830180c06" + "2214081422" + "442c1f2c44" + "0006090906";
  DEVICE.SSYM = Object.freeze({RIGHT: "\x01", LEFT: "\x02", UP: "\x03", DOWN: "\x04", OK: "\x05", NO: "\x06", STAR: "\x07", DEG: "\x08"});

  // glyph = {w, h, bits: Uint8Array(w*h)}
  function colsToGlyph(hex, rowsMap) {
    const cols = [];
    for (let i = 0; i < 5; i++) cols.push(parseInt(hex.substr(i * 2, 2), 16));
    const h = rowsMap ? rowsMap.length : 7;
    const bits = new Uint8Array(5 * h);
    for (let y = 0; y < h; y++) {
      const sy = rowsMap ? rowsMap[y] : y;
      for (let x = 0; x < 5; x++) bits[y * 5 + x] = (cols[x] >> sy) & 1;
    }
    return {w: 5, h, bits};
  }
  const S_GLYPHS = {};
  for (let i = 0; i < 95; i++) S_GLYPHS[String.fromCharCode(0x20 + i)] = colsToGlyph(S_FONT_HEX.substr(i * 10, 10));
  for (let i = 0; i < 8; i++) S_GLYPHS[String.fromCharCode(1 + i)] = colsToGlyph(S_SYM_HEX.substr(i * 10, 10));
  // m font ASCII fallback (deterministic, no system font): the 5x7 glyphs with
  // rows 1 and 5 doubled -> 5x9, drawn at row 1 of the 6x12 cell. Replaced by
  // DEVICE_FONT_M once make_font.py has exported the real 6x12 glyphs.
  const M_ROWS = [0, 1, 1, 2, 3, 4, 5, 5, 6];
  const M_ASCII = {};
  for (let i = 0; i < 95; i++) M_ASCII[String.fromCharCode(0x20 + i)] = colsToGlyph(S_FONT_HEX.substr(i * 10, 10), M_ROWS);
  // Real descenders for g j p q y (the 5x7 ones sit raised): full 12-row cells
  const M_DESC = {
    g: ["", "", "", "", ".####", "#...#", "#...#", "#...#", "#...#", ".####", "....#", ".###."],
    j: ["", "...#.", "", "", "..##.", "...#.", "...#.", "...#.", "...#.", "...#.", "...#.", ".##.."],
    p: ["", "", "", "", "####.", "#...#", "#...#", "#...#", "#...#", "####.", "#....", "#...."],
    q: ["", "", "", "", ".####", "#...#", "#...#", "#...#", "#...#", ".####", "....#", "....#"],
    y: ["", "", "", "", "#...#", "#...#", "#...#", "#...#", "#...#", ".####", "....#", ".###."],
  };
  for (const [ch, rows] of Object.entries(M_DESC)) {
    const bits = new Uint8Array(5 * 12);
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) bits[y * 5 + x] = r[x] === "#" ? 1 : 0; });
    M_ASCII[ch] = {w: 5, h: 12, bits, full: true};
  }

  const M_PUNCT = "！？：，、。…「」";
  const isAscii = ch => ch >= " " && ch <= "~";
  const isCjk = ch => {
    const c = ch.codePointAt(0);
    return (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf);
  };
  const inMCharset = ch => isAscii(ch) || isCjk(ch) || M_PUNCT.includes(ch);
  const ICON_NAMES = ["A", "B", "S", "M", "STICK", "PAD", "OK", "NO", "STAR", "L", "R", "UP", "DN", "DEL", "DICE", "GEAR"];
  const KEY_ICONS = new Set(["A", "B", "S", "M", "STICK", "PAD"]);
  const TOKEN_RE = /\{([A-Z]+)\}/g;

  let fontTable = null;          // DEVICE_FONT_M decoded lazily: {ch: glyph}
  const mCache = new Map();
  const glyphUse = new Set(), glyphMissing = new Set();
  let fallbackCanvas = null;

  function decodeFontEntry(ch, b64) {
    const w = isAscii(ch) ? 6 : 12, h = 12;
    const raw = atob(b64);
    const bits = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) bits[i] = (raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
    return {w, h, bits, ox: 0, oy: 0};
  }
  function canvasGlyph(ch) {
    if (typeof document === "undefined") return null;
    if (!fallbackCanvas) {
      fallbackCanvas = document.createElement("canvas");
      fallbackCanvas.width = 16; fallbackCanvas.height = 16;
    }
    const c2 = fallbackCanvas.getContext("2d", {willReadFrequently: true});
    c2.clearRect(0, 0, 16, 16);
    c2.font = '12px "WenQuanYi Zen Hei Sharp", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", "WenQuanYi Zen Hei", sans-serif';
    c2.textBaseline = "alphabetic";
    c2.fillStyle = "#000";
    c2.fillText(ch, 0, 10);
    const data = c2.getImageData(0, 0, 12, 12).data;
    const bits = new Uint8Array(144);
    let any = 0;
    // alpha >= 96 keeps anti-aliased 12 px strokes whole (128 breaks them up)
    for (let i = 0; i < 144; i++) { bits[i] = data[i * 4 + 3] >= 96 ? 1 : 0; any |= bits[i]; }
    return any ? {w: 12, h: 12, bits, ox: 0, oy: 0} : null;
  }
  // -> glyph or null (missing); m font
  function mGlyph(ch) {
    if (mCache.has(ch)) return mCache.get(ch);
    let gl = null;
    if (fontTable === null && window.DEVICE_FONT_M) {
      fontTable = {};
      try {
        for (const [k, v] of Object.entries(window.DEVICE_FONT_M)) fontTable[k] = decodeFontEntry(k, v);
      } catch (e) { recordError("DEVICE_FONT_M", e); }
    }
    if (fontTable && fontTable[ch]) gl = fontTable[ch];
    else if (isAscii(ch)) gl = Object.assign({ox: 0, oy: M_ASCII[ch].full ? 0 : 1}, M_ASCII[ch]);
    else {
      if (!fontTable) lint("fallback", "font", "m font table not loaded: CJK drawn with canvas fillText");
      // [+] the table is loaded but lacks this character: the firmware would draw a
      // red box, so say so (the simulator still draws it with the system font)
      else lint("missingGlyph", "font", {ch, note: "not in device-font.js: re-run make_font.py"});
      gl = canvasGlyph(ch);
      if (!gl) glyphMissing.add(ch);
    }
    mCache.set(ch, gl);
    return gl;
  }

  // Split a string into tokens: {icon} objects or single characters
  function tokens(str) {
    const out = [], re = /\{([A-Z]+)\}/g;
    let last = 0, m;
    while ((m = re.exec(str))) {
      if (!ICON_NAMES.includes(m[1])) continue;
      for (const ch of str.slice(last, m.index)) out.push(ch);
      out.push({icon: m[1]});
      last = m.index + m[0].length;
    }
    for (const ch of str.slice(last)) out.push(ch);
    return out;
  }
  const tokW = (t, font) => typeof t === "object" ? 10 : font === "s" ? 6 : (t.charCodeAt(0) < 0x80 ? 6 : 12);

  function measureText(hh, str, opt) {
    const s = opt.scale || 1, font = opt.font || "m";
    let w = 0;
    for (const t of tokens(String(str == null ? "" : str))) w += tokW(t, font);
    return {w: w * s, h: 14 * s};
  }

  function blitBits(g, gl, x, y, s, ci) {
    const put = g._put;
    for (let yy = 0; yy < gl.h; yy++) for (let xx = 0; xx < gl.w; xx++) {
      if (!gl.bits[yy * gl.w + xx]) continue;
      if (s === 1) put(x + xx, y + yy, ci);
      else for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) put(x + xx * s + b, y + yy * s + a, ci);
    }
  }

  function drawText(g, hh, x, y, str, opt) {
    str = String(str == null ? "" : str);
    const s = opt.scale || 1, font = opt.font || "m", c = opt.c || "white";
    const ci = col(c);
    const toks = tokens(str);
    let w = 0;
    for (const t of toks) w += tokW(t, font);
    w *= s;
    const h = 14 * s;
    x = Math.floor(x); y = Math.floor(y);
    const x0 = opt.align === "c" ? x - Math.floor(w / 2) : opt.align === "r" ? x - w : x;
    let cx = x0;
    for (const t of toks) {
      if (typeof t === "object") {
        drawIcon(g, hh, t.icon, cx, y + 3 * s, s, c);
        cx += 10 * s;
        continue;
      }
      if (font === "s") {
        const gl = S_GLYPHS[t];
        if (gl) blitBits(g, gl, cx, y + 3 * s, s, ci);
        else {
          g.rect(cx, y + 3 * s, 5 * s, 7 * s, "danger");
          lint("sFont", hh ? hh.screenId : "?", {ch: t, s: str});
        }
        cx += 6 * s;
      } else {
        const adv = t.charCodeAt(0) < 0x80 ? 6 : 12;
        if (t !== " ") {
          const gl = mGlyph(t);
          if (!isAscii(t)) glyphUse.add(t);
          if (gl) blitBits(g, gl, cx + (gl.ox || 0) * s, y + (1 + (gl.oy || 0)) * s, s, ci);
          else {
            g.frame(cx + s, y + 2 * s, (adv - 2) * s, 10 * s, "danger");
            lint("missingGlyph", hh ? hh.screenId : "?", {ch: t});
          }
        }
        cx += adv * s;
      }
    }
    if (opt.w && w > opt.w) {
      g.frame(x0 - 1, y, w + 2, h, "danger");
      lint("overflow", hh ? hh.screenId : "?", {key: opt.key || (hh && hh.tmap.get(str)) || null, lang: LANG, width: w, budget: opt.w, s: str});
    }
    if (hh && hh.texts) hh.texts.push({s: str, key: opt.key || hh.tmap.get(str) || null, x: x0, y, w, h, font, c});
    return {w, h};
  }

  function drawIcon(g, hh, name, x, y, s, textColor) {
    if (name === "PAD" && hh && !hh.padOn()) name = "A";
    const opt = {scale: s};
    if (textColor === "line") opt.color = "line";
    else if (!KEY_ICONS.has(name) && name !== "STAR") opt.color = textColor;
    g.sprite("icon." + name, x, y, opt);
  }

  // Word wrap: Chinese anywhere, English only at spaces (§2.3)
  function wrapLines(hh, str, w, opt) {
    const font = opt.font || "m", s = opt.scale || 1;
    const lines = [];
    for (const para of String(str).split("\n")) {
      const units = [];
      let cur = "";
      for (const t of tokens(para)) {
        const ch = typeof t === "object" ? "{" + t.icon + "}" : t;
        const breakable = typeof t === "object" || t === " " || t.charCodeAt(0) >= 0x80;
        if (breakable) { if (cur) units.push(cur); units.push(ch); cur = ""; } else cur += ch;
      }
      if (cur) units.push(cur);
      let line = "";
      for (const u of units) {
        const next = line + u;
        if (line && measureText(hh, next, {font, scale: s}).w > w) {
          lines.push(line.replace(/ +$/, ""));
          line = u === " " ? "" : u;
        } else line = next;
      }
      lines.push(line.replace(/ +$/, ""));
    }
    return lines;
  }
  function drawTextBox(g, hh, x, y, w, h, str, opt) {
    const s = opt.scale || 1;
    const lines = wrapLines(hh, str, w, opt);
    const fit = Math.max(0, Math.floor(h / (14 * s)));
    const overflow = lines.length > fit;
    lines.slice(0, fit).forEach((ln, i) => drawText(g, hh, x, y + i * 14 * s, ln, Object.assign({}, opt, {w: undefined})));
    if (overflow) {
      g.frame(x - 1, y, w + 2, h, "danger");
      lint("overflow", hh ? hh.screenId : "?", {key: opt.key || (hh && hh.tmap.get(str)) || null, lang: LANG, lines: lines.length, fit, s: str});
    }
    return {lines, overflow};
  }

  /* ================= 5. sprites, shared art, DEVICE.ui ================= */

  DEVICE.registerSprites = function (prefix, defs) {
    for (const [name, def] of Object.entries(defs)) {
      if (!name.startsWith(prefix)) { lint("prefix", "sprite " + name, {prefix}); throw new Error("sprite " + name + " must start with " + prefix); }
      if (R.sprites[name]) throw new Error("duplicate sprite: " + name);
      const map = def.map || {};
      const colors = new Set(Object.values(map));
      if (colors.size > 15) lint("spriteColors", name, {colors: colors.size});
      for (const c of colors) col(c);
      if (def.mirror && def.w % 2) lint("spriteWidth", name, {w: def.w});
      const frames = def.frames.map((rows, fi) => {
        if (rows.length !== def.h) throw new Error("sprite " + name + " frame " + fi + ": " + rows.length + " rows, want " + def.h);
        return rows.map((r, ri) => {
          const full = def.mirror ? r + [...r].reverse().join("") : r;
          if (full.length !== def.w) throw new Error("sprite " + name + " row " + ri + ": width " + full.length + ", want " + def.w);
          for (const ch of full) if (ch !== "." && !(ch in map)) throw new Error("sprite " + name + ": letter " + ch + " not in map");
          return full;
        });
      });
      R.sprites[name] = {name, w: def.w, h: def.h, frames, map};
    }
  };

  function drawSprite(put, name, x, y, opt) {
    const sp = R.sprites[name];
    if (!sp) throw new Error("unknown sprite: " + name);
    const s = opt.scale || 1;
    const rows = sp.frames[(opt.frame || 0) % sp.frames.length];
    const one = opt.color ? col(opt.color) : -1;
    const map = opt.map ? Object.assign({}, sp.map, opt.map) : sp.map;
    const idx = {};
    for (const [k, v] of Object.entries(map)) idx[k] = col(v);
    const tw = opt.transpose ? sp.h : sp.w, th = opt.transpose ? sp.w : sp.h;
    x = Math.floor(x); y = Math.floor(y);
    for (let dy = 0; dy < th; dy++) for (let dx = 0; dx < tw; dx++) {
      let sx = opt.flipX ? tw - 1 - dx : dx, sy = opt.flipY ? th - 1 - dy : dy;
      if (opt.transpose) { const t = sx; sx = sy; sy = t; }
      const ch = rows[sy][sx];
      if (ch === ".") continue;
      const ci = one >= 0 ? one : idx[ch];
      if (s === 1) put(x + dx, y + dy, ci);
      else for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) put(x + dx * s + b, y + dy * s + a, ci);
    }
  }

  // Pets: battle.js SPRITES; o, m -> *Dk, f -> base, l -> light (Ember: gold), e -> void, h -> white
  const petMap = (dk, f, l) => ({o: dk, m: dk, f, l, e: "void", h: "white"});
  DEVICE.registerSprites("pet.", {
    "pet.ember": {w: 10, h: 10, mirror: true, map: petMap("fireDk", "fire", "gold"),
      frames: [["...o.", "..olo", ".olff", "olfff", "ofhef", "offff", "offfm", "olfff", ".olff", "..ooo"]]},
    "pet.tide": {w: 10, h: 10, mirror: true, map: petMap("waterDk", "water", "waterLt"),
      frames: [["....o", "...ol", "..olf", ".olff", ".ohef", "offff", "offfm", "oflll", ".offl", "..ooo"]]},
    "pet.sprout": {w: 10, h: 10, mirror: true, map: petMap("grassDk", "grass", "grassLt"),
      frames: [[".ol..", ".oll.", "..olo", "..ooo", ".offf", "ofhef", "offff", "offfm", ".olll", "..ooo"]]},
  });
  // Avatars (§2.4); c / f = player color (ui.avatar passes it through opt.map)
  DEVICE.registerSprites("av.", {
    "av.kid": {w: 10, h: 10, mirror: true, map: {o: "fireDk", f: "gold", c: "white", e: "void", m: "fireDk"},
      frames: [["..ooo", ".occc", "occcc", "ooooo", ".offf", ".ofef", ".offf", ".offm", "..off", "...oo"]]},
    "av.robot": {w: 10, h: 10, mirror: true, map: {o: "muted", l: "white", m: "line", c: "white"},
      frames: [["....c", "....o", ".oooo", ".olll", ".olcl", ".olll", ".olmm", ".olll", ".oooo", "..oo."]]},
    "av.cat": {w: 10, h: 10, mirror: true, map: {o: "line", f: "white", l: "white", e: "void", m: "void"},
      frames: [[".o...", ".oo..", ".oloo", "offff", "ofeff", "offff", "offfm", ".offf", "..off", "...oo"]]},
  });
  DEVICE.registerSprites("ui.", {
    "ui.mode.battle": {w: 12, h: 12, map: {b: "white", g: "gold", h: "fireDk"}, frames: [[
      "b..........b", ".b........b.", "..b......b..", "...b....b...", "....b..b....", "..g..bb..g..",
      "...g.bb.g...", "....g..g....", "...h.gg.h...", "..h..gg..h..", ".h........h.", "g..........g"]]},
    "ui.mode.race": {w: 12, h: 12, map: {"|": "muted", "#": "white", "+": "void"}, frames: [[
      "|##++##++##.", "|##++##++##.", "|++##++##++.", "|++##++##++.", "|##++##++##.", "|##++##++##.",
      "|...........", "|...........", "|...........", "|...........", "|...........", "###........."]]},
    "ui.mode.adv": {w: 12, h: 12, map: {o: "fireDk", w: "fire", g: "gold"}, frames: [[
      "............", "..oooooooo..", ".owwwwwwwwo.", "owwwwwwwwwwo", "oggggggggggo", "owwwwggwwwwo",
      "owwwwoowwwwo", "owwwwggwwwwo", "owwwwwwwwwwo", "oggggggggggo", "oooooooooooo", "............"]]},
    "ui.mode.settings": {w: 12, h: 12, map: {"#": "muted"}, frames: [[
      ".....##.....", "..#.####.#..", ".##########.", "..###..###..", ".###....###.", "####....####",
      "####....####", ".###....###.", "..###..###..", ".##########.", "..#.####.#..", ".....##....."]]},
    // Kart, top view, nose up (o = outline / wheels, c = player color, p = driver's element)
    "ui.car": {w: 8, h: 8, mirror: true, map: {o: "void", c: "white", p: "fire"},
      frames: [["..oo", ".occ", "oocp", "oocp", ".occ", "oocc", "oocc", ".ooo"]]},
    "ui.carDiag": {w: 8, h: 8, map: {o: "void", c: "white", p: "fire"},
      frames: [["....ooo.", "...occco", "..occcco", ".occppco", "occppco.", "occcco..", "occco...", ".ooo...."]]},
  });
  const ICON_ROWS = {
    A: ["accent", ".######.", "########", "###..###", "##.##.##", "##....##", "##.##.##", "##.##.##", ".######."],
    B: ["muted", ".######.", "########", "##...###", "##.##.##", "##...###", "##.##.##", "##...###", ".######."],
    S: ["muted", ".######.", "########", "###...##", "##.#####", "###..###", "#####.##", "##...###", ".######."],
    M: ["muted", ".######.", "########", "##....##", "########", "##....##", "########", "##....##", ".######."],
    STICK: ["muted", "..####..", "..#..#..", "###..###", "#......#", "#......#", "###..###", "..#..#..", "..####.."],
    PAD: ["muted", "########", "#......#", "#.####.#", "#.#..#.#", "#.#..#.#", "#.####.#", "#......#", "########"],
    OK: ["grassLt", "........", "......##", ".....##.", "##..##..", ".####...", "..##....", "........", "........"],
    NO: ["danger", "##....##", ".##..##.", "..####..", "...##...", "..####..", ".##..##.", "##....##", "........"],
    STAR: ["gold", "...##...", "...##...", "########", ".######.", "..####..", ".##..##.", ".#....#.", "........"],
    L: ["white", "....##..", "...###..", "..####..", ".#####..", ".#####..", "..####..", "...###..", "....##.."],
    R: ["white", "..##....", "..###...", "..####..", "..#####.", "..#####.", "..####..", "..###...", "..##...."],
    UP: ["white", "........", "........", "...##...", "..####..", ".######.", "########", "........", "........"],
    DN: ["white", "........", "........", "########", ".######.", "..####..", "...##...", "........", "........"],
    DEL: ["white", "........", "..#.....", ".##.....", "########", "########", ".##.....", "..#.....", "........"],
    DICE: ["white", "########", "#......#", "#.#..#.#", "#..##..#", "#..##..#", "#.#..#.#", "#......#", "########"],
    GEAR: ["muted", ".#.##.#.", "########", ".##..##.", "###..###", "###..###", ".##..##.", "########", ".#.##.#."],
    heart: ["danger", ".##..##.", "########", "########", ".######.", "..####..", "...##...", "........", "........"],
    heartEmpty: ["danger", ".##..##.", "#..##..#", "#......#", ".#....#.", "..#..#..", "...##...", "........", "........"],
    bolt: ["gold", ".....##.", "....##..", "...##...", "..######", ".....##.", "....##..", "...##...", "..##...."],
    antenna: ["danger", "#.#.#...", ".###....", "..#..#.#", "..#...#.", "..#..#.#", "..#.....", "..#.....", "........"],
    pause: ["white", "........", ".##..##.", ".##..##.", ".##..##.", ".##..##.", ".##..##.", ".##..##.", "........"],
  };
  const ICON2 = {   // two-color icons: # and +
    flame: ["fire", "gold", "...#....", "...##...", "..###.#.", "..#####.", ".###+##.", ".##++##.", ".##++##.", "..####.."],
    drop: ["water", "waterLt", "...##...", "...##...", "..####..", ".######.", ".#+####.", ".#+####.", "..####..", "...##..."],
    leaf: ["grass", "grassLt", ".....###", "...#####", "..######", ".####+##", ".###+###", ".##+####", ".+#####.", "+......."],
    shield: ["water", "waterLt", "########", "#++++++#", "#++++++#", "#++++++#", ".#++++#.", ".#++++#.", "..#++#..", "...##..."],
    hourglass: ["muted", "gold", "########", ".#....#.", "..#..#..", "...##...", "...##...", "..#++#..", ".#++++#.", "########"],
  };
  {
    const defs = {};
    for (const [k, [c, ...rows]] of Object.entries(ICON_ROWS)) defs["icon." + k] = {w: 8, h: 8, map: {"#": c}, frames: [rows]};
    for (const [k, [c1, c2, ...rows]] of Object.entries(ICON2)) defs["icon." + k] = {w: 8, h: 8, map: {"#": c1, "+": c2}, frames: [rows]};
    DEVICE.registerSprites("icon.", defs);
  }

  DEVICE.PETS = Object.freeze([
    {id: "ember", el: "fire", sprite: "pet.ember", nameKey: "dev.pet.ember", elKey: "dev.pet.fire", color: "fire", dk: "fireDk", lt: "gold", icon: "icon.flame"},
    {id: "tide", el: "water", sprite: "pet.tide", nameKey: "dev.pet.tide", elKey: "dev.pet.water", color: "water", dk: "waterDk", lt: "waterLt", icon: "icon.drop"},
    {id: "sprout", el: "grass", sprite: "pet.sprout", nameKey: "dev.pet.sprout", elKey: "dev.pet.grass", color: "grass", dk: "grassDk", lt: "grassLt", icon: "icon.leaf"},
  ].map(Object.freeze));
  // Avatar index 0..5 (HELLO avatar byte); tint = letter painted in the player color
  DEVICE.AVATARS = Object.freeze([
    {sprite: "pet.ember"}, {sprite: "pet.tide"}, {sprite: "pet.sprout"},
    {sprite: "av.kid", tint: "c"}, {sprite: "av.robot", tint: "c"}, {sprite: "av.cat", tint: "f"},
  ].map(Object.freeze));
  // Player color index 0..5 (HELLO color byte): red, orange, gold, green, blue, white
  DEVICE.PLAYER_COLORS = Object.freeze(["danger", "fire", "gold", "grassLt", "water", "white"]);
  const GUEST_NAMES = ["MOCHI", "TOFU", "BLAZE", "RIVER", "FERN", "PIXEL", "NOVA", "BYTE", "KOI", "MANGO", "ZAP", "LUNA"];
  DEVICE.GUEST_NAMES = Object.freeze(GUEST_NAMES);
  DEVICE.guestProfile = (rng, avoidColor) => {
    const r = rng || {int: n => Math.floor(Math.random() * n)};
    let color = r.int(6);
    if (color === avoidColor) color = (color + 1) % 6;
    return {name: GUEST_NAMES[r.int(GUEST_NAMES.length)], avatar: r.int(6), color};
  };
  const playerColor = i => DEVICE.PLAYER_COLORS[(i | 0) % 6] || "white";

  const UI = DEVICE.ui = {};
  const blinkOn = (ctx, hz) => Math.floor(ctx.now() * hz * 2 / 1000) % 2 === 0;
  const tr = (ctx, k, vars) => (k == null ? "" : Array.isArray(k) ? ctx.t(k[0], k[1]) : ctx.t(k, vars));

  UI.topBar = function (g, ctx, titleKey, opt = {}) {
    g.rect(0, 0, W, 13, "panel");
    g.hline(0, 13, W, "line");
    const signal = opt.signal !== false;
    const title = opt.title != null ? opt.title : tr(ctx, titleKey, opt.vars);
    g.text(4, 0, title, {w: opt.titleW || 76, key: titleKey});
    if (opt.right) g.text(signal ? 113 : 123, 0, opt.right, {align: "r", w: signal ? 32 : 42});
    if (signal) UI.signal(g, 116, 3, signalBars(ctx));
  };
  const signalBars = ctx => {
    const n = ctx.link.up ? ctx.link.rxPerSec : 0;
    return n >= 8 ? 3 : n >= 5 ? 2 : n >= 1 ? 1 : 0;
  };

  UI.hintBar = function (g, ctx, items, opt = {}) {
    g.rect(0, 147, W, 13, "panel");
    g.hline(0, 146, W, "line");
    const cells = [2, 44, 86];
    // [+] re-spacing: a label that fills its 30 px leaves only 3 px before the
    // next icon; then that next cell (icon + label) moves 2 px right when its
    // own label is at most 28 px, so the gap is 5 px ("Again {B}Menu")
    const list = (items || []).slice(0, 3);
    const tw = list.map(it => it ? measureText(g.hh, tr(ctx, it[1], it[2]), {}).w + (it[0] === "LR" ? 5 : 0) : 0);
    list.forEach((it, i) => {
      if (!it) return;
      const [icon, key, vars] = it;
      const x = cells[i] + (i > 0 && list[i - 1] && tw[i - 1] >= 29 && tw[i] <= 28 ? 2 : 0);
      const dis = opt.disabled === true || (Array.isArray(opt.disabled) && opt.disabled[i]);
      const c = dis ? "line" : "white";
      const hide = opt.blink === i && !blinkOn(ctx, 4);
      let tx = x + 10;
      if (icon === "LR") {
        if (!hide) { drawIcon(g, g.hh, "L", x - 2, 149, 1, c); drawIcon(g, g.hh, "R", x + 5, 149, 1, c); }
        tx = x + 15;
      } else if (icon && !hide) drawIcon(g, g.hh, icon, x, 149, 1, dis ? "line" : c);
      g.text(tx, 146, tr(ctx, key, vars), {w: x + 40 - tx, c, key});
    });
  };

  UI.list = function (g, x, y, w, items, sel, opt = {}) {
    const rowH = opt.rowH || 14;
    items.forEach((it, i) => {
      if (typeof it === "string") it = {label: it};
      const ry = y + i * rowH;
      const dis = it.disabled || (opt.disabled || []).includes(i);
      if (i === sel) { g.rect(x, ry, w, rowH, "panel"); g.rect(x, ry, 3, rowH, "accent"); }
      const c = dis ? "muted" : "white";
      g.text(x + 8, ry + (rowH - 14) / 2 | 0, it.label, {c, w: it.value != null ? 64 : w - 12});
      if (it.value != null && it.value !== "") {
        const arrows = i === sel && it.arrows;
        const right = x + w - 8 - (arrows ? 10 : 0);
        const m = g.text(right, ry + (rowH - 14) / 2 | 0, it.value, {align: "r", c});
        if (arrows) {
          drawIcon(g, g.hh, "L", right - m.w - 10, ry + 3, 1, "white");
          drawIcon(g, g.hh, "R", right + 2, ry + 3, 1, "white");
        }
      }
    });
  };

  UI.hpBar = function (g, x, y, w, hp, max, opt = {}) {
    const h = opt.h || 6;
    g.frame(x, y, w, h, "line");
    g.rect(x + 1, y + 1, w - 2, h - 2, "void");
    if (!(max > 0) || !(hp > 0)) return;
    const fw = Math.min(w - 2, Math.round(hp * (w - 2) / max));
    const c = hp * 100 > 50 * max ? "grassLt" : hp * 100 >= 20 * max ? "gold" : "danger";
    g.rect(x + 1, y + 1, fw, h - 2, c);
  };

  UI.avatar = function (g, x, y, profile, opt = {}) {
    const a = DEVICE.AVATARS[profile && profile.avatar < 6 ? profile.avatar : 0];
    const o = {scale: opt.scale || 1};
    if (a.tint) o.map = {[a.tint]: playerColor(profile ? profile.color : 5)};
    if (opt.color) o.color = opt.color;
    g.sprite(a.sprite, x, y, o);
  };

  UI.signal = function (g, x, y, bars) {
    for (let k = 0; k < 3; k++) g.rect(x + 3 * k, y + 4 - 2 * k, 2, 3 + 2 * k, k < bars ? "white" : "line");
  };

  UI.petCard = function (g, x, y, petIdx, opt = {}) {
    const w = opt.w || 40, h = opt.h || 72, s = opt.scale || 3;
    const ctx = g.hh.ctx;
    g.frame(x, y, w, h, "line");
    if (opt.selected) g.frame(x, y, w, h, opt.color || "accent", 2);
    const pet = DEVICE.PETS[petIdx];
    const sx = x + Math.floor((w - 10 * s) / 2);
    if (opt.hidden || !pet) g.text(x + w / 2, y + 3 + 5 * s - 7 * 2, "?", {align: "c", scale: 2, c: "muted"});
    else g.sprite(pet.sprite, sx, y + 3, {scale: s, color: opt.fainted ? "line" : null});
    if (pet && !opt.hidden) g.text(x + w / 2, y + 36, ctx.t(pet.nameKey), {align: "c", w: w - 4, c: opt.fainted ? "muted" : "white", key: pet.nameKey});
    if (opt.hp != null) UI.hpBar(g, x + 4, y + 56, w - 8, opt.hp, opt.max || 60, {h: 4});
  };

  UI.bandBar = function (g, x, y, w, h, o = {}) {
    g.frame(x, y, w, h, "line");
    const ix = x + 1, iw = w - 2, iy = y + 1, ih = h - 2;
    g.rect(ix, iy, iw, ih, "void");
    const at = L => ix + Math.round(clamp(L, 0, 100) * (iw - 1) / 100);
    if (o.center != null) {
      const half = (o.width == null ? C.TRIAL_BAND_PCT : o.width) / 2;
      const a = at(o.center - half), b = at(o.center + half);
      g.rect(a, iy, b - a + 1, ih, o.inside ? "gold" : "water");
    }
    for (const t of [25, 50, 75]) { g.rect(at(t), iy + ih - 2, 2, 2, "line"); g.rect(at(t), iy, 2, 2, "line"); }
    if (o.level != null) {
      const px = at(o.level);
      g.rect(px, y - 1, 2, h + 2, "white");
      g.rect(px - 1, y - 2, 3, 2, "white");
      g.rect(px - 1, y + h, 3, 2, "white");
    }
  };

  UI.banner = function (g, ctx, key, vars, opt = {}) {
    const s = opt.scale || 2, y = opt.y == null ? 56 : opt.y, x = opt.x || 0, w = opt.w || W;
    const h = 12 * s + 12;
    g.rect(x, y, w, h, "panel");
    g.hline(x, y, w, "accent");
    g.hline(x, y + h - 1, w, "accent");
    g.text(x + Math.floor(w / 2), y + 6 - s, ctx.t(key, vars), {align: "c", scale: s, c: opt.c || "gold", w: w - 4, key});
  };

  UI.dim = function (g) { g.dither(0, 0, W, H, "void", null); };
  UI.panel = function (g, x, y, w, h) { g.rect(x, y, w, h, "panel"); g.frame(x, y, w, h, "accent"); };

  // S11 layout (§4.7), shared by the three pick screens
  UI.pickScreen = function (g, ctx, o) {
    UI.topBar(g, ctx, o.titleKey, {right: o.badgeKey ? tr(ctx, o.badgeKey, o.badgeVars) : "", signal: false});
    if (o.noteKey) g.text(4, 14, tr(ctx, o.noteKey, o.noteVars), {w: 120, c: "muted", key: o.noteKey});
    const me = ctx.color();
    (o.cards || []).forEach((cd, i) => {
      const x = 4 + 40 * i, y = 30;
      const pet = DEVICE.PETS[cd.pet];
      g.frame(x, y, 40, 72, "line");
      if (pet) {
        const dimmed = cd.disabled || cd.takenBy;
        g.sprite(pet.sprite, x + 5, 33, {scale: 3, color: cd.disabled ? "line" : null});
        if (cd.takenBy) g.dither(x + 5, 33, 30, 30, "void", null);
        g.text(x + 20, 66, ctx.t(pet.nameKey), {align: "c", w: 36, c: dimmed ? "muted" : "white", key: pet.nameKey});
      }
      const l1 = cd.line1;
      if (l1 != null) {
        if (typeof l1 === "object" && l1.hp != null) UI.hpBar(g, x + 4, 86, 32, l1.hp, l1.max || 60, {h: 4});
        else if (typeof l1 === "object" && l1.icon) g.sprite(l1.icon, x + 16, 86, {color: cd.disabled ? "line" : null});
        else g.text(x + 20, 84, tr(ctx, l1), {align: "c", w: 36, c: cd.disabled ? "muted" : "white"});
      }
      const l2 = cd.line2 != null ? cd.line2 : cd.takenBy;
      if (l2 != null) g.text(x + 20, 90, String(l2), {align: "c", font: "s", w: 36, c: cd.line2 != null ? "white" : "muted"});
      if (cd.mark === "ok") g.sprite("icon.OK", x + 30, 32, {color: me});
      else if (cd.mark === "x") g.sprite("icon.NO", x + 30, 32);
      if (i === o.sel) {
        g.frame(x, y, 40, 72, me, 2);
        g.rect(x + 18, 27, 5, 1, me); g.rect(x + 19, 28, 3, 1, me); g.rect(x + 20, 29, 1, 1, me);
      }
    });
    const info = o.info || [];
    if (info[0] != null) g.text(4, 104, tr(ctx, info[0]), {w: 120});
    if (info[1] != null) g.text(4, 118, tr(ctx, info[1]), {w: 120});
    if (o.statusKey) g.text(4, 132, tr(ctx, o.statusKey, o.statusVars), {w: 120, c: "muted", key: o.statusKey});
    if (o.hints) UI.hintBar(g, ctx, o.hints);
  };

  UI.pickInput = function (ctx, ev, st, o = {}) {
    const count = o.count || 3, canPick = o.canPick || (() => true);
    if (st.sel == null) st.sel = 0;
    if (ev.type !== "down" && ev.type !== "repeat") return null;
    const move = d => { st.sel = (st.sel + d + count) % count; ctx.sfx("ui_move"); };
    if (ev.btn === "LEFT" || ev.btn === "RIGHT") { if (!st.locked) move(ev.btn === "LEFT" ? -1 : 1); return null; }
    if (ev.type !== "down") return null;
    if (ev.btn === "B") {
      if (st.locked) {
        if (!o.bUnlocks) return null;
        st.locked = false; ctx.sfx("ui_back");
        return {unlock: true};
      }
      move(1);
      return null;
    }
    if (ev.btn === "A") {
      if (st.locked) return null;
      if (!canPick(st.sel)) { ctx.sfx("ui_deny"); return null; }
      st.locked = true; ctx.sfx("ui_ok");
      return {pick: st.sel};
    }
    return null;
  };

  /* ================= 6. input ================= */

  const BTNS = ["A", "B", "SKILL", "MENU"];
  const KEYMAP = {
    KeyW: [0, "up"], KeyS: [0, "down"], KeyA: [0, "left"], KeyD: [0, "right"],
    KeyF: [0, "a"], KeyG: [0, "b"], KeyR: [0, "skill"], KeyT: [0, "menu"], KeyV: [0, "padHard"], KeyC: [0, "padLight"],
    ArrowUp: [1, "up"], ArrowDown: [1, "down"], ArrowLeft: [1, "left"], ArrowRight: [1, "right"],
    KeyK: [1, "a"], KeyL: [1, "b"], KeyI: [1, "skill"], KeyO: [1, "menu"], Comma: [1, "padHard"], Period: [1, "padLight"],
  };
  DEVICE.KEYMAP = KEYMAP;
  const KEY_LABEL = [
    {a: "F", b: "G", skill: "R", menu: "T", pad: "V", light: "C", stick: "WASD"},
    {a: "K", b: "L", skill: "I", menu: "O", pad: ",", light: ".", stick: "↑←↓→"},
  ];
  const newSource = () => ({x: 0, y: 0, a: false, b: false, skill: false, menu: false, stick: false,
    force: 0, target: 0, up: false, down: false, left: false, right: false, padHard: false, padLight: false});

  function makeInput(hh) {
    const src = {kbd: newSource(), touch: newSource(), pad: newSource(), script: newSource(), bot: newSource()};
    const queue = [];   // {t (sim ms), src, field, value}
    const st = {x: 0, y: 0, a: false, b: false, skill: false, menu: false, pressure: 0, padPresent: false,
      aDownMs: 0, bDownMs: 0, stickClick: false, aBtn: false, raw: {fsr: C.FSR_REST, joyX: 512, joyY: 512}};
    const btn = {};
    for (const b of BTNS) btn[b] = {down: false, at: 0, long: false, gen: 0, fromStick: false};
    const stick = {dir: null, next: 0, latched: false};
    let force = 0;
    const rng = () => hh.world.streams["input." + hh.p];

    function merged() {
      let x = 0, y = 0, a = false, b = false, skill = false, menu = false, stickC = false, target = 0, analog = 0;
      for (const s of Object.values(src)) {
        x += s.x + (s.right ? 100 : 0) - (s.left ? 100 : 0);
        y += s.y + (s.up ? 100 : 0) - (s.down ? 100 : 0);
        a = a || s.a; b = b || s.b; skill = skill || s.skill; menu = menu || s.menu; stickC = stickC || s.stick;
        target = Math.max(target, s.target, s.padHard ? 230 : 0, s.padLight ? 130 : 0);
        analog = Math.max(analog, s.force);
      }
      if (!hh.hw.caps.joy) { x = 0; y = 0; stickC = false; }
      return {x: clamp(x, -100, 100), y: clamp(y, -100, 100), A: a || stickC, B: b, SKILL: skill, MENU: menu, stickC, aBtn: a, target, analog};
    }
    let last = merged();

    function edges(m, t, out) {
      for (const b of BTNS) {
        const was = btn[b].down, is = m[b];
        if (is === was) continue;
        const bt = t + hh.offset;
        if (is) {
          Object.assign(btn[b], {down: true, at: bt, long: false, gen: hh.screenGen, fromStick: b === "A" && m.stickC && !m.aBtn});
          if (b === "A") st.aDownMs = bt;
          if (b === "B") st.bDownMs = bt;
          out.push({btn: b, type: "down", t: bt, gen: hh.screenGen, fromStick: btn[b].fromStick});
        } else {
          btn[b].down = false;
          out.push({btn: b, type: "up", t: bt, gen: btn[b].gen, fromStick: btn[b].fromStick});
          if (!btn[b].long && bt - btn[b].at < C.CLICK_MS) out.push({btn: b, type: "click", t: bt, gen: btn[b].gen, fromStick: btn[b].fromStick});
        }
      }
    }

    return {
      src, st, btn,
      // Queue a change from a source; t in sim ms (applied in tick order)
      set(srcName, field, value, t) {
        queue.push({t: t == null ? hh.world.clock : Math.max(t, hh.world.clock), src: srcName, field, value});
      },
      held(b) { return btn[b] && btn[b].down ? hh.now() - btn[b].at : 0; },
      releaseAll(srcName) {
        const s = src[srcName];
        for (const k of Object.keys(s)) this.set(srcName, k, typeof s[k] === "boolean" ? false : 0);
      },
      latch() { stick.latched = Math.max(Math.abs(st.x), Math.abs(st.y)) > C.CTL_JOY_RELEASE; },
      // Process [t0, t1): source changes at their own times, then timed events
      process(t0, t1) {
        const out = [];
        queue.sort((p, q) => p.t - q.t);
        while (queue.length && queue[0].t < t1) {
          const e = queue.shift();
          src[e.src][e.field] = e.value;
          const m = merged();
          edges(m, Math.max(e.t, t0), out);
          last = m;
        }
        const m = last = merged();
        const now = t1 + hh.offset;
        for (const b of BTNS) {
          const s = btn[b];
          if (s.down && !s.long && now - s.at >= C.LONG_MS) {
            s.long = true;
            out.push({btn: b, type: "long", t: s.at + C.LONG_MS, gen: s.gen, fromStick: s.fromStick});
          }
        }
        // stick navigation (controls.c): dominant axis, push 60 / release 30, repeat
        const ax = Math.abs(m.x), ay = Math.abs(m.y), mag = Math.max(ax, ay);
        const dirNow = mag >= C.CTL_JOY_PUSH ? (ax >= ay ? (m.x > 0 ? "RIGHT" : "LEFT") : (m.y > 0 ? "UP" : "DOWN")) : null;
        const rep = hh.repeatCfg();
        if (stick.latched) {
          if (mag < C.CTL_JOY_RELEASE) stick.latched = false;
        } else if (stick.dir === null) {
          if (dirNow) { stick.dir = dirNow; stick.next = now + rep.delay; out.push({btn: dirNow, type: "down", t: now, gen: hh.screenGen}); }
        } else if (dirNow && dirNow !== stick.dir) {
          out.push({btn: stick.dir, type: "up", t: now, gen: hh.screenGen});
          stick.dir = dirNow; stick.next = now + rep.delay;
          out.push({btn: dirNow, type: "down", t: now, gen: hh.screenGen});
        } else if (mag < C.CTL_JOY_RELEASE) {
          out.push({btn: stick.dir, type: "up", t: now, gen: hh.screenGen});
          stick.dir = null;
        } else if (now >= stick.next) {
          out.push({btn: stick.dir, type: "repeat", t: now, gen: hh.screenGen});
          stick.next += rep.rate;
          if (stick.next <= now) stick.next = now + rep.rate;
        }
        // simulated FSR: first-order lag toward the target, seeded noise
        const dt = t1 - t0;
        const tau = m.target > force ? 120 : 60;
        force += (m.target - force) * (1 - Math.exp(-dt / tau));
        if (force < 0.05 && m.target === 0) force = 0;
        const eff = Math.max(force, m.analog);
        const noise = rng().int(7) - 3;
        const rest = C.FSR_REST, peak = C.FSR_PEAK;
        const inv = hh.world.fsrInverted;
        let raw;
        if (!hh.hw.caps.pad) raw = 0;
        else {
          const f = eff > 0.5 ? eff + noise : Math.max(0, noise);
          const span = (peak - rest) * f / 255;
          raw = Math.round(inv ? peak - span : rest + span);
        }
        st.raw.fsr = clamp(raw, 0, 4095);
        const cal = hh.settings.padCal || {min: inv ? peak : rest, max: inv ? rest : peak};
        st.pressure = hh.hw.caps.pad ? mapPressure(st.raw.fsr, inv && !hh.settings.padCalSet ? peak : cal.min, inv && !hh.settings.padCalSet ? rest : cal.max) : 0;
        if (st.pressure > C.CTL_PRESS_PRESENT) st.padPresent = true;
        st.x = m.x; st.y = m.y;
        st.a = m.A; st.b = m.B; st.skill = m.SKILL; st.menu = m.MENU; st.stickClick = m.stickC;
        st.raw.joyX = hh.hw.caps.joy ? Math.round(512 + m.x * 5.11) : 0;
        st.raw.joyY = hh.hw.caps.joy ? Math.round(512 + m.y * 5.11) : 0;
        st.aBtn = m.aBtn;
        return out;
      },
    };
  }
  // input_map_pressure() (input_map.c): raw -> 0..255, either direction
  function mapPressure(raw, mn, mx) {
    if (mn === mx) return 0;
    if (mn > mx) { raw = -raw; mn = -mn; mx = -mx; }
    if (raw <= mn) return 0;
    if (raw >= mx) return 255;
    return Math.floor((raw - mn) * 255 / (mx - mn));
  }
  DEVICE.mapPressure = mapPressure;

  /* ================= 7. radio and message codec ================= */

  const TYPE_SIZE = {u8: 1, i8: 1, u16: 2, i16: 2};
  function parseFields(fields, where) {
    return fields.map(f => {
      if (Array.isArray(f)) {
        const [name, count, sub] = f;
        const subL = parseFields(sub, where + "." + name);
        const size = subL.reduce((s, x) => s + x.size, 0);
        return {name, kind: "struct", count, sub: subL, size: size * count};
      }
      const m = /^(\w+):(u8|i8|u16|i16)(?:\[(\d+)\])?$/.exec(f);
      if (!m) throw new Error(where + ": bad field " + f);
      const count = m[3] ? +m[3] : 0;
      return {name: m[1], kind: m[2], count, size: TYPE_SIZE[m[2]] * (count || 1)};
    });
  }
  DEVICE.registerMessage = function (name, typeId, fields, opts = {}) {
    if (R.msgs[name]) throw new Error("duplicate message: " + name);
    if (R.msgByType[typeId]) throw new Error("message type 0x" + typeId.toString(16) + " already used by " + R.msgByType[typeId].name);
    const layout = parseFields(fields, name);
    for (const f of layout) if (f.name === "name" || f.name === "hdr") throw new Error("message " + name + ": field name \"" + f.name + "\" is reserved (unpack returns it)");
    const size = 5 + layout.reduce((s, x) => s + x.size, 0);
    if (size > C.MAX_MSG) { lint("msgSize", name, {size}); throw new Error("message " + name + " is " + size + " B (max " + C.MAX_MSG + ")"); }
    if (opts.kind === "mode") {
      const names = layout.map(f => f.name);
      const need = opts.legacyLayout ? ["step", "phase", "flags"] : ["step", "phase", "flags", "match"];
      if (opts.legacyLayout) {
        for (const n of need) if (!names.includes(n)) { lint("modeFields", name, {missing: n}); throw new Error("mode message " + name + " needs field " + n); }
      } else if (need.some((n, i) => names[i] !== n) || layout[0].kind !== "u16" || layout.slice(1, 4).some(f => f.kind !== "u8")) {
        lint("modeFields", name, {first: names.slice(0, 4)});
        throw new Error("mode message " + name + " must start with step:u16, phase:u8, flags:u8, match:u8");
      }
    }
    const def = {name, typeId, layout, size, kind: opts.kind || "uplink", legacy: !!opts.legacyLayout, stub: !!opts.stub};
    R.msgs[name] = def;
    R.msgByType[typeId] = def;
    return def;
  };
  DEVICE.msgSize = name => { const d = R.msgs[name]; if (!d) throw new Error("unknown message: " + name); return d.size; };
  DEVICE.msgSizes = () => Object.fromEntries(Object.values(R.msgs).map(d => [d.name, d.size]));

  const RANGE = {u8: [0, 255], i8: [-128, 127], u16: [0, 65535], i16: [-32768, 32767]};
  function writeNum(buf, o, kind, v, where) {
    if (typeof v === "boolean") v = v ? 1 : 0;
    if (!Number.isInteger(v)) throw new Error(where + ": not an integer: " + v);
    const [lo, hi] = RANGE[kind];
    if (v < lo || v > hi) throw new Error(where + ": " + v + " out of " + kind + " range");
    if (kind === "u8" || kind === "i8") buf[o] = v & 0xff;
    else { buf[o] = v & 0xff; buf[o + 1] = (v >> 8) & 0xff; }
  }
  function readNum(buf, o, kind) {
    if (kind === "u8") return buf[o];
    if (kind === "i8") return buf[o] << 24 >> 24;
    const v = buf[o] | buf[o + 1] << 8;
    return kind === "i16" ? v << 16 >> 16 : v;
  }
  function packFields(buf, o, layout, obj, where) {
    for (const f of layout) {
      const v = obj[f.name];
      const w = where + "." + f.name;
      if (v === undefined) throw new Error(w + " missing");
      if (f.kind === "struct") {
        if (!Array.isArray(v) || v.length !== f.count) throw new Error(w + ": want " + f.count + " entries");
        const each = f.size / f.count;
        v.forEach((item, i) => packFields(buf, o + i * each, f.sub, item, w + "[" + i + "]"));
      } else if (f.count) {
        let arr = v;
        if (typeof v === "string") { arr = Array.from({length: f.count}, (_, i) => i < v.length ? v.charCodeAt(i) : 0); if (v.length > f.count) throw new Error(w + ": string too long"); }
        if (!arr || arr.length !== f.count) throw new Error(w + ": want " + f.count + " values");
        const bs = TYPE_SIZE[f.kind];
        for (let i = 0; i < f.count; i++) writeNum(buf, o + i * bs, f.kind, arr[i], w + "[" + i + "]");
      } else writeNum(buf, o, f.kind, v, w);
      o += f.size;
    }
  }
  function unpackFields(buf, o, layout) {
    const out = {};
    for (const f of layout) {
      if (f.kind === "struct") {
        const each = f.size / f.count;
        out[f.name] = Array.from({length: f.count}, (_, i) => unpackFields(buf, o + i * each, f.sub));
      } else if (f.count) {
        const bs = TYPE_SIZE[f.kind];
        out[f.name] = Array.from({length: f.count}, (_, i) => readNum(buf, o + i * bs, f.kind));
      } else out[f.name] = readNum(buf, o, f.kind);
      o += f.size;
    }
    return out;
  }
  DEVICE.pack = function (name, obj, hdr = {}) {
    const d = R.msgs[name];
    if (!d) throw new Error("unknown message: " + name);
    const buf = new Uint8Array(d.size);
    buf[0] = hdr.version == null ? C.PROTOCOL_VERSION : hdr.version;
    buf[1] = d.typeId; buf[2] = hdr.src || 0; buf[3] = hdr.dst == null ? 0xff : hdr.dst; buf[4] = (hdr.seq || 0) & 0xff;
    packFields(buf, 5, d.layout, obj || {}, name);
    return buf;
  };
  DEVICE.unpack = function (bytes) {
    const d = R.msgByType[bytes[1]];
    if (!d) throw new Error("unknown message type 0x" + bytes[1].toString(16));
    if (bytes.length !== d.size) throw new Error(d.name + ": " + bytes.length + " B, want " + d.size);
    return Object.assign({name: d.name, hdr: {version: bytes[0], type: bytes[1], src: bytes[2], dst: bytes[3], seq: bytes[4]}},
      unpackFields(bytes, 5, d.layout));
  };
  const bytesToStr = arr => String.fromCharCode(...(arr || []).filter(c => c > 0));
  DEVICE.bytesToStr = bytesToStr;

  // Base messages (§7.6)
  DEVICE.registerMessage("input", C.MSG.INPUT, ["joyX:i8", "joyY:i8", "buttons:u8", "pressure:u8", "ui:u8"], {kind: "uplink"});
  DEVICE.registerMessage("action", C.MSG.ACTION, ["step:u16", "action:u8", "arg:u8", "flags:u8", "data:u8[3]"], {kind: "uplink"});
  DEVICE.registerMessage("hello", C.MSG.HELLO, ["nick:u8[6]", "avatar:u8", "color:u8", "caps:u8", "bootNonce:u8", "fwBuild:u8"], {kind: "uplink"});
  DEVICE.registerMessage("ack", C.MSG.ACK, ["step:u16", "ackedSeq:u8", "accepted:u8", "counter:u8"], {kind: "session"});
  DEVICE.registerMessage("lobby", C.MSG.LOBBY, [
    "step:u16", "phase:u8", "flags:u8", "centralBoot:u8", "match:u8", "mode:u8", "hover:u8[2]", "vote:u8[2]",
    "readyMask:u8", "rematchMask:u8", "pausedBy:u8", "wins:u8[6]",
    ["profile", 2, ["name:u8[6]", "avatar:u8", "color:u8"]],
    "helloNonce:u8[2]", "modesBuilt:u8", "evId:u8", "evType:u8", "evWho:u8", "error:u8", "modeRes:u8[4]"], {kind: "session"});

  function makeRadio(world) {
    const nodes = [0, 1, 2].map(() => ({ch: 15, ver: C.PROTOCOL_VERSION, plugged: true, rx: null, bad: null, seq: 0,
      sent: 0, lost: 0, bytes: 0, air: 0, rxBadVersion: 0, lastBadVersion: 0}));
    const inflight = [];
    const lastAt = [0, 0, 0];   // one radio per node sends frames one after another: never reordered
    const radio = {
      nodes, loss: 0, latency: [1, 4], collisions: false, log: [],
      powered: n => n !== 0 || (world.central && world.central.powered),
      send(srcNode, dst, bytes) {
        const n = nodes[srcNode];
        if (!n.plugged || !radio.powered(srcNode)) return;
        bytes = Uint8Array.from(bytes);
        bytes[2] = srcNode; bytes[3] = dst; bytes[4] = n.seq = (n.seq + 1) & 0xff;
        bytes[0] = n.ver;
        const rng = world.streams.radio;
        const now = world.clock;
        const airMs = (bytes.length + 31) * 0.032;
        const lat = radio.latency[0] + rng.float() * (radio.latency[1] - radio.latency[0]);
        const at = Math.max(now + Math.max(lat, airMs), lastAt[srcNode] + 0.001);
        lastAt[srcNode] = at;
        const f = {src: srcNode, dst, bytes, ch: n.ch, t0: now, t1: now + airMs, at, lost: rng.float() < radio.loss};
        if (radio.collisions) {
          for (const o of inflight) if (o.ch === f.ch && o.t0 < f.t1 && f.t0 < o.t1) { o.lost = true; f.lost = true; }
        }
        n.sent++; n.bytes += bytes.length; n.air += airMs;
        if (f.lost) n.lost++;
        inflight.push(f);
      },
      deliverDue(now) {
        inflight.sort((a, b) => a.at - b.at);
        while (inflight.length && inflight[0].at <= now) {
          const f = inflight.shift();
          if (f.lost) continue;
          const targets = f.dst === 0xff ? [0, 1, 2].filter(i => i !== f.src) : [f.dst];
          for (const t of targets) {
            const n = nodes[t];
            if (!n.plugged || !radio.powered(t) || n.ch !== f.ch || !n.rx) continue;
            if (f.bytes[0] !== n.ver) { n.rxBadVersion++; n.lastBadVersion = f.bytes[0]; if (n.bad) n.bad(f.bytes[0]); continue; }
            n.rx(f.bytes, f.src);
          }
        }
      },
      stats() {
        const secs = Math.max(0.001, world.clock / 1000);
        return nodes.map((n, i) => ({node: i, ch: n.ch, version: n.ver, plugged: n.plugged, sent: n.sent, lost: n.lost,
          bytesPerSec: Math.round(n.bytes / secs), airPct: +(n.air / (world.clock || 1) * 100).toFixed(2),
          rxBadVersion: n.rxBadVersion, lastBadVersion: n.lastBadVersion}));
      },
    };
    return radio;
  }

  /* ================= 8. central host and stub session ================= */

  // Lobby fields a session snapshot must provide (host fills the rest)
  const EMPTY_PROFILE = {name: [0, 0, 0, 0, 0, 0], avatar: 0, color: 0};

  function makeCentral(world) {
    const radio = world.radio;
    const rng = world.streams.central;
    const c = {
      powered: true, boot: 1 + world.streams.world.int(255), step: 0, match: 0,
      links: [false, false], heard: [-1e9, -1e9], counters: [0, 0], lastRt: [{counter: 0, accepted: 0}, {counter: 0, accepted: 0}],
      turnSeen: [{step: -1, accepted: 0}, {step: -1, accepted: 0}],
      helloNonce: [0, 0], hello: [null, null],
      mode: null,          // {def, inst, over, overReported, lastBroadcast, lastSnap}
      manual: null,        // {by} manual pause
      paused: false,
      lobbyAt: -1e9, lobbyJson: "", lobbySnap: null, wantBroadcast: false,
      pausedTotal: 0, pausedSince: null,
      log: [],
    };
    const api = {
      now: () => world.clock,
      gameNow: () => world.clock - c.pausedTotal - (c.pausedSince != null ? world.clock - c.pausedSince : 0),
      rand: () => rng.float(),
      randInt: n => rng.int(n),
      step: () => c.step,
      nextStep: () => (c.step = (c.step + 1) & 0xffff),
      broadcast: () => { c.wantBroadcast = true; },
      links: () => c.links.slice(),
      profiles: () => c.hello.map(h => h ? Object.assign({}, h) : null),
      pause: by => { c.manual = {by: by == null ? null : by}; c.wantBroadcast = true; },
      resume: () => { c.manual = null; c.wantBroadcast = true; },
      paused: () => c.paused,
      startMode(id, opts = {}) {
        const def = typeof id === "number" ? R.modes.find(m => m.modeId === id) : R.modes.find(m => m.id === id);
        if (!def) throw new Error("startMode: unknown mode " + id);
        const prev = c.mode;
        if (opts.retryRoom && opts.carry == null && prev && prev.inst && prev.inst.carry) opts.carry = safe("carry", () => prev.inst.carry());
        c.match = (c.match + 1) & 0xff;
        api.nextStep();
        c.manual = null;
        const full = Object.assign({first: 0, params: DEVICE.params(def.id), profiles: api.profiles(), rematch: false, retryRoom: false, carry: null}, opts);
        const inst = safe("mode " + def.id + " central.create", () => def.central.create(api, full)) || {};
        c.mode = {def, inst, overReported: false, lastBroadcast: -1e9, lastSnap: null};
        if (c.paused) { c.paused = false; }
        c.wantBroadcast = true;
        log("startMode " + def.id + " match " + c.match);
      },
      endMode() {
        if (!c.mode) return;
        log("endMode " + c.mode.def.id);
        c.mode = null; c.manual = null; c.paused = false;
        api.nextStep();
        c.wantBroadcast = true;
      },
      mode: () => c.mode ? c.mode.def.id : null,
      match: () => c.match,
      get params() { return c.mode ? DEVICE.params(c.mode.def.id) : {}; },
      log: msg => log(String(msg)),
      canPause(p) {
        if (!c.mode) return "no";
        const f = c.mode.inst.canPause;
        return f ? (safe("canPause", () => f.call(c.mode.inst, p)) || "now") : "now";
      },
      over: () => c.mode && c.mode.inst.over ? safe("over", () => c.mode.inst.over()) || null : null,
      quitMode(p) {
        if (!c.mode) return;
        if (c.mode.inst.quit) safe("quit", () => c.mode.inst.quit(p));
        else api.endMode();
        c.wantBroadcast = true;
      },
    };
    function log(msg) { c.log.push({t: world.clock, msg}); if (c.log.length > 100) c.log.shift(); }
    c.api = api;

    const sessionDef = world.autoMode ? null : R.session;
    c.session = (sessionDef ? safe("session.create", () => sessionDef.create(api)) : null) || stubSession(api, world.autoMode);

    function send(dst, name, fields) {
      try { radio.send(0, dst, DEVICE.pack(name, fields)); } catch (e) { recordError("central send " + name, e); }
    }
    function hostFlags() {
      return (c.paused ? C.FLAG.PAUSED : 0) | (c.links[0] ? C.FLAG.P1_LINK : 0) | (c.links[1] ? C.FLAG.P2_LINK : 0);
    }
    function broadcastMode() {
      const m = c.mode;
      if (!m) return;
      const snap = safe("mode " + m.def.id + " snapshot", () => m.inst.snapshot()) || {};
      const fields = Object.assign({}, snap, {step: c.step, match: c.match, flags: ((snap.flags | 0) & 0xf8) | hostFlags()});
      m.lastSnap = fields;
      m.lastBroadcast = world.clock;
      try { radio.send(0, 0xff, DEVICE.pack(m.def.stateMsg, fields)); } catch (e) { recordError("mode " + m.def.id + " pack " + m.def.stateMsg, e); }
    }
    function lobbyFields() {
      const s = safe("session.snapshot", () => c.session.snapshot()) || {};
      return Object.assign({
        phase: 0, mode: 0xff, hover: [0xff, 0xff], vote: [0xff, 0xff], readyMask: 0, rematchMask: 0, pausedBy: 0xff,
        wins: [0, 0, 0, 0, 0, 0], profile: [EMPTY_PROFILE, EMPTY_PROFILE], modesBuilt: 0,
        evId: 0, evType: 0, evWho: 0, error: 0, modeRes: [0, 0, 0, 0],
      }, s, {step: c.step, flags: hostFlags(), centralBoot: c.boot, match: c.match, helloNonce: c.helloNonce.slice()});
    }

    c.receive = function (bytes, srcNode) {
      if (!c.powered) return;
      let m;
      try { m = DEVICE.unpack(bytes); } catch (e) { recordError("central unpack", e); return; }
      const p = srcNode - 1;
      if (p !== 0 && p !== 1) return;
      c.heard[p] = world.clock;
      if (!c.links[p]) { c.links[p] = true; c.wantBroadcast = true; log("P" + (p + 1) + " link up"); }
      if (m.name === "input") {
        safe("session.ui", () => c.session.ui(p, m.ui & 0x0f, m.ui >> 4));
        if (c.mode && c.mode.inst.input) safe("mode input", () => c.mode.inst.input(p, m));
      } else if (m.name === "hello") {
        if (m.bootNonce !== c.helloNonce[p]) { c.counters[p] = 0; c.lastRt[p] = {counter: 0, accepted: 0}; c.turnSeen[p] = {step: -1, accepted: 0}; }
        c.helloNonce[p] = m.bootNonce;
        const prof = {name: bytesToStr(m.nick), avatar: m.avatar, color: m.color, caps: m.caps, fwBuild: m.fwBuild};
        c.hello[p] = prof;
        safe("session.hello", () => c.session.hello(p, prof, m.bootNonce));
        c.wantBroadcast = true;
      } else if (m.name === "action") {
        handleAction(p, m, srcNode);
      } else if (R.msgs[m.name] && R.msgs[m.name].kind === "uplink") {
        if (c.mode && c.mode.inst.message) safe("mode message", () => c.mode.inst.message(p, m.name, m));
      }
    };
    function handleAction(p, m, srcNode) {
      let accepted = 0;
      const rt = m.action >= 0x10;
      if (rt) {
        const d = (m.flags - c.counters[p] + 256) & 0xff;
        if (m.flags !== 0 && d === 0) accepted = c.lastRt[p].accepted;
        else if (d >= 1 && d <= 127) {
          const info = {step: m.step, counter: m.flags};
          const ok = m.action <= 0x1f
            ? safe("session.action", () => c.session.action(p, m.action, m.arg, m.data))
            : c.mode && c.mode.inst.action ? safe("mode action", () => c.mode.inst.action(p, m.action, m.arg, m.data, info)) : false;
          accepted = ok ? 1 : 0;
          c.counters[p] = m.flags;
          c.lastRt[p] = {counter: m.flags, accepted};
          c.wantBroadcast = true;
        } else accepted = 0;
      } else if (c.mode && m.step === c.step) {
        if (c.turnSeen[p].step === c.step) accepted = c.turnSeen[p].accepted;
        else {
          const ok = c.mode.inst.action ? safe("mode action", () => c.mode.inst.action(p, m.action, m.arg, m.data, {step: m.step, counter: 0})) : false;
          accepted = ok ? 1 : 0;
          if (ok) c.turnSeen[p] = {step: c.step, accepted};
          c.wantBroadcast = true;
        }
      }
      send(srcNode, "ack", {step: m.step, ackedSeq: m.hdr.seq, accepted, counter: rt ? m.flags : 0});
    }

    c.tick = function (now) {
      if (!c.powered) return;
      for (let p = 0; p < 2; p++) {
        if (c.links[p] && now - c.heard[p] > C.PLAYER_TIMEOUT_MS) { c.links[p] = false; c.wantBroadcast = true; log("P" + (p + 1) + " link lost"); }
      }
      const want = !!c.mode && (c.manual !== null || !(c.links[0] && c.links[1]));
      if (want !== c.paused) {
        c.paused = want;
        if (want) c.pausedSince = now;
        else if (c.pausedSince != null) { c.pausedTotal += now - c.pausedSince; c.pausedSince = null; }
        if (c.mode) safe(want ? "mode pause" : "mode resume", () => (want ? c.mode.inst.pause : c.mode.inst.resume) && (want ? c.mode.inst.pause() : c.mode.inst.resume()));
        c.wantBroadcast = true;
      }
      safe("session.tick", () => c.session.tick(now));
      const m = c.mode;
      if (m && !c.paused && m.inst.tick) safe("mode " + m.def.id + " tick", () => m.inst.tick(now));
      if (c.mode && !c.mode.overReported) {
        const res = api.over();
        if (res) { c.mode.overReported = true; safe("session.modeOver", () => c.session.modeOver(res)); c.wantBroadcast = true; }
      }
      // lobby first: a new match / phase reaches the boards before the mode
      // state of the same tick (frames from one radio are never reordered)
      const lf = lobbyFields();
      const js = JSON.stringify(lf);
      const period = c.mode ? C.LOBBY_MODE_MS : C.LOBBY_IDLE_MS;
      if (js !== c.lobbyJson || now - c.lobbyAt >= period) {
        c.lobbyJson = js; c.lobbyAt = now; c.lobbySnap = lf;
        send(0xff, "lobby", lf);
      }
      if (c.mode && (c.wantBroadcast || now - c.mode.lastBroadcast >= (c.mode.def.central.periodMs || C.STATE_PERIOD_MS))) broadcastMode();
      c.wantBroadcast = false;
    };

    c.view = function () {
      const s = c.lobbySnap || lobbyFields();
      const sp = c.session.pausePending || [false, false];
      return {
        version: radio.nodes[0].ver, powered: c.powered, boot: c.boot, step: c.step, match: c.match,
        links: c.links.slice(), paused: c.paused, pausedBy: c.manual ? c.manual.by : null, pausePending: sp.slice(),
        session: {phase: s.phase, mode: s.mode, hover: s.hover.map(h => h & 0x0f), presence: s.hover.map(h => h >> 4),
          vote: s.vote.slice(), ready: s.readyMask, rematch: s.rematchMask, wins: [s.wins.slice(0, 3), s.wins.slice(3, 6)],
          profiles: s.profile.map(pr => ({name: Array.isArray(pr.name) ? bytesToStr(pr.name) : pr.name, avatar: pr.avatar, color: pr.color})),
          error: s.error},
        counters: c.counters.slice(),
        mode: c.mode ? {id: c.mode.def.id, snapshot: c.mode.lastSnap} : null,
        log: c.log.slice(),
      };
    };
    return c;
  }

  // Core stub session (§8.7): vote -> agree -> lobby -> ready -> mode, with
  // the session rules of §1.3 / §7.6 kept simple. autoMode ("?mode=x" or
  // DEVICE.reset({mode})): start that mode as soon as both are here and
  // restart it after each match. screens-menu.js replaces it (registerSession).
  function stubSession(api, autoMode) {
    const L = C.LOBBY, A = C.ACT;
    const s = {
      phase: L.WAIT, mode: 0xff, ui: [0xff, 0xff], presence: [0, 0], vote: [0xff, 0xff], ready: 0, rematch: 0,
      wins: [0, 0, 0, 0, 0, 0], ev: {id: 0, type: 0, who: 0}, modeRes: [0, 0, 0, 0],
      waitUntil: null, agreedUntil: 0, overAt: null, pausePending: [false, false], pausedBy: 0xff,
    };
    const present = p => api.links()[p] && api.profiles()[p] && s.presence[p] !== C.PRESENCE.LOGIN;
    const event = (type, who) => { s.ev = {id: (s.ev.id + 1) & 0xff || 1, type, who}; api.broadcast(); };
    const modeIdOf = id => { const d = DEVICE.mode(id); return d ? d.modeId : 0xff; };
    function enterSelect() { s.phase = L.SELECT; s.vote = [0xff, 0xff]; s.ready = 0; s.rematch = 0; api.nextStep(); api.broadcast(); }
    function start(opts) {
      s.rematch = 0; s.overAt = null; s.pausePending = [false, false];
      s.phase = L.IN_MODE;
      api.startMode(s.mode, opts);
    }
    return {
      get pausePending() { return s.pausePending; },
      get _s() { return s; },
      hello() { api.broadcast(); },
      ui(p, hover, presence) { s.ui[p] = (presence << 4) | hover; s.presence[p] = presence; },
      action(p, a, arg) {
        if (a === A.VOTE) {
          if (s.phase !== L.SELECT) return false;
          if (arg !== 0xff && !DEVICE.mode(arg)) return false;
          s.vote[p] = arg;
          if (s.vote[0] !== 0xff && s.vote[0] === s.vote[1]) { s.phase = L.AGREED; s.mode = s.vote[0]; s.agreedUntil = api.now() + 1000; api.nextStep(); }
          api.broadcast();
          return true;
        }
        if (a === A.READY) {
          if (s.phase !== L.LOBBY || s.presence[p] === C.PRESENCE.SETTINGS) return false;
          s.ready = arg ? s.ready | (1 << p) : s.ready & ~(1 << p);
          api.broadcast();
          return true;
        }
        if (a === A.LEAVE) {
          if (s.phase === L.LOBBY) { enterSelect(); event(C.SEV.LEFT, p); return true; }
          if (s.phase === L.IN_MODE) {
            if (autoMode) { start({rematch: true}); return true; }
            api.endMode(); enterSelect(); event(C.SEV.LEFT, p); return true;
          }
          return false;
        }
        if (a === A.PAUSE) {
          if (s.phase !== L.IN_MODE || api.over()) return false;
          if (!arg) { s.pausePending[p] = false; api.resume(); s.pausedBy = 0xff; return true; }
          const when = api.canPause(p);
          if (when === "now") { api.pause(p); s.pausedBy = p; return true; }
          if (when === "defer") { s.pausePending[p] = true; event(C.SEV.PAUSE_LATER, p); return true; }
          return false;
        }
        if (a === A.REMATCH) {
          const res = api.over();
          if (s.phase !== L.IN_MODE || !res) return false;
          s.rematch |= 1 << p;
          api.broadcast();
          if (s.rematch === 3) start({rematch: true, first: res.winner === 0 ? 1 : 0, retryRoom: arg === 1});
          return true;
        }
        if (a === A.QUIT) {
          if (s.phase !== L.IN_MODE) return false;
          api.resume(); s.pausedBy = 0xff; s.pausePending = [false, false];
          api.quitMode(p); event(C.SEV.QUIT, p);
          return true;
        }
        return false;
      },
      tick(now) {
        if (s.phase !== L.IN_MODE) {
          const both = present(0) && present(1);
          if (!both) {
            if (s.phase !== L.WAIT) { s.phase = L.WAIT; s.vote = [0xff, 0xff]; s.ready = 0; s.rematch = 0; api.nextStep(); api.broadcast(); }
            s.waitUntil = null;
          } else if (s.phase === L.WAIT) {
            if (s.waitUntil === null) s.waitUntil = now + 1000;
            if (now >= s.waitUntil) {
              if (autoMode) { s.mode = modeIdOf(autoMode); start({}); } else enterSelect();
            }
          } else if (s.phase === L.AGREED && now >= s.agreedUntil) {
            s.phase = L.LOBBY; s.ready = 0; api.nextStep(); api.broadcast();
          } else if (s.phase === L.LOBBY) {
            for (let p = 0; p < 2; p++) if (s.presence[p] === C.PRESENCE.SETTINGS && (s.ready & (1 << p))) { s.ready &= ~(1 << p); api.broadcast(); }
            if (s.ready === 3) start({});
          }
        } else {
          if (!api.mode()) { if (!autoMode) enterSelect(); else start({}); return; }
          for (let p = 0; p < 2; p++) {
            if (s.pausePending[p] && api.canPause(p) === "now") { s.pausePending[p] = false; api.pause(p); s.pausedBy = p; }
          }
          if (autoMode && api.over()) {
            if (s.overAt === null) s.overAt = now;
            if (now - s.overAt > 4000) { const r = api.over(); start({rematch: true, first: r && r.winner === 0 ? 1 : 0}); }
          }
        }
      },
      snapshot() {
        const prof = api.profiles();
        return {
          phase: s.phase, mode: s.mode, hover: s.ui.slice(), vote: s.vote.slice(), readyMask: s.ready, rematchMask: s.rematch,
          pausedBy: api.paused() ? s.pausedBy : 0xff,
          wins: s.wins.slice(),
          profile: [0, 1].map(p => prof[p] && s.presence[p] !== C.PRESENCE.LOGIN ? {name: prof[p].name, avatar: prof[p].avatar, color: prof[p].color} : EMPTY_PROFILE),
          modesBuilt: R.modes.reduce((m, d) => d.modeId < 8 ? m | (1 << d.modeId) : m, 0),
          evId: s.ev.id, evType: s.ev.type, evWho: s.ev.who, error: 0, modeRes: s.modeRes.slice(),
        };
      },
      modeOver(res) {
        if (res.winner === 0 || res.winner === 1) {
          const d = DEVICE.mode(s.mode);
          const k = res.winner * 3 + (d && d.modeId < 3 ? d.modeId : 0);
          s.wins[k] = Math.min(255, s.wins[k] + 1);
        }
        if (Array.isArray(res.res)) s.modeRes = [0, 1, 2, 3].map(i => (res.res[i] | 0) & 0xff);
        api.broadcast();
      },
    };
  }

  /* ================= 9. handheld ================= */

  const DEFAULT_SETTINGS = () => ({volume: 3, clicks: true, pad: "auto", padCal: {min: C.FSR_REST, max: C.FSR_PEAK}, padCalSet: false, channel: 15, lang: LANG});
  const PRESENCE_LOCAL = {settings: 2, "settings.cal": 2};
  const SYSTEM_MENU = new Set(["connect", "menu", "lobby"]);

  DEVICE.defaultSettings = DEFAULT_SETTINGS;   // [+] S09 "restore default" (S key)
  // -> {data, corrupt}; corrupt = something was stored but it is not a profile record (W3)
  function loadFlash(world, p) {
    if (world.flashMem) return {data: world.flashMem[p] || null, corrupt: false};
    let raw = null;
    try { raw = localStorage.getItem("pr.device.flash." + p); } catch { return {data: null, corrupt: false}; }
    if (raw == null) return {data: null, corrupt: false};
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === "object" && !Array.isArray(v)) return {data: v, corrupt: false};
    } catch {}
    return {data: null, corrupt: true};
  }
  function saveFlash(world, p, data) {
    if (world.flashMem) { world.flashMem[p] = JSON.parse(JSON.stringify(data)); return; }
    try { localStorage.setItem("pr.device.flash." + p, JSON.stringify(data)); } catch {}
  }

  function makeHandheld(world, p, dom) {
    const wr = world.streams.world;
    const hh = {
      world, p, node: p + 1,
      offset: wr.int(10001),
      bootNonce: 1 + wr.int(255),
      hw: {caps: Object.assign({joy: true, pad: true, snd: true}, (world.opts.caps || [])[p] || {})},
      screenId: null, screenDef: null, screenParams: null, screenGen: 0, s: {}, m: null,
      ov: null,      // {id, def, s, lingerUntil}
      lockUntil: 0, nextFrame: 0, texts: [], lastTexts: [], tmap: new Map(), overBudget: 0,
      sfxLog: [], toastRec: null, fx: {border: null, pops: [], dissolves: []},
      bot: false, ctl: null, presenceOverride: null, hover: 0,
      lobby: null, lobbyPrev: null, state: null, stateName: null, stateAt: 0, stateModeDef: null,
      lastNonInModeLobbyStep: -1, lastLobbyStep: -1, lastModeStep: -1, lastStateMs: -1e9, centralBoot: null,
      rxTimes: [], badTimes: [], goodTimes: [],
      link: {up: false, gotState: false, rxPerSec: 0, helloAcked: false, inMode: false, match: -1},
      pendingAct: null, rtQueue: [], rtCounter: 0, lastHeartbeat: -1e9, lastHello: -1e9, helloResend: 0, matchColor: null, extraInput: null,
      pausedSince: null, pausedTotal: 0,
      invertUntil: 0, shakeAt: -1e9,
      mLobbyMatch: -1, mAhead: false,   // legacy-layout modes: lobby match behind m, m started early (newMatch)
      ctls: {}, modeBotOn: false, sentCaps: null, lastPushed: [],
      dom,
    };
    const fl = loadFlash(world, p);
    const flash = fl.data || {};
    hh.flash = {
      slots: Array.isArray(flash.slots) ? flash.slots.slice(0, 3).concat([null, null, null]).slice(0, 3) : [null, null, null],
      cur: flash.cur || null,
      settings: Object.assign(DEFAULT_SETTINGS(), flash.settings || {}),
    };
    if (world.opts.freshFlash) hh.flash = {slots: [null, null, null], cur: null, settings: DEFAULT_SETTINGS()};
    hh.settings = JSON.parse(JSON.stringify(hh.flash.settings));
    hh.settings.lang = LANG;
    if (world.opts.pad) hh.settings.pad = world.opts.pad;
    hh.settingsDirty = false;
    hh.local = {booted: !!world.opts.skipBoot, stack: [], loggedIn: !!hh.flash.cur, confirm: null, hover: 0, flashReset: fl.corrupt};
    const preset = (world.opts.profiles || [])[p];
    if (preset) { hh.flash.cur = {slot: "guest", profile: normProfile(preset)}; hh.local.loggedIn = true; }
    world.radio.nodes[hh.node].ch = hh.settings.channel;
    hh.g = makeGfx(hh);
    hh.input = makeInput(hh);
    hh.now = () => world.clock + hh.offset;
    hh.padOn = () => hh.settings.pad === "on" || (hh.settings.pad === "auto" && hh.input.st.padPresent && hh.hw.caps.pad);
    hh.repeatCfg = () => {
      const d = (hh.ov && hh.ov.def) || hh.screenDef;
      const r = d && d.repeat;
      return {delay: r && r.delay || C.CTL_JOY_REPEAT_DELAY_MS, rate: r && r.rate || C.CTL_JOY_REPEAT_MS};
    };
    hh.ctx = makeCtx(hh);
    world.radio.nodes[hh.node].rx = (bytes) => onRadio(hh, bytes);
    world.radio.nodes[hh.node].bad = () => { hh.badTimes.push(hh.now()); };
    return hh;
  }
  const normProfile = pr => ({name: String(pr.name || "P").toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 6) || "P", avatar: (pr.avatar | 0) % 6, color: (pr.color | 0) % 6});

  function currentProfile(hh) {
    const cur = hh.flash.cur;
    if (!cur || !hh.local.loggedIn) return null;
    if (cur.slot === "guest") return cur.profile || null;
    return hh.flash.slots[cur.slot] || null;
  }
  // [+] the profile other boards see: the saved one, with this match's colour
  // when it clashed with the rival's (§2.2 / S05: P2 takes the next free colour)
  function liveProfile(hh) {
    const pr = currentProfile(hh);
    return pr && hh.matchColor != null ? Object.assign({}, pr, {color: hh.matchColor}) : pr;
  }
  function setMatchColor(hh, c) {
    c = c == null ? null : (c | 0) % 6;
    if (c === hh.matchColor) return false;
    hh.matchColor = c;
    hh.helloResend = 3; hh.lastHello = -1e9;
    return true;
  }
  // [+] §2.2: same colour as the rival -> P2 plays this match in the next colour
  // (the saved profile keeps its own). Re-checked on every lobby, so it also
  // follows a profile edit on either board; cleared at logout / profile change.
  const PLAYER_COLOR_NAMES = ["red", "orange", "gold", "green", "blue", "white"];   // dev.login.c.*
  function checkColorClash(hh) {
    if (hh.p !== 1) { setMatchColor(hh, null); return; }
    const pr = currentProfile(hh), rival = hh.ctx.rival();
    if (!pr || !rival) return;
    const own = (pr.color | 0) % 6;
    if ((rival.color | 0) % 6 !== own) { setMatchColor(hh, null); return; }
    const c = (own + 1) % 6;
    if (setMatchColor(hh, c) && R.strings.keys.has("dev.login.colorClash"))
      hh.ctx.toast("dev.login.colorClash", {c: hh.ctx.t("dev.login.c." + PLAYER_COLOR_NAMES[c])});
  }
  function writeFlash(hh) {
    hh.flash.settings = JSON.parse(JSON.stringify(hh.settings));
    saveFlash(hh.world, hh.p, hh.flash);
    hh.settingsDirty = false;
  }
  function modeOfState(name) { return R.modes.find(m => m.stateMsg === name) || null; }
  function modeScreenPrefix(def) { return def && def.stateMsg ? def.stateMsg.split(".")[0] + "." : null; }

  function makeCtx(hh) {
    const world = hh.world;
    const ctx = {
      get p() { return hh.p; },
      now: () => hh.now(),
      gameNow: () => hh.now() - hh.pausedTotal - (hh.pausedSince != null ? hh.now() - hh.pausedSince : 0),
      get g() { return hh.g; },
      get input() { return hh.input.st; },
      hw: {
        get caps() { return hh.hw.caps; },
        invert(ms = 60) { hh.invertUntil = hh.now() + ms; },
        shake() { hh.shakeAt = hh.now(); },
        get protocol() { return world.radio.nodes[hh.node].ver; },   // [+] flashed protocol version (S01 "v6", About)
        get channel() { return world.radio.nodes[hh.node].ch; },     // [+] channel the radio is on now
        fwBuild: 1,                                                    // [+]
      },
      get lobby() { return hh.lobby; },
      get state() { return hh.state; },
      stateAge: () => hh.state ? hh.now() - hh.stateAt : Infinity,
      get link() { return hh.link; },
      rival() {
        const l = hh.lobby;
        if (!l) return null;
        const pr = l.profile[1 - hh.p];
        const name = bytesToStr(pr.name);
        if (!name) return null;
        return {name, avatar: pr.avatar, color: pr.color, presence: l.hover[1 - hh.p] >> 4};
      },
      get settings() { return hh.settings; },
      get s() { return hh.s; }, set s(v) { hh.s = v; },
      get m() { return hh.m; }, set m(v) { hh.m = v; },
      get local() { return hh.local; },
      t(key, vars) {
        const s = I18N.t(key, vars);
        hh.tmap.set(s, key);
        return s;
      },
      get rng() { return world.streams["fx." + hh.p]; },
      get screenId() { return hh.screenId; },
      get overlayId() { return hh.ov ? hh.ov.id : null; },
      lingering: false,
      me: () => liveProfile(hh),
      color: () => { const pr = liveProfile(hh); return playerColor(pr ? pr.color : hh.p === 0 ? 0 : 4); },
      padOn: () => hh.padOn(),
      held: b => hh.input.held(b),
      mode: () => hh.link.inMode ? hh.stateModeDef : null,
      params: id => DEVICE.params(id),
      error: () => hh.error || null,

      go(id, params) {
        const def = R.screens[id];
        if (!def || !def.local) { lint("go", id, "not a local screen"); return; }
        if (hh.local.stack.length >= 4) { lint("stack", id, "stack is full (4)"); return; }
        hh.local.stack.push({id, params: params || null});
      },
      back() {
        const top = hh.local.stack.pop();
        if (top && top.id === "settings") leaveSettings(hh);
      },
      confirm(o) { hh.local.confirm = Object.assign({holdMs: 0}, o); },
      closeConfirm(yes) {
        const c = hh.local.confirm;
        hh.local.confirm = null;
        if (c) safe("confirm", () => (yes ? c.onYes : c.onNo) && (yes ? c.onYes() : c.onNo()));
      },
      setPresence(v) { hh.presenceOverride = v == null ? null : v; },

      profiles: {
        list: () => hh.flash.slots.map(s => s ? Object.assign({}, s) : null),
        current: () => {
          const cur = hh.flash.cur;
          if (!cur || !hh.local.loggedIn) return null;
          const profile = currentProfile(hh);
          return profile ? {slot: cur.slot, profile: Object.assign({}, profile), matchColor: hh.matchColor} : null;
        },
        select(slot, guestProfile) {
          if (slot === "guest") hh.flash.cur = {slot: "guest", profile: normProfile(guestProfile || DEVICE.guestProfile(ctx.rng))};
          else if (hh.flash.slots[slot]) hh.flash.cur = {slot};
          else return false;
          hh.local.loggedIn = true;
          hh.matchColor = null;
          hh.helloResend = 3; hh.lastHello = -1e9;
          writeFlash(hh);
          return true;
        },
        save(slot, profile) {
          const old = hh.flash.slots[slot] || {wins: 0, bestLapCs: 0, advStars: 0};
          hh.flash.slots[slot] = Object.assign({}, old, normProfile(profile));
          if (hh.flash.cur && hh.flash.cur.slot === slot) { hh.helloResend = 3; hh.lastHello = -1e9; }
          writeFlash(hh);
        },
        remove(slot) {
          hh.flash.slots[slot] = null;
          if (hh.flash.cur && hh.flash.cur.slot === slot) { hh.flash.cur = null; hh.local.loggedIn = false; hh.local.stack = []; hh.matchColor = null; }
          writeFlash(hh);
        },
        logout() {
          hh.local.loggedIn = false; hh.flash.cur = null; hh.local.stack = []; hh.matchColor = null;
          writeFlash(hh);
        },
        bumpStats(o = {}) {
          const cur = hh.flash.cur;
          if (!cur || cur.slot === "guest" || !hh.flash.slots[cur.slot]) return {newBest: false};
          const s = hh.flash.slots[cur.slot];
          let newBest = false;
          if (o.battleWins) s.wins = (s.wins || 0) + o.battleWins;
          if (o.bestLapCs && (!s.bestLapCs || o.bestLapCs < s.bestLapCs)) { s.bestLapCs = o.bestLapCs; newBest = true; }
          if (o.advStars && o.advStars > (s.advStars || 0)) { s.advStars = o.advStars; newBest = true; }
          writeFlash(hh);
          return {newBest};
        },
      },
      saveSettings(patch) { Object.assign(hh.settings, patch); hh.settingsDirty = true; },
      setLanguage(lang) {
        if (lang === LANG) return;
        // [+] each login also carries its profile: under ?test=1 (or with storage
        // blocked) the "flash" does not survive the reload, and a login whose
        // slot came back empty would leave the board logged in with no profile
        world.langDraft = {p: hh.p, screen: hh.screenId, logins: world.hh.map(h => h.flash.cur && h.local.loggedIn
          ? Object.assign({}, h.flash.cur, h.flash.cur.slot === "guest" ? {} : {saved: h.flash.slots[h.flash.cur.slot] || null}) : null)};
        for (const h of world.hh) writeFlash(h);
        if (typeof I18N.keepDraft !== "function") {
          try { sessionStorage.setItem("pr.device.langDraft", JSON.stringify(world.langDraft)); } catch {}
        }
        I18N.set(lang);
      },
      setHover(card) { hh.local.hover = card | 0; },

      act(action, arg = 0, data = [0, 0, 0]) {
        const step = hh.state ? hh.state.step : hh.lobby ? hh.lobby.step : 0;
        hh.pendingAct = {step, action, arg, data: data.slice(0, 3).concat([0, 0, 0]).slice(0, 3), last: -1e9};
        flushAct(hh);
      },
      rt(action, arg = 0, data = [0, 0, 0]) {
        const q = hh.rtQueue;
        const dup = q.find(e => e.action === action && !e.sent);
        if (dup) { dup.arg = arg; dup.data = data.slice(0, 3).concat([0, 0, 0]).slice(0, 3); return true; }
        if (q.length >= 4) {
          // drop the oldest repeatable USE / POWER / PING that is not in flight
          const droppable = q.findIndex((e, i) => (i > 0 || !e.sent) && [C.ACT.ADV_USE, C.ACT.ADV_POWER, C.ACT.ADV_PING].includes(e.action));
          if (droppable < 0) { ctx.sfx("ui_deny"); return false; }
          q.splice(droppable, 1);
        }
        hh.rtCounter = hh.rtCounter % 255 + 1;
        q.push({action, arg, data: data.slice(0, 3).concat([0, 0, 0]).slice(0, 3), counter: hh.rtCounter, sent: false, last: -1e9});
        flushRt(hh);
        return true;
      },
      send(name, fields) { radioSend(hh, name, fields); },
      sendInputNow() { sendHeartbeat(hh); hh.extraInput = hh.now() + 20; },
      padLevel: (st, dt) => DEVICE.padLevel.update(st, hh.input.st, hh.settings, dt),
      sfx: id => playSfx(hh, id),
      tone: hz => setTone(hh, hz),
      fx: {
        wipe: () => hh.g.wipe(),
        border: (color, ms = 120) => { col(color); hh.fx.border = {color, until: hh.now() + ms}; },
        pop: (text, x, y, color = "danger") => { hh.fx.pops.push({text: String(text), x, y, color, at: hh.now()}); },
        dissolve: (x, y, w, h) => { hh.fx.dissolves.push({x, y, w, h, at: hh.now()}); },
      },
      toast(key, vars, ms = C.TOAST_MS) { hh.toastRec = {key, vars, until: hh.now() + ms}; },
    };
    return ctx;
  }

  function leaveSettings(hh) {
    writeFlash(hh);
    const node = hh.world.radio.nodes[hh.node];
    if (node.ch !== hh.settings.channel) {
      node.ch = hh.settings.channel;
      clearLinkRecords(hh);
    }
  }
  function clearLinkRecords(hh) {
    if (hh.m && hh.stateModeDef) safe("mode destroy", () => hh.stateModeDef.player.destroy && hh.stateModeDef.player.destroy(hh.ctx));
    hh.m = null;
    Object.assign(hh, {lobby: null, lobbyPrev: null, state: null, stateName: null, stateModeDef: null,
      lastNonInModeLobbyStep: -1, lastLobbyStep: -1, lastModeStep: -1, pendingAct: null, rtQueue: [], centralBoot: null,
      mLobbyMatch: -1, mAhead: false});
    hh.link.gotState = false; hh.link.inMode = false; hh.link.match = -1; hh.link.helloAcked = false;
    setTone(hh, 0);
  }

  function radioSend(hh, name, fields) {
    try { hh.world.radio.send(hh.node, 0, DEVICE.pack(name, fields)); } catch (e) { recordError("P" + (hh.p + 1) + " send " + name, e); }
  }
  function flushAct(hh) {
    const a = hh.pendingAct;
    if (!a) return;
    a.last = hh.now();
    radioSend(hh, "action", {step: a.step, action: a.action, arg: a.arg & 0xff, flags: 0, data: a.data});
  }
  function flushRt(hh) {
    const e = hh.rtQueue[0];
    if (!e) return;
    e.sent = true; e.last = hh.now();
    const step = hh.state ? hh.state.step : hh.lobby ? hh.lobby.step : 0;
    radioSend(hh, "action", {step, action: e.action, arg: e.arg & 0xff, flags: e.counter, data: e.data});
  }
  function presenceOf(hh) {
    const top = hh.local.stack[hh.local.stack.length - 1];
    if (!hh.local.loggedIn) return C.PRESENCE.LOGIN;
    if (top) return PRESENCE_LOCAL[top.id] != null ? PRESENCE_LOCAL[top.id] : 2;
    if (hh.presenceOverride != null) return hh.presenceOverride;
    if (SYSTEM_MENU.has(hh.screenId) || hh.screenId === "boot" || hh.screenId === "login") return 1;
    return 3;
  }
  function sendHeartbeat(hh) {
    const st = hh.input.st;
    const def = hh.link.inMode ? hh.stateModeDef : null;
    let bits = 0;
    if (def && def.player.inputBits) bits = (safe("inputBits", () => def.player.inputBits(hh.ctx)) | 0) & 0xf0;
    const buttons = (st.a ? 1 : 0) | (st.b ? 2 : 0) | (st.skill ? 4 : 0) | (st.menu ? 8 : 0) | bits;
    let pressure = st.pressure;
    if (!hh.padOn()) {
      hh.hbPad = hh.hbPad || DEVICE.padLevel.create();
      const lvl = DEVICE.padLevel.update(hh.hbPad, st, Object.assign({}, hh.settings, {pad: "off"}), hh.now() - (hh.hbPadAt || hh.now()));
      pressure = lvl > 0 ? Math.round(C.CTL_PRESS_START + lvl * (C.CTL_PRESS_FULL - C.CTL_PRESS_START) / 100) : 0;
    }
    hh.hbPadAt = hh.now();
    const hover = hh.screenId === "menu" ? hh.local.hover & 0x0f : 0x0f;
    let f = {joyX: clamp(Math.round(st.x), -100, 100), joyY: clamp(Math.round(st.y), -100, 100), buttons, pressure};
    // [+] the mode may patch what goes up (adventure: 6 s cap on the no-pad winch hold, §6.3)
    if (def && def.player.uplink) {
      const r = safe("mode " + def.id + " uplink", () => def.player.uplink(hh.ctx, Object.assign({}, f)));
      if (r && typeof r === "object") f = {joyX: clamp(Math.round(+r.joyX || 0), -100, 100), joyY: clamp(Math.round(+r.joyY || 0), -100, 100),
        buttons: (r.buttons | 0) & 0xff, pressure: clamp(Math.round(+r.pressure || 0), 0, 255)};
    }
    f.ui = (presenceOf(hh) << 4) | hover;
    radioSend(hh, "input", f);
    hh.lastHeartbeat = hh.now();
  }
  const capsOf = hh => (hh.hw.caps.pad && hh.input.st.padPresent ? 1 : 0) | (hh.hw.caps.joy ? 2 : 0) | (hh.hw.caps.snd ? 4 : 0);
  function sendHello(hh) {
    const pr = liveProfile(hh);
    if (!pr) return;
    const caps = capsOf(hh);
    radioSend(hh, "hello", {nick: pr.name, avatar: pr.avatar, color: pr.color, caps, bootNonce: hh.bootNonce, fwBuild: 1});
    hh.sentCaps = caps;
    hh.lastHello = hh.now();
  }

  function linkTick(hh) {
    const now = hh.now();
    const def = hh.link.inMode ? hh.stateModeDef : null;
    let beat = true;
    if (def) {
      const hb = def.player.heartbeat;
      if (typeof hb === "function") beat = !!safe("heartbeat", () => hb(hh.ctx));
      else if (hb === false) beat = paused(hh) || hh.screenId === "results" || /\.pick$/.test(hh.screenId || "");
    }
    if (beat && now - hh.lastHeartbeat >= C.INPUT_PERIOD_MS) sendHeartbeat(hh);
    if (hh.extraInput != null && now >= hh.extraInput) { hh.extraInput = null; sendHeartbeat(hh); }
    if (hh.sentCaps != null && capsOf(hh) !== hh.sentCaps && hh.helloResend === 0) { hh.helloResend = 1; hh.lastHello = -1e9; }
    if (hh.local.loggedIn && (!hh.link.helloAcked || hh.helloResend > 0) && now - hh.lastHello >= C.HELLO_MS) {
      sendHello(hh);
      if (hh.helloResend > 0) hh.helloResend--;
    }
    if (hh.pendingAct && now - hh.pendingAct.last >= C.ACTION_RETRY_MS) flushAct(hh);
    if (hh.rtQueue.length && now - hh.rtQueue[0].last >= C.ACTION_RETRY_MS) flushRt(hh);
    // link status
    while (hh.rxTimes.length && hh.rxTimes[0] <= now - 1000) hh.rxTimes.shift();
    while (hh.badTimes.length && hh.badTimes[0] <= now - 2000) hh.badTimes.shift();
    while (hh.goodTimes.length && hh.goodTimes[0] <= now - 2000) hh.goodTimes.shift();
    hh.link.rxPerSec = Math.min(10, hh.rxTimes.length);
    hh.link.up = now - hh.lastStateMs <= C.CENTRAL_TIMEOUT_MS;
    const e1 = hh.badTimes.length > 0 && hh.goodTimes.length === 0 && now - hh.badTimes[0] >= 0 && hh.badTimes.length >= 3;
    const e2 = hh.lobby && hh.lobby.error === 2;
    hh.error = e1 ? {code: "E1", board: hh.world.radio.nodes[hh.node].ver, central: hh.world.radio.nodes[hh.node].lastBadVersion}
      : e2 ? {code: "E2", board: hh.world.radio.nodes[hh.node].ver, central: null} : null;
    // game clock: pause time does not count
    const isPaused = paused(hh);
    if (isPaused && hh.pausedSince == null) hh.pausedSince = now;
    if (!isPaused && hh.pausedSince != null) { hh.pausedTotal += now - hh.pausedSince; hh.pausedSince = null; }
  }
  const paused = hh => {
    const s = hh.link.inMode ? hh.state : hh.lobby;
    return !!(s && hh.link.inMode && (s.flags & C.FLAG.PAUSED));
  };
  const bothLinks = hh => {
    const s = hh.link.inMode && hh.state ? hh.state : hh.lobby;
    return !!s && (s.flags & 6) === 6;
  };

  function onRadio(hh, bytes) {
    let m;
    try { m = DEVICE.unpack(bytes); } catch (e) { recordError("P" + (hh.p + 1) + " unpack", e); return; }
    const now = hh.now();
    if (m.name === "ack") return onAck(hh, m);
    const d = R.msgs[m.name];
    if (m.name !== "lobby" && (!d || d.kind !== "mode")) return;
    hh.goodTimes.push(now);
    hh.rxTimes.push(now);
    hh.lastStateMs = now;
    hh.link.gotState = true;
    if (m.name === "lobby") {
      if (hh.centralBoot !== null && m.centralBoot !== hh.centralBoot) {
        clearLinkRecords(hh);
        hh.local.stack = [];
        hh.dropOverlay = true;          // no "reconnected" linger: the toast says what happened
        hh.ctx.toast("dev.ov.centralReset");
        hh.link.gotState = true;
      }
      hh.centralBoot = m.centralBoot;
      const prev = hh.lobby;
      hh.lobbyPrev = prev; hh.lobby = m;
      hh.lastLobbyStep = m.step;
      if (m.phase !== C.LOBBY.IN_MODE) hh.lastNonInModeLobbyStep = Math.max(hh.lastNonInModeLobbyStep, m.step);
      hh.link.helloAcked = m.helloNonce[hh.p] === hh.bootNonce;
      updateInMode(hh);
      deliverState(hh, m, prev, false);
      // session events seen on every screen: the core tells the asker about a deferred pause
      if (prev && m.evId !== prev.evId && m.evType === C.SEV.PAUSE_LATER && m.evWho === hh.p) hh.ctx.toast("dev.core.pauseLater");
      safe("colorClash", checkColorClash, hh);
      for (const fn of R.lobbyHooks) safe("onLobby", fn, hh.ctx, m, prev);
      return;
    }
    const def = modeOfState(m.name);
    if (!def) return;
    if (m.step <= hh.lastNonInModeLobbyStep) return;                     // from a match that has ended
    if (m.step < hh.lastModeStep && hh.stateModeDef === def) return;   // stale
    hh.lastModeStep = m.step;
    // A new match re-creates m. New messages carry `match`; a legacy layout
    // (battle.state, v5) has none, so the lobby's match is used, and the mode
    // may spot the new match itself first (player.newMatch) when the lobby
    // that announces it was lost.
    const legacy = !!d.legacy;
    const lm = hh.lobby ? hh.lobby.match : 0;
    let fresh = false, ahead = hh.mAhead;
    if (hh.stateModeDef !== def) { fresh = true; ahead = false; }
    else if (!legacy) fresh = m.match !== hh.link.match;
    else if (lm !== hh.mLobbyMatch) {
      fresh = !(ahead && lm === hh.link.match);    // no: m already started the match this lobby announces
      ahead = false;
    } else if (def.player.newMatch && hh.state && safe("mode " + def.id + " newMatch", () => def.player.newMatch(hh.ctx, m, hh.state))) {
      fresh = true; ahead = true;
    }
    hh.mAhead = ahead;
    if (legacy) hh.mLobbyMatch = lm;
    if (fresh) {
      if (hh.m && hh.stateModeDef) safe("mode destroy", () => hh.stateModeDef.player.destroy && hh.stateModeDef.player.destroy(hh.ctx));
      hh.stateModeDef = def;
      hh.link.match = !legacy ? m.match : ahead ? (hh.link.match + 1) & 0xff : lm;
      hh.state = null;
      hh.m = safe("mode " + def.id + " player.create", () => def.player.create && def.player.create(hh.ctx)) || {};
    }
    const prev = hh.state;
    hh.state = m; hh.stateName = m.name; hh.stateAt = now;
    if (hh.pendingAct && m.step > hh.pendingAct.step) hh.pendingAct = null;
    updateInMode(hh);
    if (def.player.onState) safe("mode " + def.id + " onState", () => def.player.onState(hh.ctx, m, prev));
    deliverState(hh, m, prev, true);
  }
  function deliverState(hh, m, prev, isMode) {
    const pre = modeScreenPrefix(hh.stateModeDef);
    const isModeScreen = id => !!pre && !!id && id.startsWith(pre);
    if (hh.screenDef && hh.screenDef.state && isModeScreen(hh.screenId) === isMode) safe(hh.screenId + ".state", () => hh.screenDef.state(hh.ctx, m, prev));
    if (hh.ov && hh.ov.def.state) safe(hh.ov.id + ".state", () => hh.ov.def.state(hh.ov.ctx, m, prev));
  }
  function updateInMode(hh) {
    const was = hh.link.inMode;
    const is = !!hh.state && hh.state.step > hh.lastNonInModeLobbyStep;
    hh.link.inMode = is;
    if (is && !was) { hh.local.stack = []; hh.presenceOverride = null; }
    if (!is && was) {
      if (hh.stateModeDef) safe("mode destroy", () => hh.stateModeDef.player.destroy && hh.stateModeDef.player.destroy(hh.ctx));
      hh.m = null; hh.state = null; hh.stateModeDef = null; hh.link.match = -1; hh.lastModeStep = -1;
      hh.mLobbyMatch = -1; hh.mAhead = false;
      hh.presenceOverride = null;
      setTone(hh, 0);
    }
  }
  function onAck(hh, m) {
    if (m.counter === 0) {
      if (hh.pendingAct && m.step === hh.pendingAct.step) { hh.lastAck = m; hh.pendingAct = null; }
    } else if (hh.rtQueue[0] && m.counter === hh.rtQueue[0].counter) {
      hh.lastAck = m;
      hh.rtQueue.shift();
      if (hh.rtQueue.length) flushRt(hh);
    }
  }

  // §7.7 ui_route
  function route(hh) {
    const L = hh.local;
    if (!L.booted) return {id: "boot"};
    if (L.stack.length) { const top = L.stack[L.stack.length - 1]; return {id: top.id, params: top.params}; }
    if (!L.loggedIn) return {id: "login"};
    if (hh.link.inMode && hh.stateModeDef) {
      const def = hh.stateModeDef;
      const r = def.player.route ? safe("mode " + def.id + " route", () => def.player.route(hh.ctx)) : null;
      if (typeof r === "string") return {id: r, params: {mode: def.id}};
      if (r && r.id) return {id: r.id, params: Object.assign({mode: def.id}, r.params || {})};
      return {id: modeScreenPrefix(def) + "hud", params: {mode: def.id}};
    }
    if (!hh.lobby) return {id: "connect"};
    const ph = hh.lobby.phase;
    if (ph === C.LOBBY.WAIT) return {id: "connect"};
    if (ph === C.LOBBY.SELECT || ph === C.LOBBY.AGREED) return {id: "menu"};
    return {id: "lobby"};
  }
  function busy(hh) {
    const def = hh.link.inMode ? hh.stateModeDef : null;
    return !!(def && def.player.busy && safe("busy", () => def.player.busy(hh.ctx)));
  }
  // §7.7 overlay_route (+ error), without linger
  function overlayWant(hh) {
    const quiet = hh.local.stack.length > 0 || busy(hh);
    const now = hh.now();
    const menuOrLater = !["boot", "login", "connect"].includes(hh.screenId) && !(R.screens[hh.screenId] || {}).local;
    if (!quiet && hh.error) return "ov.error";
    if (!quiet && hh.link.gotState && menuOrLater && now - hh.lastStateMs > C.CENTRAL_TIMEOUT_MS) return "ov.nosignal";
    if (!quiet && paused(hh) && !bothLinks(hh)) return "ov.linklost";
    if (!quiet && paused(hh)) return "ov.pause";
    if (hh.local.confirm) return "ov.confirm";
    return null;
  }

  function switchScreen(hh, want) {
    const def = R.screens[want.id];
    if (!def) lint("missingScreen", want.id, "no screen registered");
    if (hh.screenDef && hh.screenDef.exit) safe(hh.screenId + ".exit", () => hh.screenDef.exit(hh.ctx));
    hh.screenGen++;
    hh.s = {};
    hh.screenId = want.id; hh.screenDef = def || null; hh.screenParams = want.params || null;
    hh.lockUntil = hh.now() + C.SCREEN_LOCK_MS;
    hh.input.latch();
    hh.menuArmed = false;          // a hold of M that began on the old screen does not pause
    hh.presenceOverride = hh.link.inMode ? hh.presenceOverride : null;
    hh.fx.border = null;           // [+] a flash from the old screen (e.g. the racing finish) does not reach the new one's first frame
    if (def && def.enter) safe(want.id + ".enter", () => def.enter(hh.ctx, want.params || null));
    hh.g.wipe();
    hh.nextFrame = hh.now();
  }
  function switchOverlay(hh, id) {
    if (hh.ov && hh.ov.def.exit) safe(hh.ov.id + ".exit", () => hh.ov.def.exit(hh.ov.ctx));
    // ctx.setPresence() belongs to the overlay that set it (S15's settings subpage):
    // it ends with that overlay, so the rival's "Resume" never stays greyed out
    if (hh.ov) hh.presenceOverride = null;
    if (!id) { hh.ov = null; hh.g.wipe(); return; }
    const def = R.screens[id];
    if (!def) { hh.ov = null; lint("missingScreen", id, "no overlay registered"); return; }
    const octx = Object.create(hh.ctx);
    const s = {};
    Object.defineProperty(octx, "s", {get: () => s, set: () => {}, configurable: true});
    Object.defineProperty(octx, "lingering", {get: () => !!(hh.ov && hh.ov.lingerUntil != null), configurable: true});
    hh.ov = {id, def, ctx: octx, s, lingerUntil: null};
    hh.lockUntil = hh.now() + C.SCREEN_LOCK_MS;
    if (def.enter) safe(id + ".enter", () => def.enter(octx, null));
    if (id !== "ov.confirm") hh.g.wipe();
    hh.nextFrame = hh.now();
  }
  function updateOverlay(hh) {
    if (hh.dropOverlay) { hh.dropOverlay = false; if (hh.ov) switchOverlay(hh, null); }
    const want = overlayWant(hh);
    const now = hh.now();
    if (hh.ov && want === hh.ov.id) { hh.ov.lingerUntil = null; return; }
    if (want) { switchOverlay(hh, want); return; }
    if (!hh.ov) return;
    if (hh.ov.lingerUntil == null) {
      const ms = hh.ov.def.linger ? (safe(hh.ov.id + ".linger", () => hh.ov.def.linger(hh.ov.ctx)) | 0) : 0;
      if (ms > 0) { hh.ov.lingerUntil = now + ms; return; }
      switchOverlay(hh, null);
    } else if (now >= hh.ov.lingerUntil) switchOverlay(hh, null);
  }

  function pauseGestureOk(hh) {
    if (!hh.link.inMode || hh.ov || hh.local.stack.length) return false;
    const pre = modeScreenPrefix(hh.stateModeDef);
    return !!pre && !!hh.screenId && hh.screenId.startsWith(pre) && !busy(hh);
  }
  function deliverEvents(hh, events) {
    for (const ev of events) {
      if (ev.gen !== hh.screenGen && ev.type !== "down") continue;              // press began on another screen
      if (ev.t < hh.lockUntil && ev.type !== "up") continue;                    // 150 ms lock after a change
      if (ev.btn === "MENU") {
        if (ev.type === "down") hh.menuArmed = pauseGestureOk(hh);
        if (ev.type === "long" && hh.menuArmed) {
          hh.menuArmed = false; hh.menuConsumed = true;
          if (pauseGestureOk(hh)) hh.ctx.rt(C.ACT.PAUSE, 1);
          continue;
        }
        if (ev.type === "long" && hh.link.inMode && !hh.ov && busy(hh)) continue;  // no pause while busy
        if ((ev.type === "up" || ev.type === "click") && hh.menuConsumed) { if (ev.type === "up") hh.menuConsumed = false; continue; }
      }
      const out = {btn: ev.btn, type: ev.type, t: ev.t, fromStick: !!ev.fromStick};
      if (hh.ov) { if (hh.ov.def.input) safe(hh.ov.id + ".input", () => hh.ov.def.input(hh.ov.ctx, out)); }
      else if (hh.screenDef && hh.screenDef.input) safe(hh.screenId + ".input", () => hh.screenDef.input(hh.ctx, out));
    }
  }

  function handheldTick(hh, t0, t1) {
    const ctx = hh.ctx;
    if (hh.bot && hh.ctl) {
      // With an overlay up only its bot plays (a mode bot's A would answer
      // the rival's pause menu); the mode bot plays the mode's own screens
      // (pick, HUD), never the system ones (results has its own bot).
      const md = hh.link.inMode ? hh.stateModeDef : null;
      const pre = modeScreenPrefix(md);
      const modeBot = !hh.ov && !!md && !!md.bot && !!pre && !!hh.screenId && hh.screenId.startsWith(pre);
      if (hh.modeBotOn && !modeBot) hh.input.releaseAll("bot");     // let go of what it was holding
      hh.modeBotOn = modeBot;
      if (hh.ov) { if (hh.ov.def.bot) safe(hh.ov.id + ".bot", () => hh.ov.def.bot(hh.ov.ctx, hh.ctl)); }
      else if (hh.screenDef && hh.screenDef.bot) safe(hh.screenId + ".bot", () => hh.screenDef.bot(ctx, hh.ctl));
      if (modeBot) safe("mode " + md.id + " bot", () => md.bot(ctx, hh.ctl));
    }
    const events = hh.input.process(t0, t1);
    linkTick(hh);
    const md = hh.link.inMode ? hh.stateModeDef : null;
    if (md && md.player.tick) safe("mode " + md.id + " player.tick", () => md.player.tick(ctx, C.TICK_MS));
    const want = route(hh);
    if (want.id !== hh.screenId) switchScreen(hh, want);
    updateOverlay(hh);
    deliverEvents(hh, events);
    if (hh.screenDef && hh.screenDef.tick) safe(hh.screenId + ".tick", () => hh.screenDef.tick(ctx, C.TICK_MS));
    if (hh.ov && hh.ov.def.tick) safe(hh.ov.id + ".tick", () => hh.ov.def.tick(hh.ov.ctx, C.TICK_MS));
    if (hh.settingsDirty && !hh.link.inMode && !hh.local.stack.length) writeFlash(hh);
    const now = hh.now();
    if (now >= hh.nextFrame) {
      const spi = renderFrame(hh);
      const d = (hh.ov && hh.ov.def) || hh.screenDef;
      let fps = d && d.fps != null ? (typeof d.fps === "function" ? safe("fps", () => d.fps(hh.ov ? hh.ov.ctx : ctx)) : d.fps) : 30;
      if (hh.ov && hh.screenDef && hh.screenDef.fps != null) {
        const f2 = typeof hh.screenDef.fps === "function" ? safe("fps", () => hh.screenDef.fps(ctx)) : hh.screenDef.fps;
        fps = Math.max(fps || 0, f2 || 0);
      }
      if (hh.g.wiping) fps = Math.max(fps || 30, 30);
      const frameMs = 1000 / clamp(fps || 30, 1, 60);
      hh.nextFrame += Math.max(frameMs, spi);
      if (hh.nextFrame < now) hh.nextFrame = now + frameMs;
    }
  }

  function renderFrame(hh) {
    const g = hh.g, ctx = hh.ctx;
    const now = hh.now();
    g.begin();
    hh.texts = [];
    hh.tmap.clear();
    let ok = false;
    if (hh.screenDef && hh.screenDef.draw) {
      try { hh.screenDef.draw(ctx, g); ok = true; } catch (e) { recordError(hh.screenId + ".draw", e); }
    }
    g.unclip();
    if (!ok) drawErrorScreen(hh, hh.screenId || "?");
    // fx layer: pops and dissolves (under overlays)
    hh.fx.pops = hh.fx.pops.filter(pp => now - pp.at < 400);
    for (const pp of hh.fx.pops) {
      const k = (now - pp.at) / 400;
      g.text(pp.x, pp.y - Math.round(8 * k), pp.text, {scale: 2, align: "c", c: pp.color});
    }
    hh.fx.dissolves = hh.fx.dissolves.filter(d => now - d.at < 240);
    for (const d of hh.fx.dissolves) {
      const ph = Math.floor((now - d.at) / 80);
      if (ph >= 1) g.rect(d.x, d.y, d.w, d.h, "void");
      if (ph === 0 || ph === 1) g.dither(d.x, d.y, d.w, d.h, "void", null);
      if (ph === 1) g.dither(d.x + 1, d.y, d.w - 1, d.h, "void", null);
    }
    const def = hh.screenDef || {};
    // hold-M pause progress
    if (hh.menuArmed && hh.input.btn.MENU.down && pauseGestureOk(hh)) {
      const held = hh.input.held("MENU");
      if (held > 120) {
        const [bx, by, bw, bh] = def.holdBarAt || [86, 147, 38, 12];
        g.rect(bx, by, bw, bh, "panel");
        g.sprite("icon.M", bx, by + Math.floor((bh - 8) / 2));
        const fx = bx + 10, fw = bw - 12;
        g.frame(fx, by + Math.floor(bh / 2) - 2, fw, 5, "line");
        g.rect(fx + 1, by + Math.floor(bh / 2) - 1, Math.round((fw - 2) * Math.min(1, held / C.LONG_MS)), 3, "accent");
      }
    }
    // quiet screens: blink an icon instead of an overlay
    const quiet = hh.local.stack.length > 0 || busy(hh);
    if (quiet && blinkOn(ctx, 2)) {
      const [ax, ay] = def.antennaAt || [116, 3];
      const nosig = hh.link.gotState && now - hh.lastStateMs > C.CENTRAL_TIMEOUT_MS;
      if (nosig) { g.rect(ax, ay, 8, 8, "panel"); g.sprite("icon.antenna", ax, ay); }
      else if (paused(hh)) { g.rect(ax, ay, 8, 8, "panel"); g.sprite("icon.pause", ax, ay); }
    }
    // toast (only without an overlay)
    if (hh.toastRec && now >= hh.toastRec.until) hh.toastRec = null;
    if (hh.toastRec && !hh.ov) {
      const ty = def.toastY != null ? def.toastY : 14;
      const [tx, tw] = def.toastX || [0, W];
      g.rect(tx, ty, tw, 13, "panel");
      g.hline(tx, ty + 13, tw, "accent");
      g.sprite("icon.R", tx + 4, ty + 3, {color: "accent"});
      g.text(tx + 16, ty, ctx.t(hh.toastRec.key, hh.toastRec.vars), {w: tw - 20, key: hh.toastRec.key});
    }
    if (hh.ov) {
      try { hh.ov.def.draw(hh.ov.ctx, g); } catch (e) { recordError(hh.ov.id + ".draw", e); drawErrorScreen(hh, hh.ov.id); }
      g.unclip();
    }
    if (hh.fx.border && now < hh.fx.border.until) g.frame(0, 0, W, H, hh.fx.border.color, 3);
    else hh.fx.border = null;
    const pushed = g.present(now);
    hh.lastTexts = hh.texts;
    hh.lastPushed = pushed;
    blit(hh, pushed);
    if (R.listeners.frame) emit("frame", {p: hh.p, rects: pushed, stats: g.stats()});
    return g.stats().spiMs;
  }
  function drawErrorScreen(hh, id) {
    const g = hh.g;
    g.unclip();
    g.clear("void");
    g.rect(0, 0, W, 14, "danger");
    g.text(4, 0, hh.ctx.t("dev.core.err", {id: ""}).trim(), {c: "white"});
    g.textBox(4, 20, 120, 60, String(id), {font: "s", c: "danger"});
    const last = errors[errors.length - 1];
    if (last) g.textBox(4, 60, 120, 84, last.message.replace(/[^\x20-\x7e]/g, "?").slice(0, 120), {font: "s", c: "muted"});
  }

  // Front buffer -> the visible canvas (only what present() pushed)
  function blit(hh, pushed) {
    const d = hh.dom;
    if (!d || !d.canvas) return;
    if (!d.img) {
      d.off = document.createElement("canvas");
      d.off.width = W; d.off.height = H;
      d.offCtx = d.off.getContext("2d");
      d.img = d.offCtx.createImageData(W, H);
      d.u32 = new Uint32Array(d.img.data.buffer);
      d.vis = d.canvas.getContext("2d");
    }
    const front = hh.g._front;
    if (d.full) { pushed = [[0, 0, W, H]]; d.full = false; }
    if (pushed && pushed.length) {
      for (const [x, y, w, h] of pushed) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) d.u32[yy * W + xx] = RGB[front[yy * W + xx]] || 0xff000000;
      d.offCtx.putImageData(d.img, 0, 0);
      d.vis.imageSmoothingEnabled = false;
      d.vis.drawImage(d.off, 0, 0, d.canvas.width, d.canvas.height);
    }
    const inv = hh.now() < hh.invertUntil;
    if (inv !== d.inverted) { d.canvas.style.filter = inv ? "invert(1)" : ""; d.inverted = inv; }
    const sk = hh.now() - hh.shakeAt;
    const off = sk < 120 ? [0, 3, -2, 1, 0][Math.floor(sk / 24)] : 0;
    if (off !== d.shake) { d.canvas.style.transform = off ? "translateY(" + off * (d.cssScale || 2) + "px)" : ""; d.shake = off; }
  }

  /* ================= 10. sound (WebAudio BEEP + DF) ================= */

  let audio = null;
  function audioCtx() {
    if (audio || !world || world.test) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !world.userGesture) return null;
    try { audio = new AC(); } catch { audio = null; }
    return audio;
  }
  // The §2.6 table is the source of truth for names and DF file numbers, and
  // its names do not share one prefix per mode (lap, finish, send_out, team_down),
  // so prefix is only a group label; real conflicts are linted instead.
  DEVICE.registerSfx = function (prefix, defs) {
    for (const [id, def] of Object.entries(defs)) {
      if (R.sfx[id]) { lint("sfxDup", id, {group: prefix, was: R.sfx[id].group}); continue; }
      if (def.ch === "DF") {
        const other = Object.entries(R.sfx).find(([, d]) => d.ch === "DF" && d.file === def.file);
        if (other) lint("sfxFile", id, {file: def.file, usedBy: other[0]});
      } else if (def.ch !== "BEEP") lint("sfx", id, "ch must be BEEP or DF");
      R.sfx[id] = Object.assign({group: prefix || ""}, def);
    }
  };
  const VOL = [0, 0.27, 0.5, 0.73, 1];
  function voice(hh) {
    const ac = audioCtx();
    if (!ac) return null;
    if (!hh.voice) {
      const out = ac.createGain(); out.gain.value = 0.08;
      let node = out;
      if (ac.createStereoPanner) { const pan = ac.createStereoPanner(); pan.pan.value = hh.p ? 0.5 : -0.5; out.connect(pan); node = pan; }
      node.connect(ac.destination);
      hh.voice = {out, beepUntil: 0, tone: 0, toneOsc: null, df: {prio: 0, until: 0}};
    }
    hh.voice.out.gain.value = 0.08 * VOL[clamp(hh.settings.volume | 0, 0, 4)];
    return hh.voice;
  }
  function beep(ac, out, tones, t0) {
    let t = t0;
    for (const [hz, ms] of tones) {
      const o = ac.createOscillator();
      o.type = "square"; o.frequency.value = hz;
      o.connect(out); o.start(t); o.stop(t + ms / 1000);
      t += ms / 1000;
    }
    return t;
  }
  function playSfx(hh, id) {
    const def = R.sfx[id];
    hh.sfxLog.push({id, t: hh.now()});
    if (hh.sfxLog.length > 300) hh.sfxLog.shift();
    if (!def) { lint("sfx", id, "unknown sound"); return; }
    if (def.ch === "DF" && !hh.hw.caps.snd) return;
    if (def.ch !== "DF" && def.ui && !hh.settings.clicks) return;
    const v = voice(hh);
    if (!v || !hh.settings.volume) return;
    const ac = audio, now = ac.currentTime;
    if (def.ch === "DF") {
      const t = hh.now();
      if (def.prio < v.df.prio && t < v.df.until) return;
      v.df = {prio: def.prio || 1, until: t + (def.ms || 400)};
      // stand-in for the mp3: a short triangle jingle derived from the file number
      const n = def.file || 1, ms = Math.min(def.ms || 400, 1200);
      const steps = 3 + (n % 3), base = 330 + (n * 37) % 300;
      for (let i = 0; i < steps; i++) {
        const o = ac.createOscillator();
        o.type = "triangle"; o.frequency.value = base * Math.pow(2, ((n * (i + 1) * 5) % 12) / 12);
        o.connect(v.out);
        const st = now + 0.06 + i * ms / steps / 1000;
        o.start(st); o.stop(st + ms / steps / 1000 * 0.9);
      }
      return;
    }
    const end = beep(ac, v.out, def.tones || [[1000, 12]], now);
    v.beepUntil = end;
    if (v.toneOsc) { v.toneOsc.frequency.setValueAtTime(0, now); v.toneOsc.frequency.setValueAtTime(v.tone, end); }
  }
  function setTone(hh, hz) {
    hz = hz | 0;
    if (!hz && !hh.voice) return;
    const v = voice(hh);
    if (!v) return;
    v.tone = hz;
    const on = hz > 0 && hh.settings.clicks && hh.settings.volume > 0;
    if (on && !v.toneOsc) {
      v.toneOsc = audio.createOscillator(); v.toneOsc.type = "square";
      // the engine is background: a quarter of the sfx level (firmware: a quarter
      // of the PWM duty, AUDIO_TONE_DUTY_DIV), so it hums under the short sounds
      if (!v.toneOut) { v.toneOut = audio.createGain(); v.toneOut.gain.value = 0.25; v.toneOut.connect(v.out); }
      v.toneOsc.connect(v.toneOut); v.toneOsc.start();
    }
    if (v.toneOsc) {
      if (!on) { v.toneOsc.stop(); v.toneOsc = null; }
      else v.toneOsc.frequency.setValueAtTime(audio.currentTime < v.beepUntil ? 0 : hz, audio.currentTime);
    }
  }
  DEVICE.registerSfx("", {
    ui_move: {ch: "BEEP", tones: [[1000, 12]], ui: true},
    ui_ok: {ch: "BEEP", tones: [[880, 30], [1320, 40]], ui: true},
    ui_back: {ch: "BEEP", tones: [[660, 30], [440, 40]], ui: true},
    ui_deny: {ch: "BEEP", tones: [[200, 120]], ui: true},
    key_type: {ch: "BEEP", tones: [[1500, 8]], ui: true},
    tick_in_band: {ch: "BEEP", tones: [[2000, 6]]},
    stage_up: {ch: "BEEP", tones: [[1047, 40], [1319, 40], [1568, 40]]},
    sweep_start: {ch: "BEEP", tones: [[1200, 20]]},
    block_perfect: {ch: "BEEP", tones: [[2400, 30], [3200, 40]]},
    block_good: {ch: "BEEP", tones: [[1600, 40]]},
    block_miss: {ch: "BEEP", tones: [[180, 80]]},
    count_tick: {ch: "BEEP", tones: [[880, 80]]},
    count_go: {ch: "BEEP", tones: [[1760, 250]]},
    link_lost: {ch: "BEEP", tones: [[880, 60], [440, 60], [880, 60], [440, 60]]},
    boot: {ch: "DF", file: 1, prio: 1, ms: 1200},
    rival_join: {ch: "DF", file: 2, prio: 1, ms: 500},
    mode_agree: {ch: "DF", file: 3, prio: 1, ms: 600},
    ready_go: {ch: "DF", file: 4, prio: 1, ms: 400},
    link_back: {ch: "DF", file: 5, prio: 1, ms: 400},
    error: {ch: "DF", file: 6, prio: 1, ms: 500},
    victory: {ch: "DF", file: 25, prio: 3, ms: 2500},
    defeat: {ch: "DF", file: 26, prio: 3, ms: 2000},
    menu_bgm: {ch: "DF", file: 90, prio: 1, ms: 1000},
  });

  /* ================= 11. DEVICE.trial and DEVICE.padLevel ================= */

  // Port of trial.c with R (ready), S (stage), speeds and band width as
  // parameters (§7.8 plan). cfg = {readyMs, stageMs, stages, bandPct, speeds}
  const TRIAL = DEVICE.trial = {
    defaults: () => ({readyMs: C.TRIAL_READY_MS, stageMs: C.TRIAL_STAGE_MS, stages: C.TRIAL_STAGES, bandPct: C.TRIAL_BAND_PCT, speeds: C.TRIAL_SPEEDS.slice()}),
    // cfg from battle params (DEVICE.battleParams() shape)                 [+]
    cfgFrom: P => ({readyMs: P.readyMs, stageMs: P.stageMs, stages: 3, bandPct: P.bandPct, speeds: [P.speed1, P.speed2, P.speed3]}),
    endMs: cfg => cfg.readyMs + cfg.stages * cfg.stageMs,
    stageAt(t, cfg) {
      if (t < cfg.readyMs) return 0;
      return Math.min(Math.floor((t - cfg.readyMs) / cfg.stageMs), cfg.stages - 1);
    },
    tau100(t, cfg) {
      const Rm = cfg.readyMs, S = cfg.stageMs, s = cfg.speeds, n = cfg.stages;
      if (t < Rm) return t * s[0];
      const u = Math.min(t - Rm, n * S);
      const k = Math.min(Math.floor(u / S), n - 1);
      let v = Rm * s[0];
      for (let j = 0; j < k; j++) v += S * s[j];
      return v + (u - k * S) * s[k];
    },
    bandCenter(seed, t, cfg) {
      const twoPi = 2 * Math.PI;
      const half = cfg.bandPct / 2;
      const tau = TRIAL.tau100(t, cfg) / 100;
      const p1 = seed * twoPi / 256;
      const p2 = (seed * 7 % 256) * twoPi / 256;
      let c = 50 + 22 * Math.sin(twoPi * tau / 1300 + p1) + 12 * Math.sin(twoPi * tau / 700 + p2);
      if (c < half) c = half;
      if (c > 100 - half) c = 100 - half;
      return Math.floor(c + 0.5);
    },
    inBand: (level, center, cfg) => 2 * Math.abs(level - center) <= cfg.bandPct,
    create(seed, cfg, now) {
      return {seed: seed & 0xff, cfg, start: now, elapsed: 0, phase: 0, level: 0,
        center: TRIAL.bandCenter(seed & 0xff, 0, cfg), inside: false,
        scored: new Array(cfg.stages).fill(0), insideMs: new Array(cfg.stages).fill(0)};
    },
    // -> true on the one call that finishes the trial
    update(T, level, now) {
      if (T.phase === 2) return false;
      const cfg = T.cfg, end = TRIAL.endMs(cfg);
      let e = Math.min(now - T.start, end);
      if (e < T.elapsed) e = T.elapsed;
      const prev = T.elapsed;
      T.elapsed = e;
      T.level = clamp(Math.round(level), 0, 100);
      T.center = TRIAL.bandCenter(T.seed, e, cfg);
      T.inside = TRIAL.inBand(T.level, T.center, cfg);
      for (let k = 0; k < cfg.stages; k++) {
        const lo = cfg.readyMs + k * cfg.stageMs, hi = lo + cfg.stageMs;
        const from = Math.max(prev, lo), to = Math.min(e, hi);
        if (to > from) { T.scored[k] += to - from; if (T.inside) T.insideMs[k] += to - from; }
      }
      if (e >= end) { T.phase = 2; return true; }
      T.phase = e >= cfg.readyMs ? 1 : 0;
      return false;
    },
    pct: (inside, scored) => scored ? Math.floor((inside * 200 + scored) / (scored * 2)) : 0,
    score: T => TRIAL.pct(T.insideMs.reduce((a, b) => a + b, 0), T.scored.reduce((a, b) => a + b, 0)),
    stageScore: (T, k) => k >= 0 && k < T.cfg.stages ? TRIAL.pct(T.insideMs[k], T.scored[k]) : 0,
    stage: T => TRIAL.stageAt(T.elapsed, T.cfg),
    done: T => T.phase === 2,
    ready: T => T.phase === 0,      // [+] still in the ready phase
  };

  // Effective pad level 0..100 (controls.c): pad -> mapped pressure; no pad ->
  // holding A (not the stick click) rises TRIAL_RISE_PER_S, release falls
  DEVICE.padLevel = {
    create: () => ({milli: 0}),
    update(st, input, settings, dt) {
      const on = settings.pad === "on" || (settings.pad !== "off" && input.padPresent);
      if (on) {
        const p = input.pressure;
        st.milli = p <= C.CTL_PRESS_START ? 0 : Math.min(100, Math.floor((p - C.CTL_PRESS_START) * 100 / (C.CTL_PRESS_FULL - C.CTL_PRESS_START))) * 1000;
      } else {
        const bp = DEVICE.battleParams();
        const held = input.aBtn != null ? input.aBtn : input.a && !input.stickClick;
        dt = Math.max(0, dt | 0);
        st.milli = held ? Math.min(100000, st.milli + bp.risePerS * dt) : Math.max(0, st.milli - bp.fallPerS * dt);
      }
      return Math.floor((st.milli + 500) / 1000);
    },
  };

  /* ================= 12. registries for screens / modes, params ================= */

  DEVICE.registerStrings = function (prefix, strings) {
    const zh = strings.zh || {}, en = strings.en || {};
    for (const k of new Set([...Object.keys(zh), ...Object.keys(en)])) {
      if (!k.startsWith(prefix)) { lint("prefix", "string " + k, {prefix}); continue; }
      R.strings.keys.add(k);
      if (!(k in en)) lint("missingEn", k, null);
    }
    I18N.add({zh, en});
    Object.assign(R.strings.zh, zh);
    Object.assign(R.strings.en, en);
    if (prefix.startsWith("dev.page.") || prefix.startsWith("dev.dbg.")) return;
    for (const [lang, set] of [["zh", zh], ["en", en]]) {
      for (const [k, v] of Object.entries(set)) {
        const bare = String(v).replace(TOKEN_RE, (m, n) => ICON_NAMES.includes(n) ? "" : m).replace(/\{\w+\}/g, "");
        for (const ch of bare) {
          if (!inMCharset(ch)) lint("charset", k, {lang, ch});
          else if (lang === "zh" && !isAscii(ch)) R.strings.cjk.add(ch);
        }
      }
    }
  };
  DEVICE.registerScreen = function (id, def) {
    if (R.screens[id]) { lint("dupScreen", id, null); throw new Error("duplicate screen: " + id); }
    if (!def || typeof def.draw !== "function") throw new Error("screen " + id + " needs draw()");
    R.screens[id] = def;
  };
  DEVICE.registerSession = function (def) { R.session = def; };
  DEVICE.registerMode = function (def) {
    for (const k of ["id", "stateMsg", "central", "player"]) if (def[k] == null) { lint("modeParts", def.id || "?", {missing: k}); throw new Error("mode " + def.id + " needs " + k); }
    if (typeof def.modeId !== "number") throw new Error("mode " + def.id + " needs a numeric modeId");
    if (R.modes.some(m => m.id === def.id || m.modeId === def.modeId)) throw new Error("duplicate mode: " + def.id);
    R.modes.push(def);
    R.modes.sort((a, b) => (a.order || 0) - (b.order || 0));
  };
  DEVICE.registerFixture = function (id, def) { R.fixtures[id] = def; };
  DEVICE.modes = () => R.modes.filter(m => !m.hidden);
  DEVICE.mode = idOrNum => R.modes.find(m => m.id === idOrNum || m.modeId === idOrNum) || null;
  DEVICE.rules = idOrNum => { const m = DEVICE.mode(idOrNum); return m ? m.rules || {} : null; };
  DEVICE.params = function (idOrNum) {
    const m = DEVICE.mode(idOrNum);
    if (!m) return {};
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("pr.device.params." + m.id) || "{}") || {}; } catch { saved = {}; }
    // DEVICE.reset({params: {racing: {laps: 1}}}): this world only, never saved (fixtures)
    const over = world && world.opts.params && (world.opts.params[m.id] || world.opts.params[m.modeId]) || {};
    const ok = (p, v) => typeof v === "number" && (p.min == null || v >= p.min) && (p.max == null || v <= p.max);
    const out = {};
    for (const p of m.params || []) out[p.key] = ok(p, over[p.key]) ? over[p.key] : ok(p, saved[p.key]) ? saved[p.key] : p.def;
    return out;
  };
  DEVICE.setParams = function (idOrNum, patch) {
    const m = DEVICE.mode(idOrNum);
    if (!m) return;
    const cur = Object.assign(DEVICE.params(m.id), patch);
    try { localStorage.setItem("pr.device.params." + m.id, JSON.stringify(cur)); } catch {}
  };
  const BATTLE_DEFAULTS = {base: 10, windowPct: 24, sweepMs: 1100, hp: 60, skillCd: 3, burnDmg: 5, burnTurns: 2, emberDmg: 8,
    tideHeal: 12, drain: 6, perfectPct: 20, goodPct: 50, shieldPct: 50, strongPct: 150, weakPct: 70, trialBonus: 20,
    maxDmg: 30, stageMs: 1500, speed1: 35, speed2: 65, speed3: 100, readyMs: 600, bandPct: 24, risePerS: 140,
    fallPerS: 140, tierStrong: 50, tierUlt: 80, narrowPct: 20, speedupPct: 12, gapMs: 350, resolveMs: 900, graceMs: 1500};
  let battleParamsCache = null, battleParamsAt = -1;
  DEVICE.battleParams = function () {
    const t = world ? world.clock : 0;
    if (battleParamsCache && t - battleParamsAt < 1000 && t >= battleParamsAt) return battleParamsCache;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("pr.params.v4") || "{}") || {}; } catch { saved = {}; }
    const over = (world && world.opts.battleParams) || {};    // DEVICE.reset({battleParams}): fixtures
    const out = {};
    for (const [k, d] of Object.entries(BATTLE_DEFAULTS)) out[k] = typeof over[k] === "number" ? over[k] : typeof saved[k] === "number" ? saved[k] : d;
    battleParamsCache = Object.freeze(out); battleParamsAt = t;
    return battleParamsCache;
  };

  /* ---------------- core strings ---------------- */

  DEVICE.registerStrings("dev.ui.", {
    zh: {"dev.ui.ok": "确定", "dev.ui.back": "返回", "dev.ui.done": "完成", "dev.ui.yes": "确定", "dev.ui.no": "取消",
      "dev.ui.again": "再来", "dev.ui.menu": "菜单", "dev.ui.retry": "重试", "dev.ui.next": "下个",
      "dev.ui.you": "你", "dev.ui.rival": "对方", "dev.ui.partner": "搭档", "dev.ui.inSettings": "设置中", "dev.ui.signingIn": "登录中"},
    en: {"dev.ui.ok": "OK", "dev.ui.back": "Back", "dev.ui.done": "Done", "dev.ui.yes": "Yes", "dev.ui.no": "Cancel",
      "dev.ui.again": "Again", "dev.ui.menu": "Menu", "dev.ui.retry": "Retry", "dev.ui.next": "Next",
      "dev.ui.you": "YOU", "dev.ui.rival": "RIVAL", "dev.ui.partner": "PARTNER", "dev.ui.inSettings": "in settings", "dev.ui.signingIn": "signing in"},
  });
  DEVICE.registerStrings("dev.pet.", {
    zh: {"dev.pet.ember": "焰灵", "dev.pet.tide": "潮影", "dev.pet.sprout": "叶芽", "dev.pet.fire": "火", "dev.pet.water": "水", "dev.pet.grass": "草"},
    en: {"dev.pet.ember": "Ember", "dev.pet.tide": "Tide", "dev.pet.sprout": "Sprout", "dev.pet.fire": "fire", "dev.pet.water": "water", "dev.pet.grass": "grass"},
  });
  DEVICE.registerStrings("dev.core.", {
    zh: {"dev.core.holdPause": "按住{M}暂停", "dev.core.needStick": "需要摇杆", "dev.core.pauseLater": "这一轮结束后暂停",
      "dev.core.todo": "TODO {id}", "dev.core.err": "ERR {id}", "dev.core.echo": "回声测试",
      "dev.core.stubWin": "赢了！", "dev.core.stubLose": "输了", "dev.core.stubDone": "完成！", "dev.core.stubPresses": "按A次数",
      "dev.core.stubPick": "{A}选好", "dev.core.stubPress": "{A}计数 {B}结束", "dev.core.stubWait": "等待对方…",
      "dev.core.stubCount": "你{a} 对方{b}"},
    en: {"dev.core.holdPause": "Hold {M}: pause", "dev.core.needStick": "Needs stick", "dev.core.pauseLater": "Pause after turn",
      "dev.core.todo": "TODO {id}", "dev.core.err": "ERR {id}", "dev.core.echo": "ECHO",
      "dev.core.stubWin": "WON!", "dev.core.stubLose": "LOST", "dev.core.stubDone": "DONE!", "dev.core.stubPresses": "A presses",
      "dev.core.stubPick": "{A} pick", "dev.core.stubPress": "{A} count {B} end", "dev.core.stubWait": "Waiting...",
      "dev.core.stubCount": "you {a} rival {b}"},
  });
  DEVICE.registerStrings("dev.page.", {
    zh: {"dev.page.title": "掌机模拟器", "dev.page.back": "← 返回进展页",
      "dev.page.intro": "两台掌机、一块虚拟中央板，三种模式在一台电脑上就能两个人玩。画面是 128×160 的真实像素，和 TFT 上一样。",
      "dev.page.view": "显示", "dev.page.both": "两台", "dev.page.scale": "缩放", "dev.page.auto": "自动",
      "dev.page.player": "玩家 {n}", "dev.page.keys0": "A=F B=G S=R M=T 捏=V", "dev.page.keys1": "A=K B=L S=I M=O 捏=,",
      "dev.page.pad": "捏", "dev.page.stick": "摇杆", "dev.page.screen": "玩家 {n} 的屏幕",
      "dev.page.paused": "模拟已暂停（按 ` 继续）", "dev.page.swapped": "键位已对调（Tab）",
      "dev.page.help": "两人共用一个键盘。屏幕上的 A / B / S / M 是掌机的按键，不是键盘上的同名键，按下表找：",
      "dev.page.helpTouch": "手机上直接按每台掌机下面的摇杆、按键和压力条。` 暂停或继续模拟；Tab 对调两组键位（一个人也能操作任意一台）。",
      "dev.page.colPlayer": "玩家", "dev.page.colHard": "用力捏", "dev.page.colLight": "轻捏"},
    en: {"dev.page.title": "Device simulator", "dev.page.back": "← Back to progress",
      "dev.page.intro": "Two handhelds and a virtual central board: all three modes, two players on one computer. The screens are the real 128×160 pixels, the same as on the TFT.",
      "dev.page.view": "Show", "dev.page.both": "Both", "dev.page.scale": "Scale", "dev.page.auto": "Auto",
      "dev.page.player": "Player {n}", "dev.page.keys0": "A=F B=G S=R M=T pad=V", "dev.page.keys1": "A=K B=L S=I M=O pad=,",
      "dev.page.pad": "Pad", "dev.page.stick": "Stick", "dev.page.screen": "Player {n} screen",
      "dev.page.paused": "Simulation paused (press ` to resume)", "dev.page.swapped": "Keys swapped (Tab)",
      "dev.page.help": "Two players share one keyboard. A / B / S / M on the screens are the handheld's buttons, not the keyboard keys with those letters:",
      "dev.page.helpTouch": "On a phone, use the stick, buttons and pressure bar under each handheld. ` pauses or resumes the simulation; Tab swaps the two key groups, so one person can drive either handheld.",
      "dev.page.colPlayer": "Player", "dev.page.colHard": "Squeeze", "dev.page.colLight": "Light"},
  });

  /* ================= 12b. stub helpers and the echo mode ================= */

  // Placeholder screen: "TODO <id>" title, optional lines and hints.
  // def may override any screen field; lines(ctx) -> [string | [key, vars]]
  DEVICE.stubScreen = function (id, def = {}) {
    DEVICE.registerScreen(id, Object.assign({
      draw(ctx, g) {
        if (def.overlay) { UI.dim(g); UI.panel(g, 12, 16, 104, 106); }
        else {
          const sig = !def.local && def.signal !== false;
          UI.topBar(g, ctx, null, {title: ctx.t("dev.core.todo", {id}), signal: sig, titleW: sig ? 108 : 120});
        }
        const y0 = def.overlay ? 22 : 20;
        if (def.overlay) g.text(64, y0, ctx.t("dev.core.todo", {id}), {align: "c", c: "gold"});
        const lines = def.lines ? def.lines(ctx) || [] : [];
        lines.forEach((ln, i) => {
          const s = Array.isArray(ln) ? ctx.t(ln[0], ln[1]) : String(ln);
          g.text(def.overlay ? 16 : 4, y0 + (def.overlay ? 18 : 0) + i * 14, s, {w: def.overlay ? 96 : 120, c: i === 0 && !def.overlay ? "gold" : "white"});
        });
        if (def.art) def.art(ctx, g);
        if (def.hints) UI.hintBar(g, ctx, typeof def.hints === "function" ? def.hints(ctx) : def.hints);
      },
    }, def));
  };

  // Placeholder mode (step 0 stubs + echo): PICK (A) -> PLAY (A counts, B
  // ends) -> OVER -> results. o = {id, modeId, order, titleKey, subKey,
  // subVars, icon, coop, status, needsStick, hidden, stateMsg, typeId,
  // prefix ("race."), hud ("hud" | "room"), pick: true, lobby, params}
  const SP = {PICK: 0, PLAY: 1, OVER: 2};
  DEVICE.stubMode = function (o) {
    DEVICE.registerMessage(o.stateMsg, o.typeId, ["step:u16", "phase:u8", "flags:u8", "match:u8", "picked:u8", "count:u8[2]", "winner:u8", "quitBy:u8"], {kind: "mode", stub: true});
    const A = C.ACT;
    return {
      id: o.id, modeId: o.modeId, order: o.order || 0, titleKey: o.titleKey, subKey: o.subKey, subVars: o.subVars || (() => ({})),
      icon: o.icon, coop: !!o.coop, status: o.status || "prototype", needsStick: !!o.needsStick, hidden: !!o.hidden,
      stateMsg: o.stateMsg, params: o.params || [], rules: {}, lobby: o.lobby || {goals: [], keys: []},
      central: {
        periodMs: 100,
        create(api) {
          const s = {phase: o.pick === false ? SP.PLAY : SP.PICK, picked: 0, count: [0, 0], winner: 0xff, quitBy: 0xff};
          return {
            tick() {},
            action(p, a) {
              if (a === A.STUB_PICK && s.phase === SP.PICK) {
                s.picked |= 1 << p;
                if (s.picked === 3) { s.phase = SP.PLAY; api.nextStep(); }
                return true;
              }
              if (a === A.STUB_PRESS && s.phase === SP.PLAY) { s.count[p] = Math.min(255, s.count[p] + 1); return true; }
              if (a === A.STUB_END && s.phase === SP.PLAY) { s.phase = SP.OVER; s.winner = o.coop ? 0xff : p; api.nextStep(); return true; }
              return false;
            },
            quit(p) { s.phase = SP.OVER; s.quitBy = p; s.winner = o.coop ? 0xff : 1 - p; api.nextStep(); },
            snapshot: () => ({phase: s.phase, flags: 0, picked: s.picked, count: s.count.slice(), winner: s.winner, quitBy: s.quitBy}),
            over: () => s.phase === SP.OVER ? {winner: s.winner === 0xff ? null : s.winner, coop: !!o.coop, quit: s.quitBy === 0xff ? null : s.quitBy, res: [s.count[0], s.count[1], 0, 0]} : null,
            canPause: () => "now",
          };
        },
      },
      player: {
        create: () => ({}),
        destroy() {},
        route(ctx) {
          const st = ctx.state, hud = o.prefix + (o.hud || "hud");
          if (!st) return hud;
          return st.phase === SP.PICK ? o.prefix + "pick" : st.phase === SP.OVER ? "results" : hud;
        },
        busy: () => false,
        inputBits: () => 0,
        heartbeat: true,
        pauseItems: [],
        results(ctx) {
          const st = ctx.state || {count: [0, 0], winner: 0xff};
          const win = st.winner === ctx.p;
          return {
            titleKey: o.coop ? "dev.core.stubDone" : win ? "dev.core.stubWin" : "dev.core.stubLose",
            titleColor: o.coop || win ? "gold" : "muted",
            scoreText: "",
            drawArt(g, c2, x, y) { DEVICE.PETS.forEach((pt, i) => g.sprite(pt.sprite, x + 22 + i * 30, y, {scale: 2})); },
            rows: [{labelKey: "dev.core.stubPresses", you: String(st.count[ctx.p]), other: String(st.count[1 - ctx.p])}],
            again: {labelKey: "dev.ui.again", kind: "rematch"},
          };
        },
      },
      bot(ctx, ctl) {
        const st = ctx.state, m = ctx.m;
        if (!st || !m) return;
        const now = ctx.now();
        if (st.phase === SP.PICK && !(st.picked & (1 << ctx.p)) && (m.botAt == null || now - m.botAt > 700)) { m.botAt = now; ctl.press("A"); }
        if (st.phase === SP.PLAY && (m.botAt == null || now - m.botAt > 400)) {
          m.botAt = now;
          ctl.press(st.count[ctx.p] >= 4 ? "B" : "A");
        }
      },
    };
  };
  // Stub pick / hud screens for a stub mode (prefix "race." -> race.pick, race.hud)
  DEVICE.stubModeScreens = function (prefix, titleKey, hud = "hud") {
    DEVICE.stubScreen(prefix + "pick", {
      secret: true,
      lines: ctx => {
        const st = ctx.state;
        const mine = st && (st.picked & (1 << ctx.p));
        return [[titleKey], mine ? ["dev.core.stubWait"] : ["dev.core.stubPick"]];
      },
      art(ctx, g) { DEVICE.PETS.forEach((pt, i) => g.sprite(pt.sprite, 9 + i * 40, 60, {scale: 3})); },
      hints: [["A", "dev.ui.ok"]],
      input(ctx, ev) {
        if (ev.btn === "A" && ev.type === "down") { ctx.rt(C.ACT.STUB_PICK); ctx.sfx("ui_ok"); }
      },
    });
    DEVICE.stubScreen(prefix + hud, {
      lines: ctx => {
        const st = ctx.state || {count: [0, 0]};
        return [[titleKey], ["dev.core.stubPress"], ["dev.core.stubCount", {a: st.count[ctx.p], b: st.count[1 - ctx.p]}]];
      },
      hints: [["A", "dev.ui.ok"], ["B", "dev.ui.done"]],
      input(ctx, ev) {
        if (ev.type !== "down") return;
        if (ev.btn === "A") { ctx.rt(C.ACT.STUB_PRESS); ctx.sfx("ui_move"); }
        if (ev.btn === "B") { ctx.rt(C.ACT.STUB_END); ctx.sfx("ui_ok"); }
        if (ev.btn === "SKILL") ctx.fx.border("gold");
      },
    });
  };
  // echo test mode (§8.1): every A press counts on the central board and comes back
  DEVICE.registerMode(DEVICE.stubMode({id: "echo", modeId: 7, order: 99, hidden: true, titleKey: "dev.core.echo",
    stateMsg: "echo.state", typeId: C.MSG.ECHO_STATE, prefix: "echo.", pick: false}));
  DEVICE.stubModeScreens("echo.", "dev.core.echo");

  /* ================= 12c. world, main loop ================= */

  const params = new URLSearchParams(location.search);
  const OPTS = DEVICE.opts = {
    seed: params.has("seed") ? (parseInt(params.get("seed"), 10) >>> 0) : null,
    test: params.get("test") === "1",
    view: ["p1", "p2", "both"].includes(params.get("view")) ? params.get("view") : "both",
    viewGiven: ["p1", "p2", "both"].includes(params.get("view")),
    gallery: params.has("gallery"),
    fixture: params.get("fixture"),
    pad: ["auto", "on", "off"].includes(params.get("pad")) ? params.get("pad") : null,
    mode: params.get("mode"),
    speed: clamp(parseFloat(params.get("speed")) || 1, 0.25, 2),
    scale: [2, 3, 4].includes(+params.get("scale")) ? +params.get("scale") : 0,
  };

  function buildWorld(opts) {
    const seed = opts.seed != null ? opts.seed >>> 0 : (Date.now() & 0x7fffffff);
    const streams = {};
    for (const n of ["central", "radio", "bot.0", "bot.1", "fx.0", "fx.1", "input.0", "input.1", "world"]) streams[n] = makeStream(seed, n);
    const prev = world;
    if (prev) for (const h of prev.hh || []) setTone(h, 0);     // the old world's engine must not keep humming
    const w = {
      seed, opts, streams, clock: 0, test: OPTS.test, speed: prev ? prev.speed : OPTS.speed,
      running: prev ? prev.running : true, spiMhz: prev ? prev.spiMhz : C.SPI_MHZ, fsrInverted: false,
      autoMode: opts.mode && DEVICE.mode(opts.mode) ? DEVICE.mode(opts.mode).id : null,
      flashMem: OPTS.test ? (prev && prev.flashMem ? prev.flashMem : {}) : null,
      userGesture: prev ? prev.userGesture : false, langDraft: null, inTick: false,
    };
    world = w;
    battleParamsCache = null;          // a new world may pin other battle params
    w.radio = makeRadio(w);
    if (opts.loss != null) w.radio.loss = clamp(+opts.loss, 0, 1);
    if (opts.latency) w.radio.latency = opts.latency.slice(0, 2);
    if (opts.collisions != null) w.radio.collisions = !!opts.collisions;
    w.central = makeCentral(w);
    w.radio.nodes[0].rx = (bytes, src) => w.central.receive(bytes, src);
    const doms = DEVICE._dom ? DEVICE._dom.handhelds : [null, null];
    w.hh = [0, 1].map(p => makeHandheld(w, p, doms[p] || null));
    for (const hh of w.hh) {
      hh.ctl = makeCtl(hh, "bot", w.streams["bot." + hh.p]);
      // who is a bot survives a reset from the page (not in ?test=1, where scripts decide)
      hh.bot = !OPTS.test && prev && prev.hh ? prev.hh[hh.p].bot : !!(opts.bots && opts.bots[hh.p]);
      if (doms[hh.p]) { doms[hh.p].img = null; doms[hh.p].inverted = false; }
    }
    if (w.autoMode) {
      for (const hh of w.hh) {
        hh.local.booted = true;
        if (hh.local.loggedIn) continue;
        const other = currentProfile(w.hh[1 - hh.p]);
        hh.ctx.profiles.select("guest", DEVICE.guestProfile(w.streams.world, other ? other.color : -1));
      }
    }
    return w;
  }

  function tickWorld() {
    const w = world;
    const t0 = w.clock;
    w.clock += C.TICK_MS;
    w.inTick = true;
    w.radio.deliverDue(w.clock);
    if (w.central.powered) w.central.tick(w.clock);
    for (const hh of w.hh) handheldTick(hh, t0, w.clock);
    w.inTick = false;
  }
  let lastReal = null, budget = 0;
  function loop(realNow) {
    if (lastReal === null) lastReal = realNow;
    const dt = Math.min(100, realNow - lastReal);
    lastReal = realNow;
    if (world && world.running && !OPTS.test) {
      budget += dt * world.speed;
      let n = Math.floor(budget / C.TICK_MS);
      budget -= n * C.TICK_MS;
      while (n-- > 0) tickWorld();
    }
    if (world) { world.realAt = realNow; world.simAt = world.clock; }
    if (!OPTS.test) requestAnimationFrame(loop);
  }
  // Event time -> sim time (§8.2): keeps the exact moment within the next tick
  function simTimeOf(e) {
    if (!world || OPTS.test || !world.running || world.realAt == null) return world ? world.clock : 0;
    const t = world.simAt + (e.timeStamp - world.realAt) * world.speed;
    return Math.max(world.clock, Math.min(t, world.clock + 100));
  }

  // ctl for bots and the test hook: press / hold / stick / pressure on one source
  const BTN_FIELD = {A: "a", B: "b", SKILL: "skill", MENU: "menu", STICK: "stick", UP: "up", DOWN: "down", LEFT: "left", RIGHT: "right", PAD: "padHard", PAD_LIGHT: "padLight"};
  // A bot's presses wait until the 150 ms input lock after a screen / overlay
  // change has passed (otherwise its first press on a new screen is silently
  // dropped); changes are applied in the order they were made.
  function makeCtl(hh, srcName, rng) {
    const field = btn => { const f = BTN_FIELD[btn]; if (!f) throw new Error("unknown button: " + btn); return f; };
    let lastT = 0;
    const at = () => {
      let t = hh.world.clock;
      if (srcName === "bot") t = Math.max(t, hh.lockUntil - hh.offset);
      return (lastT = Math.max(t, lastT));
    };
    return {
      press(btn, ms = 50) {
        const f = field(btn), t = at();
        hh.input.set(srcName, f, true, t);
        hh.input.set(srcName, f, false, t + Math.max(C.TICK_MS, ms));
      },
      hold(btn, down) { hh.input.set(srcName, field(btn), !!down, at()); },
      stick(x, y) { const t = at(); hh.input.set(srcName, "x", clamp(Math.round(x), -100, 100), t); hh.input.set(srcName, "y", clamp(Math.round(y), -100, 100), t); },
      pressure(v) { hh.input.set(srcName, "force", clamp(+v || 0, 0, 255)); },
      rng: rng ? {int: rng.int, float: rng.float} : null,     // [+] bot.<p> stream (bots only)
    };
  }

  /* ================= 12d. DOM: page, handhelds, keyboard, touch ================= */

  const t = (k, v) => I18N.t(k, v);
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const kid of kids) if (kid != null) e.append(kid);
    return e;
  }

  function buildDom() {
    const root = document.getElementById("device-root");
    if (!root) return null;
    root.textContent = "";
    const intro = el("p", {class: "dv-intro", text: t("dev.page.intro")});
    const viewSeg = el("div", {class: "dv-seg", role: "group", "aria-label": t("dev.page.view")});
    for (const [v, label] of [["p1", "P1"], ["p2", "P2"], ["both", t("dev.page.both")]]) {
      viewSeg.append(el("button", {type: "button", "data-view": v, "aria-pressed": String(OPTS.view === v), text: label,
        onclick: () => setView(v)}));
    }
    const scaleSel = el("select", {class: "dv-select", "aria-label": t("dev.page.scale")});
    for (const [v, label] of [[0, t("dev.page.auto")], [2, "×2"], [3, "×3"], [4, "×4"]]) {
      const o = el("option", {value: String(v), text: label});
      if (v === OPTS.scale) o.selected = true;
      scaleSel.append(o);
    }
    scaleSel.addEventListener("change", () => { OPTS.scale = +scaleSel.value; layout(); });
    const pausedBadge = el("span", {class: "dv-paused", hidden: "", text: t("dev.page.paused")});
    const swapBadge = el("span", {class: "dv-paused", hidden: "", text: t("dev.page.swapped")});
    const toolbar = el("div", {class: "dv-toolbar"},
      el("span", {class: "dv-label", text: t("dev.page.view")}), viewSeg,
      el("span", {class: "dv-label", text: t("dev.page.scale")}), scaleSel, pausedBadge, swapBadge);
    const row = el("div", {class: "dv-row"});
    const handhelds = [0, 1].map(p => buildShell(p));
    handhelds.forEach(h => row.append(h.shell));
    const kb = txt => el("kbd", {text: txt});
    const head = ["dev.page.colPlayer", "dev.page.stick", null, null, null, null, "dev.page.colHard", "dev.page.colLight"];
    const btnHead = ["A", "B", "S", "M"];
    const table = el("table", {class: "dv-keytable"},
      el("thead", null, el("tr", null, ...head.map((k, i) => el("th", {scope: "col", text: k ? t(k) : btnHead[i - 2]})))),
      el("tbody", null, ...[0, 1].map(p => {
        const L = KEY_LABEL[p];
        return el("tr", null, el("th", {scope: "row", text: "P" + (p + 1)}),
          ...[L.stick, L.a, L.b, L.skill, L.menu, L.pad, L.light].map(k => el("td", null, kb(k))));
      })));
    const help = el("div", {class: "dv-help"},
      el("p", {text: t("dev.page.help")}), el("div", {class: "dv-keywrap"}, table), el("p", {text: t("dev.page.helpTouch")}));
    const debug = el("section", {class: "dv-debug", id: "device-debug"});
    root.append(intro, toolbar, row, help, debug);
    const dom = {root, toolbar, row, debug, handhelds, pausedBadge, swapBadge, viewSeg, scaleSel};
    DEVICE._dom = dom;
    return dom;
  }

  function buildShell(p) {
    const n = p + 1;
    const keysLine = el("div", {class: "dv-keys", text: t("dev.page.keys" + p)});
    const canvas = el("canvas", {class: "dv-canvas", width: "256", height: "320", role: "img", "aria-label": t("dev.page.screen", {n})});
    const screen = el("div", {class: "dv-screen"}, canvas);
    const knob = el("div", {class: "dv-knob"});
    const stick = el("div", {class: "dv-stick", "aria-label": t("dev.page.stick")}, knob,
      el("kbd", {text: KEY_LABEL[p].stick}));
    const btn = (name, field, kbdKey, cls) => el("button", {type: "button", class: "dv-btn " + cls, "data-field": field},
      el("span", {text: name}), el("kbd", {text: kbdKey}));
    const bA = btn("A", "a", KEY_LABEL[p].a, "dv-a"), bB = btn("B", "b", KEY_LABEL[p].b, "dv-b");
    const bS = btn("S", "skill", KEY_LABEL[p].skill, "dv-s"), bM = btn("≡", "menu", KEY_LABEL[p].menu, "dv-m");
    const btns = el("div", {class: "dv-btns"}, bS, bM, bB, bA);
    const fill = el("i");
    const pad = el("div", {class: "dv-pad", role: "slider", "aria-label": t("dev.page.pad"), "aria-valuemin": "0", "aria-valuemax": "255", "aria-valuenow": "0"},
      fill, el("span", {text: t("dev.page.pad")}), el("kbd", {text: KEY_LABEL[p].pad}));
    const controls = el("div", {class: "dv-controls"}, stick, btns, pad);
    const shell = el("section", {class: "dv-hh", "data-p": String(p)},
      el("div", {class: "dv-hh-head"}, el("b", {text: t("dev.page.player", {n})}), keysLine),
      screen, controls);
    const h = {p, shell, canvas, screen, controls, knob, stick, pad, padFill: fill, buttons: {a: bA, b: bB, skill: bS, menu: bM}};
    wireTouch(h);
    return h;
  }

  function setView(v) {
    OPTS.view = v;
    const d = DEVICE._dom;
    if (!d) return;
    d.viewSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
    d.row.dataset.view = v;
    d.handhelds.forEach(h => { h.shell.hidden = !(v === "both" || v === "p" + (h.p + 1)); });
    layout();
  }

  function layout() {
    const d = DEVICE._dom;
    if (!d) return;
    const dpr = window.devicePixelRatio || 1;
    for (const h of d.handhelds) {
      if (h.shell.hidden) continue;
      const avail = Math.max(128, h.shell.clientWidth - 28 - 20);   // shell padding, bezel
      const tall = Math.max(320, window.innerHeight - 250);
      let css = OPTS.scale || clamp(Math.floor(Math.min(avail / 128, tall / 160)), 2, 4);
      while (css > 1 && 128 * css > avail) css--;
      const k = Math.max(1, Math.floor(css * dpr));
      if (h.canvas.width !== 128 * k) { h.canvas.width = 128 * k; h.canvas.height = 160 * k; h.img = null; }
      h.canvas.style.width = (128 * k / dpr) + "px";
      h.canvas.style.height = (160 * k / dpr) + "px";
      h.cssScale = k / dpr;
      h.full = true;
      if (world && world.hh[h.p]) blit(world.hh[h.p], null);
    }
  }

  function wireTouch(h) {
    const p = h.p;
    const setSrc = (field, value, e) => { if (world) world.hh[p].input.set("touch", field, value, simTimeOf(e)); };
    // virtual stick: drag, analog, dead zone 15
    let stickId = null;
    const stickMove = e => {
      const r = h.stick.getBoundingClientRect();
      const R2 = r.width / 2;
      let x = (e.clientX - r.left - R2) / R2, y = (e.clientY - r.top - R2) / R2;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      h.knob.style.transform = "translate(" + (x * R2 * 0.6) + "px," + (y * R2 * 0.6) + "px)";
      let vx = Math.round(x * 100), vy = Math.round(-y * 100);
      if (Math.hypot(vx, vy) < 15) { vx = 0; vy = 0; }
      setSrc("x", vx, e); setSrc("y", vy, e);
    };
    h.stick.addEventListener("pointerdown", e => { stickId = e.pointerId; h.stick.setPointerCapture(e.pointerId); markGesture(); stickMove(e); e.preventDefault(); });
    h.stick.addEventListener("pointermove", e => { if (e.pointerId === stickId) stickMove(e); });
    const stickEnd = e => {
      if (e.pointerId !== stickId) return;
      stickId = null; h.knob.style.transform = ""; setSrc("x", 0, e); setSrc("y", 0, e);
    };
    h.stick.addEventListener("pointerup", stickEnd);
    h.stick.addEventListener("pointercancel", stickEnd);
    for (const b of Object.values(h.buttons)) {
      const f = b.dataset.field;
      b.addEventListener("pointerdown", e => { b.setPointerCapture(e.pointerId); markGesture(); setSrc(f, true, e); b.classList.add("on"); e.preventDefault(); });
      const up = e => { setSrc(f, false, e); b.classList.remove("on"); };
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("contextmenu", e => e.preventDefault());
    }
    // pressure bar: finger height = target force
    let padId = null;
    const padMove = e => {
      const r = h.pad.getBoundingClientRect();
      const v = Math.round(clamp(1 - (e.clientY - r.top) / r.height, 0, 1) * 255);
      setSrc("target", v, e);
    };
    h.pad.addEventListener("pointerdown", e => { padId = e.pointerId; h.pad.setPointerCapture(e.pointerId); markGesture(); padMove(e); e.preventDefault(); });
    h.pad.addEventListener("pointermove", e => { if (e.pointerId === padId) padMove(e); });
    const padEnd = e => { if (e.pointerId === padId) { padId = null; setSrc("target", 0, e); } };
    h.pad.addEventListener("pointerup", padEnd);
    h.pad.addEventListener("pointercancel", padEnd);
  }
  function markGesture() { if (world) world.userGesture = true; if (audio && audio.state === "suspended") audio.resume(); }

  function typing(e) {
    const tg = e.target;
    return tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName));
  }
  function onKey(e, down) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (down) markGesture();
    if (e.code === "Backquote") {
      if (down && !e.repeat) { world.running = !world.running; if (DEVICE._dom) DEVICE._dom.pausedBadge.hidden = world.running; }
      e.preventDefault();
      return;
    }
    if (e.code === "Tab") {
      const a = document.activeElement;
      if (a && a !== document.body && a.tagName !== "CANVAS") return;   // keep Tab for focus moves
      if (down && !e.repeat) { DEVICE.keySwap(!keySwap); emit("tab", keySwap); }
      e.preventDefault();
      return;
    }
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    const p = keySwap ? 1 - k[0] : k[0], field = k[1];
    world.hh[p].input.set("kbd", field, down, simTimeOf(e));
    lightKey(p, field, down);
  }
  // Tab: the two key groups drive the other handheld (one person can steer
  // either pet in adventure, or either side anywhere). Held keys are let go.
  let keySwap = false;
  DEVICE.keySwap = function (on) {                                    // [+]
    if (on != null && !!on !== keySwap) {
      keySwap = !!on;
      releaseKeyboard();
      const d = DEVICE._dom;
      if (d && d.swapBadge) d.swapBadge.hidden = !keySwap;
    }
    return keySwap;
  };
  function lightKey(p, field, down) {
    const d = DEVICE._dom;
    if (!d) return;
    const h = d.handhelds[p];
    const b = h.buttons[field];
    if (b) b.classList.toggle("on", down);
    if (field === "padHard" || field === "padLight") h.pad.classList.toggle("on", down);
    if (["up", "down", "left", "right"].includes(field)) h.stick.classList.toggle("on", down);
  }
  function releaseKeyboard() {
    if (!world) return;
    for (const hh of world.hh) { hh.input.releaseAll("kbd"); }
    const d = DEVICE._dom;
    if (d) d.handhelds.forEach(h => { Object.values(h.buttons).forEach(b => b.classList.remove("on")); h.pad.classList.remove("on"); h.stick.classList.remove("on"); });
  }
  // pressure bar fill follows the simulated pressure
  function updatePadBars() {
    const d = DEVICE._dom;
    if (!d || !world) return;
    for (const h of d.handhelds) {
      const raw = world.hh[h.p].input.st.pressure;
      const v = raw > C.CTL_PRESS_RELEASE ? raw : 0;     // hide the resting noise
      if (h.lastPad !== v) { h.padFill.style.height = (v / 255 * 100) + "%"; h.pad.setAttribute("aria-valuenow", String(v)); h.lastPad = v; }
    }
    requestAnimationFrame(updatePadBars);
  }

  /* ================= 12e. start, reset, test hook ================= */

  let readyResolve;
  DEVICE.ready = new Promise(r => { readyResolve = r; });
  let restoreDraft = null;

  function checkRegistries() {
    // [+] every non-ASCII character of a registered string must be in the
    // exported m font (device-font.js), or the firmware shows a red box
    if (window.DEVICE_FONT_M) {
      for (const [lang, set] of [["zh", R.strings.zh], ["en", R.strings.en]]) {
        for (const [k, v] of Object.entries(set)) {
          if (k.startsWith("dev.page.") || k.startsWith("dev.dbg.")) continue;
          const bare = String(v).replace(TOKEN_RE, (m, n) => ICON_NAMES.includes(n) ? "" : m).replace(/\{\w+\}/g, "");
          for (const ch of bare) if (!isAscii(ch) && inMCharset(ch) && !(ch in window.DEVICE_FONT_M)) lint("missingGlyph", k, {lang, ch});
        }
      }
    }
    for (const id of ["boot", "login", "connect", "menu", "lobby", "results"]) if (!R.screens[id]) lint("missingScreen", id, "not registered");
    for (const m of R.modes) {
      if (!R.msgs[m.stateMsg]) lint("modeParts", m.id, {missing: "stateMsg " + m.stateMsg});
      else if (R.msgs[m.stateMsg].kind !== "mode") lint("modeFields", m.stateMsg, "not registered with kind mode");
      for (const k of ["route", "results"]) if (!m.player[k]) lint("modeParts", m.id, {missing: "player." + k});
      if (!m.central.create) lint("modeParts", m.id, {missing: "central.create"});
    }
    // §7.6 sizes and kinds (the step-0 stubs register placeholders and are skipped)
    for (const [type, size, kind] of [[C.MSG.BATTLE_STATE, 47, "mode"], [C.MSG.RACE_INPUT, 23, "uplink"], [C.MSG.RACE_STATE, 55, "mode"], [C.MSG.ADV_STATE, 61, "mode"]]) {
      const d = R.msgByType[type];
      if (d && !d.stub && (d.size !== size || d.kind !== kind)) lint("msgSize", d.name, {size: d.size, want: size, kind: d.kind, wantKind: kind});
    }
  }

  DEVICE.start = function () {
    if (DEVICE._started) return;
    DEVICE._started = true;
    // language switch carried over the reload (§8.10)
    const restore = v => { if (v && typeof v === "object") restoreDraft = v; };
    if (typeof I18N.keepDraft === "function") I18N.keepDraft("device", () => world ? world.langDraft : null, restore);
    else { try { restore(JSON.parse(sessionStorage.getItem("pr.device.langDraft") || "null")); sessionStorage.removeItem("pr.device.langDraft"); } catch {} }
    if (OPTS.test) {
      const seeded = mulberry32(OPTS.seed || 1);
      Math.random = function () { if (world && world.inTick) lint("mathRandom", "tick", "Math.random used during a tick"); return seeded(); };
    }
    checkRegistries();
    const dom = buildDom();
    // §8.12: a phone shows one handheld, P1, with the computer playing P2
    const phone = !!dom && !OPTS.test && !OPTS.viewGiven && window.innerWidth < 900;
    if (phone) OPTS.view = "p1";
    const opts = {seed: OPTS.seed, mode: OPTS.mode, pad: OPTS.pad, skipBoot: !!OPTS.mode, bots: phone ? [false, true] : null};
    buildWorld(opts);
    if (restoreDraft) applyDraft(restoreDraft);
    if (dom) {
      setView(OPTS.view);
      window.addEventListener("resize", layout);
      document.addEventListener("keydown", e => onKey(e, true), true);
      document.addEventListener("keyup", e => onKey(e, false), true);
      window.addEventListener("blur", releaseKeyboard);
      for (const fn of R.startHooks) safe("onStart", fn, dom);
      requestAnimationFrame(updatePadBars);
    }
    if (!OPTS.test) requestAnimationFrame(loop);
    readyResolve(DEVICE);
    if (OPTS.fixture) DEVICE.fixture(OPTS.fixture).then(r => console.log("[device] fixture", r));
  };
  function applyDraft(d) {
    for (const hh of world.hh) {
      const login = d.logins && d.logins[hh.p];
      if (login) {
        const {saved, ...cur} = login;
        if (cur.slot !== "guest" && !hh.flash.slots[cur.slot] && saved) hh.flash.slots[cur.slot] = saved;
        if (cur.slot === "guest" || hh.flash.slots[cur.slot]) { hh.flash.cur = cur; hh.local.loggedIn = true; }
      }
      hh.local.booted = true;
      if (hh.p === d.p && (d.screen === "settings" || d.screen === "settings.cal")) hh.local.stack = [{id: "settings", params: null}];
    }
  }

  DEVICE.reset = function (o = {}) {
    const opts = Object.assign({}, o);
    if (opts.mode) opts.skipBoot = opts.skipBoot !== false;
    buildWorld(opts);
    lastReal = null; budget = 0;
    emit("reset", world);
    return DEVICE;
  };
  DEVICE.pause = () => { world.running = false; if (DEVICE._dom) DEVICE._dom.pausedBadge.hidden = false; };
  DEVICE.resume = () => { world.running = true; if (DEVICE._dom) DEVICE._dom.pausedBadge.hidden = true; };
  DEVICE.step = function (ms = C.TICK_MS) {
    const n = Math.max(1, Math.ceil(ms / C.TICK_MS));
    for (let i = 0; i < n; i++) tickWorld();
    return world.clock;
  };
  DEVICE.now = () => world ? world.clock : 0;
  DEVICE.speed = v => { if (v != null) world.speed = clamp(+v, 0.25, 2); return world.speed; };
  DEVICE.seed = () => world ? world.seed : null;
  DEVICE.world = () => world;
  const HH = p => { const h = world.hh[p]; if (!h) throw new Error("no handheld " + p); return h; };
  // [+] a controller on one input source: "script" (DEVICE.press...), "pad" (gamepads, device-debug.js), "touch"
  DEVICE.ctl = (p, src = "script") => {
    if (!["script", "pad", "touch"].includes(src)) throw new Error("ctl source: script | pad | touch");
    const h = HH(p);
    return h.ctls[src] || (h.ctls[src] = makeCtl(h, src));
  };
  const scriptCtl = p => DEVICE.ctl(p, "script");
  DEVICE.press = (p, btn, holdMs = 50) => scriptCtl(p).press(btn, holdMs);
  DEVICE.hold = (p, btn, down) => scriptCtl(p).hold(btn, down);
  DEVICE.stick = (p, x, y) => scriptCtl(p).stick(x, y);
  DEVICE.pressure = (p, v) => scriptCtl(p).pressure(v);
  DEVICE.bot = (p, on) => {                        // on omitted [+]: just tell whether it is a bot
    if (on === undefined) return HH(p).bot;
    HH(p).bot = !!on;
    if (!on) HH(p).input.releaseAll("bot");
    return HH(p).bot;
  };
  DEVICE.screen = p => {
    const h = HH(p);
    return {id: h.screenId, overlay: h.ov ? h.ov.id : null, mode: h.link.inMode && h.stateModeDef ? h.stateModeDef.id : null, params: h.screenParams};
  };
  DEVICE.texts = p => HH(p).lastTexts.map(x => Object.assign({}, x));
  DEVICE.find = (p, sub) => HH(p).lastTexts.some(x => x.s.includes(sub));
  DEVICE.pixels = p => Uint8Array.from(HH(p).g._front);
  DEVICE.hash = p => { const a = HH(p).g._front; let h = 0x811c9dc5; for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, "0"); };
  DEVICE.png = function (p, scale = 4) {
    const a = HH(p).g._front;
    const cv = document.createElement("canvas");
    cv.width = W * scale; cv.height = H * scale;
    const c2 = cv.getContext("2d");
    const img = c2.createImageData(W, H);
    const u = new Uint32Array(img.data.buffer);
    for (let i = 0; i < a.length; i++) u[i] = a[i] < 16 ? RGB[a[i]] : 0xff000000;
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    off.getContext("2d").putImageData(img, 0, 0);
    c2.imageSmoothingEnabled = false;
    c2.drawImage(off, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/png");
  };
  DEVICE.central = () => world.central.view();
  DEVICE.radio = {
    set(o = {}) {
      const r = world.radio;
      if (o.loss != null) r.loss = clamp(+o.loss, 0, 1);
      if (o.latency) r.latency = o.latency.slice(0, 2);
      if (o.collisions != null) r.collisions = !!o.collisions;
    },
    stats: () => world.radio.stats(),
    unplug(p, on) { world.radio.nodes[p + 1].plugged = !on; },
    powerCentral(on) {
      const c = world.central;
      if (!on) { c.powered = false; return; }
      if (c.powered) return;
      world.central = makeCentral(world);
      world.radio.nodes[0].rx = (bytes, src) => world.central.receive(bytes, src);
    },
    channel(p, ch) { world.radio.nodes[p === "central" || p < 0 ? 0 : p + 1].ch = ch | 0; },   // [+] "central" / -1 = the central board
    version(node, v) { world.radio.nodes[node].ver = v | 0; },
    get loss() { return world.radio.loss; },
  };
  DEVICE.reboot = function (p) {
    const old = HH(p);
    const hh = makeHandheld(world, p, old.dom);
    hh.bootNonce = 1 + world.streams.world.int(255);
    if (hh.bootNonce === old.bootNonce) hh.bootNonce = (hh.bootNonce % 255) + 1;
    hh.ctl = makeCtl(hh, "bot", world.streams["bot." + p]);
    hh.bot = old.bot;
    if (hh.dom) hh.dom.img = null;
    setTone(old, 0);
    world.hh[p] = hh;
  };
  // [+] fixtures: the running mode's central.debug(cmd, arg) (e.g. jump to the boss room); broadcasts next tick
  DEVICE.debug = function (cmd, arg) {
    const c = world.central;
    if (!c.mode || !c.mode.inst.debug) return undefined;
    const r = safe("mode " + c.mode.def.id + " debug", () => c.mode.inst.debug(cmd, arg));
    c.wantBroadcast = true;
    return r;
  };
  // [+] debug panel: unplug the joystick / pull the SD card at run time ({joy, pad, snd}); HELLO caps follow
  DEVICE.caps = function (p, patch) {
    const h = HH(p);
    if (patch) Object.assign(h.hw.caps, patch);
    return Object.assign({}, h.hw.caps);
  };
  DEVICE.stats = p => { const s = HH(p).g.stats(); return {fps: s.fps, px: s.px, bytes: s.bytes, rects: s.rects, spiMs: +s.spiMs.toFixed(3), level: s.level, overBudget: HH(p).overBudget}; };
  DEVICE.lint = () => lints.map(l => Object.assign({}, l));
  DEVICE.errors = () => errors.map(e => Object.assign({}, e));
  DEVICE.clearLint = () => { lints.length = 0; lintSeen.clear(); };     // [+]
  DEVICE.glyphs = () => {
    const used = [...glyphUse].sort(), registered = [...R.strings.cjk].sort();
    const notInFont = window.DEVICE_FONT_M ? [...new Set([...used, ...registered])].filter(ch => !(ch in window.DEVICE_FONT_M)).sort() : [];
    return {used, missing: [...glyphMissing].sort(), notInFont, registered, bytes: new Set([...used, ...registered]).size * 18};
  };
  DEVICE.sfxLog = p => HH(p).sfxLog.slice();
  DEVICE.exportStrings = () => {
    const order = [...R.strings.keys].sort();
    const pick = d => Object.fromEntries(order.filter(k => k in d).map(k => [k, d[k]]));
    return {order, zh: pick(R.strings.zh), en: pick(R.strings.en)};
  };
  DEVICE.fixtures = () => Object.keys(R.fixtures);
  DEVICE.fixture = async function (id) {
    const f = R.fixtures[id];
    if (!f) return {id, ok: false, error: "unknown fixture", log: []};
    const log = [], shots = [];
    const T = Object.assign({}, DEVICE, {
      log: m => log.push(String(m)),
      assert(cond, msg) { if (!cond) throw new Error("assert: " + (msg || "")); },
      // a gallery frame: both screens as they are now (png needs the page's document)
      shot(label) {
        shots.push({label: String(label), screens: [DEVICE.screen(0), DEVICE.screen(1)], stats: [DEVICE.stats(0), DEVICE.stats(1)],
          png: typeof document !== "undefined" ? [DEVICE.png(0, 2), DEVICE.png(1, 2)] : null});
      },
    });
    const wasRunning = world.running;
    world.running = false;
    try { await f.run(T); return {id, ok: true, error: null, log, shots}; }
    catch (e) { return {id, ok: false, error: e && e.message ? e.message : String(e), log, shots}; }
    finally { world.running = wasRunning; }
  };
  DEVICE.hh = p => HH(p);          // [+] internal handheld object (debug panel)
  DEVICE.registry = R;             // [+] registries (debug panel, gallery)

  document.addEventListener("DOMContentLoaded", () => DEVICE.start());
})();
