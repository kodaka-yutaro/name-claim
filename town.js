// Your town: every name you proposed first is one resident.
// The population picks the stage, and the stage decides what gets built.
(() => {
  const STAGES = [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  function stageOf(pop) {
    let s = 0;
    STAGES.forEach((min, i) => { if (pop >= min) s = i; });
    return s;
  }

  // Deterministic pseudo-random numbers so the same population always draws the same town.
  const rng = (seed) => () => ((seed = (seed * 16807 + 11) % 2147483647) / 2147483647);
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const f = (n) => n.toFixed(1);

  const WALLS = ['#ffe8cc', '#fff3bf', '#d3f9d8', '#d0ebff', '#f3d9fa', '#ffdeeb', '#e9ecef'];
  const ROOFS = ['#e8590c', '#c92a2a', '#1971c2', '#5c940d', '#862e9c', '#495057'];

  // center-out fill order, so a small town starts in the middle
  const ORDER = [6, 7, 5, 8, 4, 9, 3, 10, 2, 11, 1, 12, 0, 13];
  const slotX = (i, back) => 18 + i * 25.7 + (back ? 12.8 : 0);

  function windows(x, y, w, h, lit, r, cols = 2) {
    const out = [];
    const rows = Math.max(1, Math.floor((h - 6) / 8));
    const ww = (w - 4 - (cols - 1) * 3) / cols;
    for (let row = 0; row < rows; row++) {
      for (let c = 0; c < cols; c++) {
        const on = lit ? r() < 0.75 : false;
        out.push(`<rect x="${f(x + 2 + c * (ww + 3))}" y="${f(y + 4 + row * 8)}" width="${f(ww)}" height="4" fill="${on ? '#ffe066' : lit ? '#2b3a55' : '#a5d8ff'}"/>`);
      }
    }
    return out.join('');
  }

  const draw = {
    tent: (x, y, r) => `<path d="M${f(x - 11)} ${y}L${x} ${y - 18}L${f(x + 11)} ${y}z" fill="${pick(r, ['#f76707', '#e03131', '#1c7ed6'])}"/><path d="M${x} ${y - 18}L${f(x - 3)} ${y}h6z" fill="#00000033"/>`,
    hut: (x, y, r) => `<rect x="${f(x - 9)}" y="${y - 12}" width="18" height="12" fill="#b08968"/><path d="M${f(x - 12)} ${y - 12}L${x} ${y - 22}L${f(x + 12)} ${y - 12}z" fill="#d4a373"/><rect x="${f(x - 2.5)}" y="${y - 7}" width="5" height="7" fill="#6f4518"/>`,
    house: (x, y, r) => `<rect x="${f(x - 10)}" y="${y - 16}" width="20" height="16" fill="${pick(r, WALLS)}" stroke="#00000022"/><path d="M${f(x - 13)} ${y - 16}L${x} ${y - 28}L${f(x + 13)} ${y - 16}z" fill="${pick(r, ROOFS)}"/><rect x="${f(x - 7)}" y="${y - 12}" width="5" height="5" fill="#a5d8ff"/><rect x="${f(x + 2)}" y="${y - 9}" width="5" height="9" fill="#845ef7"/>`,
    shop: (x, y, r, lit) => {
      const c = pick(r, ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00']);
      const stripes = [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${f(x - 12 + i * 4)}" y="${y - 16}" width="4" height="5" fill="${i % 2 ? '#fff' : c}"/>`).join('');
      return `<rect x="${f(x - 11)}" y="${y - 26}" width="22" height="26" fill="${pick(r, WALLS)}" stroke="#00000022"/>${windows(x - 11, y - 27, 22, 10, lit, r)}${stripes}<rect x="${f(x - 8)}" y="${y - 10}" width="16" height="10" fill="${lit ? '#ffe066' : '#d0ebff'}"/>`;
    },
    apartment: (x, y, r, lit, stage) => {
      const h = Math.round((28 + r() * 26) * (stage >= 9 ? 1.3 : 1));
      return `<rect x="${f(x - 11)}" y="${y - h}" width="22" height="${h}" fill="${lit ? '#495057' : pick(r, ['#ced4da', '#e9ecef', '#ffe8cc', '#dee2e6'])}" stroke="#00000022"/>${windows(x - 11, y - h, 22, h, lit, r)}`;
    },
    tower: (x, y, r, lit, stage) => {
      const h = Math.min(132, Math.round((55 + r() * 40) * (1 + (stage - 9) * 0.2)));
      const glass = lit ? '#1b2a4a' : pick(r, ['#74c0fc', '#91a7ff', '#63e6be', '#a5d8ff']);
      const antenna = r() < 0.5 ? `<rect x="${f(x - 0.75)}" y="${y - h - 12}" width="1.5" height="12" fill="#868e96"/><circle cx="${x}" cy="${y - h - 12}" r="1.8" fill="#fa5252" class="tw-blink"/>` : '';
      return `${antenna}<rect x="${f(x - 11)}" y="${y - h}" width="22" height="${h}" fill="${glass}" stroke="#00000033"/>${windows(x - 11, y - h, 22, h, lit, r, 3)}`;
    },
  };

  function kindFor(stage, r, back) {
    if (back) return stage >= 9 ? 'tower' : 'apartment';
    const roll = r();
    if (stage <= 1) return 'tent';
    if (stage === 2) return roll < 0.4 ? 'tent' : 'hut';
    if (stage === 3) return roll < 0.5 ? 'hut' : 'house';
    if (stage <= 5) return roll < 0.75 ? 'house' : 'shop';
    if (stage === 6) return roll < 0.5 ? 'house' : roll < 0.75 ? 'shop' : 'apartment';
    if (stage <= 8) return roll < 0.25 ? 'house' : roll < 0.5 ? 'shop' : 'apartment';
    return roll < 0.3 ? 'shop' : 'apartment';
  }

  function svg(pop) {
    const s = stageOf(pop);
    const night = s >= 10;
    const out = [];
    const defs = `<linearGradient id="tw-sky" x1="0" y1="0" x2="0" y2="1">${night
      ? '<stop offset="0" stop-color="#0b1033"/><stop offset="1" stop-color="#3b2a6b"/>'
      : '<stop offset="0" stop-color="#8ecbff"/><stop offset="1" stop-color="#e7f5ff"/>'}</linearGradient>`;

    out.push('<rect width="360" height="200" fill="url(#tw-sky)"/>');
    if (night) {
      const r = rng(7);
      out.push(Array.from({ length: 45 }, () => `<circle cx="${f(r() * 360)}" cy="${f(r() * 110)}" r="${f(0.4 + r())}" fill="#fff" opacity="${f(0.3 + r() * 0.7)}"/>`).join(''));
      out.push('<circle cx="310" cy="34" r="14" fill="#fff9db"/><circle cx="316" cy="30" r="12" fill="#0b1033"/>');
    } else {
      out.push('<circle cx="306" cy="36" r="16" fill="#ffd43b"/>');
      out.push('<g class="tw-cloud"><ellipse cx="60" cy="38" rx="22" ry="8" fill="#fff"/><ellipse cx="74" cy="32" rx="14" ry="8" fill="#fff"/></g>');
      out.push('<g class="tw-cloud" style="animation-duration:90s;animation-delay:-40s"><ellipse cx="200" cy="56" rx="18" ry="6" fill="#fff"/><ellipse cx="210" cy="51" rx="11" ry="6" fill="#fff"/></g>');
    }
    // hills
    out.push(`<path d="M0 150 Q60 112 130 140 T260 132 T360 128 V200 H0z" fill="${night ? '#1e2b3a' : '#b2f2bb'}"/>`);

    // a far-away skyline once the town is a metropolis
    if (s >= 10) {
      const r = rng(99);
      let x = 0, sky = '';
      while (x < 360) {
        const w = 10 + r() * 14, h = 40 + r() * (s >= 11 ? 80 : 55);
        sky += `<rect x="${f(x)}" y="${f(150 - h)}" width="${f(w)}" height="${f(h)}" fill="#2a2350"/>`;
        x += w + 1;
      }
      out.push(sky);
    }
    // searchlights
    if (s >= 11) {
      out.push('<g class="tw-beam" style="transform-origin:90px 160px"><path d="M90 160 L70 0 H110z" fill="#fff3bf" opacity=".18"/></g>');
      out.push('<g class="tw-beam" style="transform-origin:270px 160px;animation-delay:-3s"><path d="M270 160 L250 0 H290z" fill="#fff3bf" opacity=".18"/></g>');
    }
    // fireworks for the world capital
    if (s >= 12) {
      [[70, 50, '#ff6b6b', 0], [180, 34, '#ffd43b', 0.8], [270, 60, '#69db7c', 1.6], [130, 70, '#74c0fc', 2.2]].forEach(([x, y, c, d]) => {
        out.push(`<g class="tw-firework" style="animation-delay:${d}s;transform-origin:${x}px ${y}px">` +
          Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return `<line x1="${f(x + 4 * Math.cos(a))}" y1="${f(y + 4 * Math.sin(a))}" x2="${f(x + 18 * Math.cos(a))}" y2="${f(y + 18 * Math.sin(a))}" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
          }).join('') + '</g>');
      });
    }

    // landmark tower from City up
    if (s >= 9) {
      const h = 100 + (s - 9) * 18;
      const top = 160 - h;
      const bars = Array.from({ length: 6 }, (_, i) => {
        const y = top + 16 + i * (h - 16) / 6, half = 2 + (y - top) * 0.11;
        return `<line x1="${f(180 - half)}" y1="${f(y)}" x2="${f(180 + half)}" y2="${f(y)}" stroke="#fff" stroke-width="2"/>`;
      }).join('');
      out.push(`<path d="M180 ${top} L${f(180 - h * 0.12)} 160 H${f(180 + h * 0.12)}z" fill="${night ? '#ff8787' : '#e03131'}"/>${bars}<circle cx="180" cy="${top}" r="2.5" fill="#ffe066" class="tw-blink"/>`);
    }

    const n = pop <= 0 ? 0 : Math.max(1, Math.min(28, Math.round(Math.sqrt(pop) * 1.3)));
    // back row (taller), then front row
    const back = [], front = [];
    for (let k = 0; k < n; k++) {
      const isBack = k >= 14;
      const slot = ORDER[k % 14];
      const r = rng(1000 + k * 31 + (isBack ? 7 : 0));
      const kind = kindFor(s, r, isBack);
      const y = isBack ? 150 : 162;
      (isBack ? back : front).push(draw[kind](slotX(slot, isBack), y, r, night, s));
    }
    out.push(back.join(''));

    // ground and road
    out.push(`<rect y="160" width="360" height="40" fill="${night ? '#2b3a2b' : '#8ce99a'}"/>`);
    if (s >= 4) out.push(`<rect y="174" width="360" height="12" fill="${night ? '#343a40' : '#868e96'}"/><line x1="0" y1="180" x2="360" y2="180" stroke="#f8f9fa" stroke-width="1.2" stroke-dasharray="8 7"/>`);

    // trees between houses while the town is still green
    if (s >= 2 && s <= 9) {
      const r = rng(55);
      const trees = Math.min(8, s + 1);
      for (let i = 0; i < trees; i++) {
        const x = 30 + ((i * 97) % 300) + r() * 10;
        out.push(`<rect x="${f(x - 1.5)}" y="154" width="3" height="8" fill="#8d6e63"/><circle cx="${f(x)}" cy="151" r="6" fill="${pick(r, ['#2f9e44', '#37b24d', '#40c057'])}"/>`);
      }
    }
    if (s === 1) out.push('<g class="tw-fire"><path d="M150 162 q4 -10 8 0z" fill="#ff922b"/><path d="M152 162 q2 -6 4 0z" fill="#ffe066"/></g>');
    out.push(front.join(''));

    // cars from Town up
    if (s >= 6) {
      const cars = Math.min(5, s - 5);
      for (let i = 0; i < cars; i++) {
        const c = ['#e03131', '#1c7ed6', '#f08c00', '#2f9e44', '#f8f9fa'][i];
        out.push(`<g class="${i % 2 ? 'tw-drive-rev' : 'tw-drive'}" style="animation-duration:${6 + i * 1.7}s;animation-delay:-${i * 2.3}s"><rect x="0" y="${i % 2 ? 175 : 180}" width="14" height="5" rx="2" fill="${c}"/><rect x="3" y="${i % 2 ? 172.5 : 177.5}" width="8" height="3" rx="1" fill="${c}"/>${night ? `<circle cx="14" cy="${i % 2 ? 177 : 182}" r="1.5" fill="#fff3bf"/>` : ''}</g>`);
      }
    }

    // residents walking about
    const walkers = Math.min(pop, 12);
    for (let i = 0; i < walkers; i++) {
      const c = ['#f03e3e', '#1c7ed6', '#f59f00', '#7048e8', '#0ca678', '#e64980'][i % 6];
      const y = s >= 4 ? (i % 2 ? 190 : 194) : 170 + (i % 3) * 6;
      out.push(`<g class="${i % 2 ? 'tw-walk-rev' : 'tw-walk'}" style="animation-duration:${18 + (i * 7) % 15}s;animation-delay:-${(i * 5.3) % 20}s"><circle cx="0" cy="${y - 7}" r="2.2" fill="#ffd8a8"/><rect x="-2" y="${y - 5}" width="4" height="5" rx="1.5" fill="${c}"/></g>`);
    }

    return `<svg viewBox="0 0 360 200" role="img" aria-hidden="true"><defs>${defs}</defs>${out.join('')}</svg>`;
  }

  window.Town = { STAGES, stageOf, svg };
})();
