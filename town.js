// Your town: every name you proposed first is one resident.
// The population picks the level, and the level decides what gets built.
// Drawn as an isometric diorama: a 9x9 island of tiles seen from above at an angle.
(() => {
  const STAGES = [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  function stageOf(pop) {
    let s = 0;
    STAGES.forEach((min, i) => { if (pop >= min) s = i; });
    return s;
  }

  // ---- geometry ----
  const N = 9, HW = 18, HH = 9, OX = 180, OY = 110; // tile half-width/half-height, top corner of the island
  const C = 4; // centre tile
  const center = (i, j) => [OX + (i - j) * HW, OY + (i + j) * HH + HH];
  const f = (n) => n.toFixed(1);
  const pts = (list) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
  const poly = (list, fill, extra = '') => `<polygon points="${pts(list)}" fill="${fill}"${extra}/>`;

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
  }

  // Deterministic pseudo-random numbers so the same population always draws the same town.
  function rng(seed) {
    let x = (seed * 2654435761 + 1013904223) % 2147483647 || 1;
    const next = () => ((x = (x * 48271) % 2147483647) / 2147483647);
    next(); next(); // the first outputs of a small seed are not well mixed
    return next;
  }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

  const WALLS = ['#fff4e6', '#fff9db', '#ebfbee', '#e7f5ff', '#f8f0fc', '#fff0f6', '#f1f3f5'];
  const ROOFS = ['#e8590c', '#c92a2a', '#1971c2', '#5c940d', '#862e9c', '#495057', '#d9480f'];

  // An isometric box on tile (i, j). k shrinks the footprint, lift raises the base.
  function boxFaces(i, j, h, k = 0.8, lift = 0) {
    const [x, y0] = center(i, j);
    const y = y0 - lift, w = HW * k, d = HH * k;
    return {
      x, y, w, d, h,
      top: [[x, y - d - h], [x + w, y - h], [x, y + d - h], [x - w, y - h]],
      left: [[x - w, y], [x, y + d], [x, y + d - h], [x - w, y - h]],
      right: [[x, y + d], [x + w, y], [x + w, y - h], [x, y + d - h]],
    };
  }

  function box(i, j, h, color, k, lift) {
    const b = boxFaces(i, j, h, k, lift);
    return { b, svg: poly(b.left, shade(color, 0.86)) + poly(b.right, shade(color, 0.7)) + poly(b.top, color) };
  }

  // Windows on both visible faces: one row per floor.
  function windows(b, lit, r, floorH = 7, cols = 2) {
    const out = [];
    const rows = Math.max(1, Math.floor((b.h - 4) / floorH));
    for (const side of ['left', 'right']) {
      // u runs along the face base, from its left end to its right end
      const [ox, oy] = side === 'left' ? [b.x - b.w, b.y] : [b.x, b.y + b.d];
      const ux = b.w, uy = side === 'left' ? b.d : -b.d;
      for (let row = 0; row < rows; row++) {
        const z = 4 + row * floorH;
        for (let c = 0; c < cols; c++) {
          const a0 = (c + 0.25) / cols, a1 = (c + 0.75) / cols;
          const p = (a, dz) => [ox + ux * a, oy + uy * a - dz];
          const on = lit && r() < 0.7;
          const col = on ? '#ffd43b' : lit ? '#1f2a44' : side === 'left' ? '#a5d8ff' : '#74c0fc';
          out.push(poly([p(a0, z), p(a1, z), p(a1, z + 3.5), p(a0, z + 3.5)], col));
        }
      }
    }
    return out.join('');
  }

  // Four-sided roof on top of a box.
  function roof(b, color, rh) {
    const [n, e, s, w] = b.top;
    const apex = [b.x, b.y - b.h - rh];
    return poly([w, n, apex], shade(color, 1.1)) + poly([n, e, apex], shade(color, 0.95)) +
      poly([w, s, apex], shade(color, 0.85)) + poly([s, e, apex], shade(color, 0.68));
  }

  const build = {
    tent(i, j, r) {
      const [x, y] = center(i, j);
      const c = pick(r, ['#f76707', '#e03131', '#1c7ed6', '#2f9e44']);
      return poly([[x - 11, y + 2], [x, y + 7], [x, y - 13]], shade(c, 0.9)) + poly([[x, y + 7], [x + 11, y + 2], [x, y - 13]], shade(c, 0.65)) +
        poly([[x - 2, y + 6], [x, y - 3], [x + 2, y + 6]], '#00000055');
    },
    hut(i, j, r) {
      const { b, svg } = box(i, j, 7, '#c69c6d', 0.62);
      return svg + roof(b, '#a47148', 7);
    },
    house(i, j, r) {
      const { b, svg } = box(i, j, 10 + Math.round(r() * 3), pick(r, WALLS), 0.7);
      return svg + windows(b, false, r, 8, 1) + roof(b, pick(r, ROOFS), 9);
    },
    shop(i, j, r, lit) {
      const { b, svg } = box(i, j, 15, pick(r, WALLS), 0.78);
      const awn = pick(r, ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00']);
      const band = (side) => {
        const [ox, oy] = side === 'left' ? [b.x - b.w, b.y] : [b.x, b.y + b.d];
        const uy = side === 'left' ? b.d : -b.d;
        return poly([[ox, oy - 6], [ox + b.w, oy + uy - 6], [ox + b.w, oy + uy - 10], [ox, oy - 10]], side === 'left' ? awn : shade(awn, 0.75));
      };
      const glass = (side) => {
        const [ox, oy] = side === 'left' ? [b.x - b.w, b.y] : [b.x, b.y + b.d];
        const uy = side === 'left' ? b.d : -b.d;
        return poly([[ox + b.w * .15, oy + uy * .15 - 1], [ox + b.w * .85, oy + uy * .85 - 1], [ox + b.w * .85, oy + uy * .85 - 5.5], [ox + b.w * .15, oy + uy * .15 - 5.5]], lit ? '#ffe066' : '#d0ebff');
      };
      return svg + glass('left') + glass('right') + band('left') + band('right');
    },
    apartment(i, j, r, lit, s) {
      const h = Math.round((24 + r() * 22) * (s >= 9 ? 1.25 : 1));
      const { b, svg } = box(i, j, h, lit ? '#868e96' : pick(r, ['#dee2e6', '#e9ecef', '#ffe8cc', '#e3fafc', '#f3f0ff']), 0.8);
      return svg + windows(b, lit, r, 7, 2) + poly(boxFaces(i, j, 0, 0.3, h).top, '#adb5bd');
    },
    tower(i, j, r, lit, s, rank) {
      // the closer to the centre, the taller
      const h = Math.min(150, Math.round((70 + r() * 30 - rank * 2.5) * (1 + (s - 9) * 0.18)));
      const glass = lit ? '#2b3a5c' : pick(r, ['#74c0fc', '#91a7ff', '#63e6be', '#a5d8ff', '#99e9f2']);
      const { b, svg } = box(i, j, h, glass, 0.82);
      let top = '';
      if (r() < 0.45) {
        top = `<line x1="${f(b.x)}" y1="${f(b.y - h)}" x2="${f(b.x)}" y2="${f(b.y - h - 14)}" stroke="#868e96" stroke-width="1.4"/><circle cx="${f(b.x)}" cy="${f(b.y - h - 14)}" r="1.8" fill="#fa5252" class="tw-blink"/>`;
      }
      return svg + windows(b, lit, r, 7, 3) + top;
    },
    tree(i, j, r, lit) {
      const [x0, y0] = center(i, j);
      const x = x0 + (r() - 0.5) * 10, y = y0 + (r() - 0.5) * 5;
      const g = pick(r, ['#2f9e44', '#37b24d', '#40c057', '#2b8a3e']);
      return `<rect x="${f(x - 1.2)}" y="${f(y - 7)}" width="2.4" height="7" fill="#8d6e63"/><circle cx="${f(x)}" cy="${f(y - 11)}" r="6" fill="${lit ? shade(g, 0.55) : g}"/><circle cx="${f(x - 2)}" cy="${f(y - 13)}" r="2.5" fill="#ffffff33"/>`;
    },
    landmark(i, j, s, lit) {
      const [x, y] = center(i, j);
      const h = 110 + (s - 9) * 18;
      const legs = poly([[x - 12, y + 2], [x - 3, y - h * .55], [x, y - h * .55], [x - 6, y + 2]], lit ? '#ff8787' : '#e03131') +
        poly([[x + 12, y + 2], [x + 3, y - h * .55], [x, y - h * .55], [x + 6, y + 2]], lit ? '#e03131' : '#c92a2a');
      const spire = poly([[x - 3, y - h * .55], [x, y - h], [x + 3, y - h * .55]], lit ? '#ff8787' : '#e03131');
      const decks = [0.2, 0.42, 0.55, 0.78].map((a) => {
        const yy = y - h * a, half = 12 * (1 - a) + 2;
        return poly([[x - half, yy], [x, yy + 2], [x + half, yy], [x, yy - 2]], '#f8f9fa');
      }).join('');
      return legs + spire + decks + `<circle cx="${x}" cy="${f(y - h)}" r="2.4" fill="#ffe066" class="tw-blink"/>`;
    },
    campfire(i, j) {
      const [x, y] = center(i, j);
      return `<rect x="${x - 5}" y="${y - 1}" width="10" height="2.4" rx="1" fill="#6f4518" transform="rotate(20 ${x} ${y})"/><rect x="${x - 5}" y="${y - 1}" width="10" height="2.4" rx="1" fill="#8d6e63" transform="rotate(-20 ${x} ${y})"/>` +
        `<g class="tw-fire"><path d="M${x - 4} ${y} Q${x} ${y - 14} ${x + 4} ${y}z" fill="#ff922b"/><path d="M${x - 2} ${y} Q${x} ${y - 8} ${x + 2} ${y}z" fill="#ffe066"/></g>`;
    },
  };

  function kindFor(s, k, n, r) {
    const a = k / Math.max(1, n); // 0 = centre, 1 = edge of town
    const roll = r();
    if (s <= 1) return 'tent';
    if (s === 2) return roll < 0.5 ? 'tent' : 'hut';
    if (s === 3) return roll < 0.4 ? 'hut' : 'house';
    if (s <= 5) return a < 0.2 ? 'shop' : 'house';
    if (s === 6) return a < 0.15 ? 'apartment' : a < 0.35 ? 'shop' : 'house';
    if (s <= 8) return a < 0.3 ? 'apartment' : a < 0.5 ? 'shop' : 'house';
    const towers = [0.25, 0.38, 0.5, 0.6][s - 9];
    return a < towers ? 'tower' : a < towers + 0.2 ? 'apartment' : a < towers + 0.3 ? 'shop' : 'house';
  }

  function svg(pop) {
    const s = stageOf(pop);
    const night = s >= 10;
    const roads = s >= 4;
    const out = [];

    // sky
    out.push(`<defs><linearGradient id="tw-sky-${s}" x1="0" y1="0" x2="0" y2="1">${night
      ? '<stop offset="0" stop-color="#0b1033"/><stop offset="1" stop-color="#3b2a6b"/>'
      : '<stop offset="0" stop-color="#8ecbff"/><stop offset="1" stop-color="#e7f5ff"/>'}</linearGradient></defs>`);
    out.push(`<rect width="360" height="300" fill="url(#tw-sky-${s})"/>`);
    if (night) {
      const r = rng(7);
      out.push(Array.from({ length: 50 }, () => `<circle cx="${f(r() * 360)}" cy="${f(r() * 130)}" r="${f(0.4 + r())}" fill="#fff" opacity="${f(0.3 + r() * 0.7)}"/>`).join(''));
      out.push('<circle cx="318" cy="36" r="14" fill="#fff9db"/><circle cx="324" cy="32" r="12" fill="#0b1033"/>');
    } else {
      out.push('<circle cx="316" cy="38" r="16" fill="#ffd43b"/>');
      out.push('<g class="tw-cloud"><ellipse cx="60" cy="44" rx="22" ry="8" fill="#fff"/><ellipse cx="74" cy="38" rx="14" ry="8" fill="#fff"/></g>');
      out.push('<g class="tw-cloud" style="animation-duration:90s;animation-delay:-40s"><ellipse cx="200" cy="70" rx="18" ry="6" fill="#fff"/><ellipse cx="210" cy="65" rx="11" ry="6" fill="#fff"/></g>');
    }
    // searchlights behind the island
    if (s >= 11) {
      out.push('<g class="tw-beam" style="transform-origin:110px 200px"><path d="M110 200 L85 0 H135z" fill="#fff3bf" opacity=".16"/></g>');
      out.push('<g class="tw-beam" style="transform-origin:250px 200px;animation-delay:-3s"><path d="M250 200 L225 0 H275z" fill="#fff3bf" opacity=".16"/></g>');
    }
    // fireworks
    if (s >= 12) {
      [[60, 60, '#ff6b6b', 0], [300, 80, '#ffd43b', 0.8], [250, 40, '#69db7c', 1.6], [100, 100, '#74c0fc', 2.2]].forEach(([x, y, c, d]) => {
        out.push(`<g class="tw-firework" style="animation-delay:${d}s;transform-origin:${x}px ${y}px">` +
          Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return `<line x1="${f(x + 4 * Math.cos(a))}" y1="${f(y + 4 * Math.sin(a))}" x2="${f(x + 18 * Math.cos(a))}" y2="${f(y + 18 * Math.sin(a))}" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
          }).join('') + '</g>');
      });
    }

    // the island: a slab of earth with grass on top
    const top = [OX, OY], right = [OX + N * HW, OY + N * HH], bottom = [OX, OY + 2 * N * HH], left = [OX - N * HW, OY + N * HH];
    const T = 16;
    out.push(poly([left, bottom, [bottom[0], bottom[1] + T], [left[0], left[1] + T]], night ? '#4a3728' : '#a0785a'));
    out.push(poly([bottom, right, [right[0], right[1] + T], [bottom[0], bottom[1] + T]], night ? '#3a2b20' : '#7f5f45'));
    out.push(poly([left, bottom, [bottom[0], bottom[1] + 4], [left[0], left[1] + 4]], night ? '#2b5b2b' : '#5c9e45'));
    out.push(poly([bottom, right, [right[0], right[1] + 4], [bottom[0], bottom[1] + 4]], night ? '#224a22' : '#4d8a3a'));
    out.push(poly([top, right, bottom, left], night ? '#2f6b34' : '#8ce99a'));
    // faint tile grid
    const grid = [];
    for (let k = 1; k < N; k++) {
      const a = [OX + k * HW, OY + k * HH], b = [OX - (N - k) * HW + 0, OY + (N + k) * HH];
      const c = [OX - k * HW, OY + k * HH], d = [OX + (N - k) * HW, OY + (N + k) * HH];
      grid.push(`M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}M${f(c[0])} ${f(c[1])}L${f(d[0])} ${f(d[1])}`);
    }
    out.push(`<path d="${grid.join('')}" stroke="${night ? '#ffffff10' : '#ffffff55'}" stroke-width="1" fill="none"/>`);

    // roads through the middle
    const isRoad = (i, j) => roads && (i === C || j === C);
    if (roads) {
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        if (!isRoad(i, j)) continue;
        const [x, y] = center(i, j);
        out.push(poly([[x, y - HH], [x + HW, y], [x, y + HH], [x - HW, y]], night ? '#343a40' : '#868e96'));
      }
      const [ax, ay] = center(0, C), [bx, by] = center(N - 1, C), [cx, cy] = center(C, 0), [dx, dy] = center(C, N - 1);
      out.push(`<path d="M${ax} ${ay}L${bx} ${by}M${cx} ${cy}L${dx} ${dy}" stroke="#f8f9fa" stroke-width="1" stroke-dasharray="4 4" opacity=".8"/>`);
    }

    // cars and residents move along the roads (or around the camp before there are roads)
    if (s >= 6) {
      const cars = Math.min(6, s - 5);
      for (let k = 0; k < cars; k++) {
        const alongI = k % 2 === 0;
        const [sx, sy] = alongI ? center(0, C) : center(C, N - 1);
        const c = ['#e03131', '#1c7ed6', '#f08c00', '#2f9e44', '#f8f9fa', '#7048e8'][k];
        const dx = 8 * HW, dy = alongI ? 8 * HH : -8 * HH;
        const car = alongI
          ? poly([[sx - 5, sy - 1], [sx + 1, sy + 2], [sx + 5, sy], [sx - 1, sy - 3]], c) + poly([[sx - 5, sy - 1], [sx + 1, sy + 2], [sx + 1, sy + 4], [sx - 5, sy + 1]], shade(c, 0.7))
          : poly([[sx - 5, sy], [sx + 1, sy - 3], [sx + 5, sy - 1], [sx - 1, sy + 2]], c) + poly([[sx - 5, sy], [sx - 1, sy + 2], [sx - 1, sy + 4], [sx - 5, sy + 2]], shade(c, 0.7));
        out.push(`<g class="tw-move" style="--dx:${dx}px;--dy:${dy}px;animation-duration:${7 + k * 1.6}s;animation-delay:-${k * 2.1}s">${car}${night ? `<circle cx="${sx + 4}" cy="${sy}" r="1.3" fill="#fff3bf"/>` : ''}</g>`);
      }
    }
    const walkers = Math.min(pop, 14);
    for (let k = 0; k < walkers; k++) {
      const r = rng(500 + k);
      const c = ['#f03e3e', '#1c7ed6', '#f59f00', '#7048e8', '#0ca678', '#e64980'][k % 6];
      let i, j, dx, dy;
      if (roads) {
        const alongI = k % 2 === 0;
        i = alongI ? Math.floor(r() * 3) : C; j = alongI ? C : Math.floor(r() * 3) + 5;
        dx = (3 + r() * 3) * HW; dy = (alongI ? 1 : -1) * dx / 2;
      } else {
        i = 3 + Math.floor(r() * 3); j = 3 + Math.floor(r() * 3);
        dx = 14; dy = 7;
      }
      const [x, y] = center(i, j);
      const ox = (r() - 0.5) * 8;
      out.push(`<g class="tw-stroll" style="--dx:${f(dx)}px;--dy:${f(dy)}px;animation-duration:${f(5 + r() * 6)}s;animation-delay:-${f(r() * 6)}s"><rect x="${f(x + ox - 1.6)}" y="${f(y - 5)}" width="3.2" height="5" rx="1.4" fill="${c}"/><circle cx="${f(x + ox)}" cy="${f(y - 7)}" r="1.9" fill="#ffd8a8"/></g>`);
    }

    // buildings and trees, painted back to front
    const tiles = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (isRoad(i, j)) continue;
      const jitter = rng(i * 13 + j * 7 + 3)();
      tiles.push({ i, j, dist: Math.hypot(i - C + 0.5, j - C + 0.5) + jitter * 0.6 });
    }
    tiles.sort((a, b) => a.dist - b.dist);
    const landmark = s >= 9 ? { i: C - 1, j: C - 1 } : null;
    const free = tiles.filter((t) => !(landmark && t.i === landmark.i && t.j === landmark.j));
    const n = pop <= 0 ? 0 : Math.max(1, Math.min(free.length, Math.round(Math.sqrt(pop) * 2) - 1));

    const items = [];
    free.forEach((t, k) => {
      const r = rng(1000 + t.i * 31 + t.j * 17);
      if (k < n) items.push({ ...t, svg: build[kindFor(s, k, n, r)](t.i, t.j, r, night, s, k) });
      else if (s <= 9 && r() < (s === 0 ? 0.08 : 0.3)) items.push({ ...t, svg: build.tree(t.i, t.j, r, night) });
    });
    if (landmark) items.push({ ...landmark, svg: build.landmark(landmark.i, landmark.j, s, night) });
    if (s === 1) items.push({ i: C, j: C + 1, svg: build.campfire(C, C + 1) });
    items.sort((a, b) => (a.i + a.j) - (b.i + b.j) || a.i - b.i);
    out.push(items.map((it) => it.svg).join(''));

    // The camera starts close on a small camp and pulls back as the town spreads out.
    const z = [1.7, 1.7, 1.6, 1.5, 1.35, 1.3, 1.2, 1.12, 1.05, 1, 1, 1, 1][s];
    const vw = 360 / z, vh = 300 / z;
    const vx = 180 - vw / 2, vy = Math.min(300 - vh, Math.max(0, 182 - vh / 2));
    return `<svg viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}" role="img" aria-hidden="true">${out.join('')}</svg>`;
  }

  window.Town = { STAGES, stageOf, svg };
})();
