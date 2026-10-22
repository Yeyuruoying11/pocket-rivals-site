// JUDGE copy of coop-tools/solve.c + optional 10th arg passive = 0/1 (that player only walks: no S, no swap,
// no lever, no winch, does not press the plate, cannot push crates); -1 = off.
// Fast C port of solve.js (same rules, same slot model) for big rooms and dead-state analysis.
// usage: solve_c MAP(90 chars) gateBack p1pet p2pet(3 = absent) shrinePet spawnIdx gateSlots leverSlots dead(0/1)
// prints: "states N", "solvable 0/1", "slots K", "path a0,a1 a0,a1 ...", "dead D", "deadcrate t:n ..."
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#define COLS 10
#define ROWS 9
#define NT 90
#define NONE 127
static const int DX[4] = {0, 1, 0, -1}, DY[4] = {-1, 0, 1, 0};
static const int PASS[3] = {1, 2, 0}, CLEARS[3] = {0, 1, 2};

static char map[NT + 1];
static int objAt[NT], nobj, objKind[16], objType[16];   // kind: 0 bar 1 gate 2 plate 3 lever 4 door 5 item
static int spawn[2] = {-1, -1}, exits[NT], nexit, shrines[NT], nshr, winch = -1, crates0[2], ncr, heavy[2], plate = -1, gate = -1,
           levers[2], nlev, door = -1, gateBack = -1, plateTile = -1, gateTiles[NT], ngate;
static int dyn[16], ndyn, dynOf[16];
static int gateSlots, leverSlots, passive = -1;

static int stepTile(int t, int d) {
  int x = t % COLS + DX[d], y = t / COLS + DY[d];
  return (x >= 0 && y >= 0 && x < COLS && y < ROWS) ? y * COLS + x : -1;
}
static int near4(int a, int b) { return abs(a % COLS - b % COLS) + abs(a / COLS - b / COLS) == 1; }
static int barIdx(char c) { return c == 'V' ? 0 : c == 'F' ? 1 : c == 'W' ? 2 : -1; }

static void build(void) {
  int seen[NT] = {0};
  for (int t = 0; t < NT; t++) objAt[t] = -1;
  for (int t = 0; t < NT; t++) {
    char ch = map[t];
    if (ch == '1') spawn[0] = t;
    else if (ch == '2') spawn[1] = t;
    else if (ch == 'E') exits[nexit++] = t;
    else if (ch == 'S') shrines[nshr++] = t;
    else if (ch == 'R') winch = t;
    else if (ch == 'C') { heavy[ncr] = 0; crates0[ncr++] = t; }
    else if (ch == 'H') { heavy[ncr] = 1; crates0[ncr++] = t; }
    else if (ch == 'P') { plate = nobj; objKind[nobj] = 2; objAt[t] = nobj++; plateTile = t; }
    else if (ch == 'L') { levers[nlev++] = nobj; objKind[nobj] = 3; objAt[t] = nobj++; }
    else if (ch == '$' || ch == '+') { objKind[nobj] = 5; objAt[t] = nobj++; }
    else if (ch == 'G' && !seen[t]) {
      gate = nobj; objKind[nobj] = 1;
      for (int k = 0; k < NT; k++) if (map[k] == 'G') { seen[k] = 1; objAt[k] = nobj; gateTiles[ngate++] = k; }
      nobj++;
    } else if (barIdx(ch) >= 0 && !seen[t]) {
      int st[NT], sp = 0; st[sp++] = t; seen[t] = 1;
      objKind[nobj] = 0; objType[nobj] = barIdx(ch);
      while (sp) {
        int k = st[--sp]; objAt[k] = nobj;
        for (int d = 0; d < 4; d++) { int n = stepTile(k, d); if (n >= 0 && !seen[n] && map[n] == ch) { seen[n] = 1; st[sp++] = n; } }
      }
      nobj++;
    }
  }
  if (nlev == 2) { door = nobj; objKind[nobj] = 4; nobj++; }
  for (int i = 0; i < nobj; i++) { dynOf[i] = -1; if (objKind[i] != 5) { dynOf[i] = ndyn; dyn[ndyn++] = i; } }
  for (int i = ncr; i < 2; i++) { crates0[i] = NONE; heavy[i] = 0; }
}

#define BIT(b, i) ((i) >= 0 && (((b) >> (i)) & 1))
static int walkable(int bits, int pet, int t) {
  if (t < 0) return 0;
  char ch = map[t];
  if (ch == '#' || ch == 'R' || ch == 'L' || ch == 'S' || ch == 'B') return 0;
  int b = barIdx(ch);
  if (b >= 0) return BIT(bits, objAt[t]) || PASS[pet] == b;
  if (ch == 'G') return BIT(bits, gate);
  return 1;
}
static int floorish(int bits, int t) {
  if (t < 0) return 0;
  char ch = map[t];
  if (strchr(".PE12CHs", ch)) return 1;
  if (barIdx(ch) >= 0) return BIT(bits, objAt[t]);
  return 0;
}

typedef struct { int pos[2], pet[2], shrine, bits, cr[2], gateT, leverT; } S;

static uint64_t enc(const S *s) {
  uint64_t cb = 0;
  for (int k = 0; k < ndyn; k++) if (BIT(s->bits, dyn[k])) cb |= 1ull << k;
  uint64_t v = 0; int sh = 0;
#define PUT(x, w) do { v |= ((uint64_t)(x)) << sh; sh += (w); } while (0)
  PUT(s->pos[0], 7); PUT(s->pos[1], 7); PUT(s->pet[0], 2); PUT(s->pet[1], 2); PUT(s->shrine, 2); PUT(cb, 13);
  PUT(s->cr[0], 7); PUT(s->cr[1], 7); PUT(s->gateT, 2); PUT(s->leverT, 3);
  return v;
}
static void dec(uint64_t v, S *s) {
#define GET(w) ((int)(v & ((1ull << (w)) - 1))); v >>= (w)
  s->pos[0] = GET(7); s->pos[1] = GET(7); s->pet[0] = GET(2); s->pet[1] = GET(2); s->shrine = GET(2);
  int cb = GET(13);
  s->bits = 0;
  for (int k = 0; k < ndyn; k++) if ((cb >> k) & 1) s->bits |= 1 << dyn[k];
  s->cr[0] = GET(7); s->cr[1] = GET(7); s->gateT = GET(2); s->leverT = GET(3);
}

static int nActions(const S *s, int p, int *out) {
  int n = 0;
  if (s->pos[p] == NONE) { out[n++] = 0; return n; }
  for (int a = 0; a <= 4; a++) out[n++] = a;
  if (p == passive) return n;
  int pos = s->pos[p], pet = s->pet[p];
  for (int d = 0; d < 4; d++) {
    int f = stepTile(pos, d);
    if (f < 0) continue;
    int oi = objAt[f];
    if (f == winch) { out[n++] = 5 + d; continue; }
    if (oi >= 0 && objKind[oi] == 3 && !BIT(s->bits, oi) && !BIT(s->bits, door)) { out[n++] = 5 + d; continue; }
    if (oi >= 0 && objKind[oi] == 0 && !BIT(s->bits, oi) && CLEARS[pet] == objType[oi]) out[n++] = 5 + d;
  }
  if (s->shrine != 3) for (int k = 0; k < nshr; k++) if (near4(shrines[k], pos)) { out[n++] = 9; break; }
  return n;
}

static int heroAt(const S *s, int t) { return s->pos[0] == t || s->pos[1] == t; }
static int crateAt(const S *s, int t) { return s->cr[0] == t ? 0 : s->cr[1] == t ? 1 : -1; }

// returns 0 normally
static void step(const S *s0, const int *a, S *s) {
  *s = *s0;
  int moved1 = 0, leverSet = 0, hold = 0;
  for (int p = 0; p < 2; p++) {
    if (s->pos[p] == NONE) continue;
    int ac = a[p];
    if (ac < 1 || ac > 4) continue;
    if (p == 1 && moved1) continue;
    int d = ac - 1, n = stepTile(s->pos[p], d);
    if (n < 0 || !walkable(s->bits, s->pet[p], n)) continue;
    int c = crateAt(s, n);
    if (c >= 0 && p == passive) continue;
    if (c >= 0) {
      int n2 = stepTile(n, d);
      int fr = floorish(s->bits, n2) && crateAt(s, n2) < 0 && !heroAt(s, n2);
      if (heavy[c]) {
        int q = 1 - p;
        if (p == 0 && s->pos[q] == s->pos[p] && a[q] == ac && walkable(s->bits, s->pet[q], n) && fr) {
          s->cr[c] = n2; s->pos[0] = n; s->pos[1] = n; moved1 = 1;
        }
        continue;
      }
      if (!fr) continue;
      s->cr[c] = n2;
    }
    s->pos[p] = n;
  }
  for (int p = 0; p < 2; p++) {
    if (s->pos[p] == NONE) continue;
    int ac = a[p];
    if (ac >= 5 && ac <= 8) {
      int f = stepTile(s->pos[p], ac - 5), oi = f >= 0 ? objAt[f] : -1;
      if (f == winch) { hold = 1; continue; }
      if (oi >= 0 && objKind[oi] == 3) {
        if (BIT(s->bits, oi) || BIT(s->bits, door)) continue;
        s->bits |= 1 << oi;
        int other = levers[0] == oi ? levers[1] : levers[0];
        if (BIT(s->bits, other)) { s->bits |= 1 << door; s->leverT = 0; }
        else { s->leverT = leverSlots; leverSet = 1; }
        continue;
      }
      if (oi >= 0 && objKind[oi] == 0 && !BIT(s->bits, oi) && CLEARS[s->pet[p]] == objType[oi]) s->bits |= 1 << oi;
    } else if (ac == 9 && s->shrine != 3) {
      for (int k = 0; k < nshr; k++) if (near4(shrines[k], s->pos[p])) { int w = s->pet[p]; s->pet[p] = s->shrine; s->shrine = w; break; }
    }
  }
  if (plate >= 0) {
    if ((s->pos[0] == plateTile && passive != 0) || (s->pos[1] == plateTile && passive != 1) || crateAt(s, plateTile) >= 0) s->bits |= 1 << plate; else s->bits &= ~(1 << plate);
  }
  if (gate >= 0) {
    int want = hold || BIT(s->bits, plate);
    if (want) { s->bits |= 1 << gate; s->gateT = 0; }
    else if (BIT(s->bits, gate)) {
      if (s->gateT == 0) s->gateT = gateSlots;
      else {
        s->gateT--;
        if (s->gateT == 0) {
          s->bits &= ~(1 << gate);
          for (int p = 0; p < 2; p++) for (int k = 0; k < ngate; k++) if (s->pos[p] == gateTiles[k]) { int b = stepTile(s->pos[p], gateBack); if (b >= 0) s->pos[p] = b; break; }
        }
      }
    }
  }
  if (s->leverT > 0 && !leverSet) {
    s->leverT--;
    if (s->leverT == 0 && !BIT(s->bits, door)) { s->bits &= ~(1 << levers[0]); s->bits &= ~(1 << levers[1]); }
  }
}

static int isGoal(const S *s) {
  if (door >= 0 && !BIT(s->bits, door)) return 0;
  for (int p = 0; p < 2; p++) {
    if (s->pos[p] == NONE) continue;
    int ok = 0;
    for (int k = 0; k < nexit; k++) if (exits[k] == s->pos[p]) ok = 1;
    if (!ok) return 0;
  }
  return 1;
}

// ---- hash set ----
static uint64_t *keys; static int32_t *ids; static uint64_t hmask;
static uint64_t *codes; static int32_t *parent; static uint8_t *pact; static int64_t ncodes, cap;
static uint64_t hsh(uint64_t x) { x ^= x >> 33; x *= 0xff51afd7ed558ccdull; x ^= x >> 33; x *= 0xc4ceb9fe1a85ec53ull; x ^= x >> 33; return x; }
static int64_t lookup(uint64_t k, int insert, int32_t par, uint8_t act, int *isNew) {
  uint64_t h = hsh(k) & hmask;
  *isNew = 0;
  for (;;) {
    if (keys[h] == 0) {
      if (!insert) return -1;
      keys[h] = k + 1; ids[h] = (int32_t)ncodes;
      codes[ncodes] = k; parent[ncodes] = par; pact[ncodes] = act; *isNew = 1;
      return ncodes++;
    }
    if (keys[h] == k + 1) return ids[h];
    h = (h + 1) & hmask;
  }
}

int main(int argc, char **argv) {
  if (argc < 10) { fprintf(stderr, "args\n"); return 2; }
  memcpy(map, argv[1], NT); map[NT] = 0;
  gateBack = atoi(argv[2]);
  int pet0 = atoi(argv[3]), pet1 = atoi(argv[4]), shr = atoi(argv[5]), sp = atoi(argv[6]);
  gateSlots = atoi(argv[7]); leverSlots = atoi(argv[8]); int dead = atoi(argv[9]);
  if (argc > 10) passive = atoi(argv[10]);
  build();
  cap = 20000000; int hbits = 26;
  hmask = (1ull << hbits) - 1;
  keys = calloc(hmask + 1, 8); ids = malloc((hmask + 1) * 4);
  codes = malloc(cap * 8); parent = malloc(cap * 4); pact = malloc(cap);
  int64_t *eoff = NULL; int32_t *edges = NULL; int64_t ne = 0, ecap = 0;
  if (dead) { eoff = malloc((cap + 1) * 8); ecap = 160000000; edges = malloc(ecap * 4); }
  S st; memset(&st, 0, sizeof st);
  if (pet1 == 3) { st.pos[0] = spawn[sp]; st.pos[1] = NONE; } else { st.pos[0] = spawn[0]; st.pos[1] = spawn[1]; }
  st.pet[0] = pet0; st.pet[1] = pet1; st.shrine = shr; st.cr[0] = crates0[0]; st.cr[1] = crates0[1];
  int isNew;
  lookup(enc(&st), 1, -1, 0, &isNew);
  int64_t head = 0, firstGoal = -1;
  int64_t ngoals = 0;
  uint8_t *goal = dead ? calloc(cap, 1) : NULL;
  while (head < ncodes) {
    int64_t i = head++;
    S s; dec(codes[i], &s);
    if (dead) eoff[i] = ne;
    if (isGoal(&s)) { if (firstGoal < 0) firstGoal = i; ngoals++; if (!dead) break; goal[i] = 1; continue; }
    if (ncodes > cap - 2000) { printf("overflow 1\n"); break; }
    int A0[10], A1[10], n0 = nActions(&s, 0, A0), n1 = nActions(&s, 1, A1);
    for (int x = 0; x < n0; x++) for (int y = 0; y < n1; y++) {
      int a[2] = {A0[x], A1[y]}; S r; step(&s, a, &r);
      int64_t j = lookup(enc(&r), 1, (int32_t)i, (uint8_t)(A0[x] * 10 + A1[y]), &isNew);
      if (dead && j != i) {
        int dup = 0;
        for (int64_t e = eoff[i]; e < ne; e++) if (edges[e] == (int32_t)j) { dup = 1; break; }
        if (!dup) { if (ne >= ecap) { printf("edge overflow\n"); return 1; } edges[ne++] = (int32_t)j; }
      }
    }
  }
  if (dead) eoff[head] = ne;
  printf("states %lld\n", (long long)ncodes);
  printf("solvable %d\n", firstGoal >= 0);
  if (firstGoal >= 0) {
    int len = 0; for (int64_t k = firstGoal; parent[k] >= 0; k = parent[k]) len++;
    printf("slots %d\npath", len);
    int *acts = malloc(len * 4); int q = len;
    for (int64_t k = firstGoal; parent[k] >= 0; k = parent[k]) acts[--q] = pact[k];
    for (int k = 0; k < len; k++) printf(" %d,%d", acts[k] / 10, acts[k] % 10);
    printf("\n");
  }
  if (dead && head == ncodes) {
    // reverse edges (CSR), then reverse BFS from goals
    int64_t n = ncodes;
    int64_t *roff = calloc(n + 1, 8);
    for (int64_t e = 0; e < ne; e++) roff[edges[e] + 1]++;
    for (int64_t i = 0; i < n; i++) roff[i + 1] += roff[i];
    int32_t *redges = malloc(ne * 4 + 4); int64_t *fill = malloc(n * 8);
    memcpy(fill, roff, n * 8);
    for (int64_t i = 0; i < n; i++) for (int64_t e = eoff[i]; e < eoff[i + 1]; e++) redges[fill[edges[e]]++] = (int32_t)i;
    uint8_t *good = calloc(n, 1); int32_t *q = malloc(n * 4); int64_t qh = 0, qt = 0;
    for (int64_t i = 0; i < n; i++) if (goal[i]) { good[i] = 1; q[qt++] = (int32_t)i; }
    while (qh < qt) { int32_t j = q[qh++]; for (int64_t e = roff[j]; e < roff[j + 1]; e++) { int32_t i = redges[e]; if (!good[i]) { good[i] = 1; q[qt++] = i; } } }
    int64_t nd = 0;
    // classify dead states: by crate positions, by pets, by bits
    static int64_t byCrate[128][128]; memset(byCrate, 0, sizeof byCrate);
    static int64_t byBits[1 << 13]; memset(byBits, 0, sizeof byBits);
    static int64_t totCrate[128][128]; memset(totCrate, 0, sizeof totCrate);
    for (int64_t i = 0; i < n; i++) { S s; dec(codes[i], &s); totCrate[s.cr[0]][s.cr[1]]++; }
    for (int64_t i = 0; i < n; i++) if (!good[i]) {
      nd++; S s; dec(codes[i], &s); byCrate[s.cr[0]][s.cr[1]]++;
      uint64_t cb = 0; for (int k = 0; k < ndyn; k++) if (BIT(s.bits, dyn[k])) cb |= 1ull << k; byBits[cb]++;
    }
    printf("dead %lld\n", (long long)nd);
    // along the optimal path: how many one-step deviations lead into a dead state
    if (firstGoal >= 0) {
      int64_t pushTot = 0, pushDead = 0, anyTot = 0, anyDead = 0;
      for (int64_t k = parent[firstGoal]; k >= 0; k = parent[k]) {
        S s; dec(codes[k], &s);
        int A0[10], A1[10], n0 = nActions(&s, 0, A0), n1 = nActions(&s, 1, A1);
        int64_t seenJ[128]; int ns = 0;
        for (int x = 0; x < n0; x++) for (int y = 0; y < n1; y++) {
          int a[2] = {A0[x], A1[y]}; S r; step(&s, a, &r);
          int isN; int64_t j = lookup(enc(&r), 0, 0, 0, &isN);
          if (j < 0 || j == k) continue;
          int dup = 0; for (int q2 = 0; q2 < ns; q2++) if (seenJ[q2] == j) dup = 1;
          if (dup) continue;
          if (ns < 128) seenJ[ns++] = j;
          anyTot++; if (!good[j]) anyDead++;
          if (r.cr[0] != s.cr[0] || r.cr[1] != s.cr[1]) { pushTot++; if (!good[j]) pushDead++; }
        }
      }
      printf("pathdev %lld %lld %lld %lld\n", (long long)anyTot, (long long)anyDead, (long long)pushTot, (long long)pushDead);
    }
    printf("deadcrates");
    for (int a = 0; a < 128; a++) for (int b = 0; b < 128; b++) if (byCrate[a][b]) printf(" %d/%d:%lld", a, b, (long long)byCrate[a][b]);
    printf("\ndeadtiles");
    for (int a = 0; a < 128; a++) for (int b = 0; b < 128; b++) if (totCrate[a][b] && byCrate[a][b] == totCrate[a][b]) printf(" %d/%d", a, b);
    printf("\nalivetiles");
    for (int a = 0; a < 128; a++) for (int b = 0; b < 128; b++) if (totCrate[a][b] && byCrate[a][b] < totCrate[a][b]) printf(" %d/%d", a, b);
    printf("\ndeadbits");
    for (int c = 0; c < (1 << ndyn); c++) if (byBits[c]) printf(" %d:%lld", c, (long long)byBits[c]);
    printf("\ndynobjs");
    for (int k = 0; k < ndyn; k++) printf(" %d:%d", dyn[k], objKind[dyn[k]]);
    printf("\n");
    // sample dead states (first 30 in BFS order = closest to the start)
    printf("deadsamples");
    int shown = 0;
    for (int64_t i = 0; i < n && shown < 30; i++) if (!good[i]) { S s; dec(codes[i], &s); printf(" %d,%d,%d,%d,%d,%d,%d,%d", s.pos[0], s.pos[1], s.pet[0], s.pet[1], s.cr[0], s.cr[1], s.bits, s.leverT); shown++; }
    printf("\n");
  }
  return 0;
}
