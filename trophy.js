// The trophy grows with the number of names this device proposed first.
// Each tier keeps everything from the tiers below it and adds one more flourish.
(() => {
  const TIERS = [0, 1, 3, 5, 10, 20, 35, 50, 100];

  // [light, dark] cup colours per tier
  const METAL = [
    ['#d6d3cc', '#a8a49b'], // 0 empty
    ['#e8a46a', '#8a4b1c'], // 1 bronze
    ['#f3f4f6', '#8b929c'], // 2 silver
    ['#fde68a', '#c27a06'], // 3 gold
    ['#fde68a', '#c27a06'], // 4 jeweled gold
    ['#f8fafc', '#7f93ad'], // 5 platinum
    ['#cffafe', '#0e8fb0'], // 6 crystal
    ['#fff3b0', '#d4a017'], // 7 royal gold
    ['rainbow', ''],        // 8 legendary
  ];

  function tierOf(wins) {
    let t = 0;
    TIERS.forEach((min, i) => { if (wins >= min) t = i; });
    return t;
  }

  function svg(t) {
    const [light, dark] = METAL[t];
    const fill = light === 'rainbow' ? `url(#tr-rainbow-${t})` : `url(#tr-metal-${t})`;
    const parts = [];
    const defs = `
      <linearGradient id="tr-metal-${t}" x1="0" x2="1">
        <stop offset="0" stop-color="${dark}"/><stop offset=".45" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/>
      </linearGradient>
      <linearGradient id="tr-rainbow-${t}" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#ff6b6b"/><stop offset=".25" stop-color="#ffd43b"/><stop offset=".5" stop-color="#69db7c"/>
        <stop offset=".75" stop-color="#4dabf7"/><stop offset="1" stop-color="#b197fc"/>
      </linearGradient>
      <radialGradient id="tr-glow-${t}"><stop offset="0" stop-color="#ffe066" stop-opacity=".9"/><stop offset="1" stop-color="#ffe066" stop-opacity="0"/></radialGradient>`;

    if (t === 0) {
      return `<svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <path d="M60 40h80v30a40 40 0 0 1-80 0z" fill="none" stroke="#a8a49b" stroke-width="4" stroke-dasharray="8 7"/>
        <rect x="70" y="150" width="60" height="16" rx="3" fill="none" stroke="#a8a49b" stroke-width="4" stroke-dasharray="8 7"/>
        <text x="100" y="82" text-anchor="middle" font-size="40" font-weight="700" fill="#a8a49b">?</text></svg>`;
    }

    if (t >= 6) parts.push('<circle cx="100" cy="85" r="95" fill="url(#tr-glow-${t})"/>');
    if (t >= 8) {
      parts.push('<g class="tr-rays">' + Array.from({ length: 12 }, (_, i) =>
        `<path d="M100 85 L${100 + 98 * Math.cos(i * Math.PI / 6 - .08)} ${85 + 98 * Math.sin(i * Math.PI / 6 - .08)} L${100 + 98 * Math.cos(i * Math.PI / 6 + .08)} ${85 + 98 * Math.sin(i * Math.PI / 6 + .08)}z" fill="#ffe066" opacity=".35"/>`).join('') + '</g>');
    }
    // wings
    if (t >= 6) {
      const wing = 'M58 70 C30 50 12 62 8 40 C24 48 30 36 44 44 C34 30 40 22 30 12 C52 22 58 40 62 58z';
      parts.push(`<path d="${wing}" fill="#fff" stroke="#c9d6e3" stroke-width="2"/>`);
      parts.push(`<path d="${wing}" transform="translate(200 0) scale(-1 1)" fill="#fff" stroke="#c9d6e3" stroke-width="2"/>`);
    }
    // laurel
    if (t >= 5) {
      const leaves = Array.from({ length: 6 }, (_, i) => {
        const a = (200 - i * 22) * Math.PI / 180, x = 100 + 72 * Math.cos(a), y = 92 - 72 * Math.sin(a) * -1;
        return `<ellipse cx="${x}" cy="${y}" rx="9" ry="4.5" transform="rotate(${(200 - i * 22) + 90 + 30} ${x} ${y})" fill="#4c9a4c"/>`;
      }).join('');
      parts.push(`<g>${leaves}</g><g transform="translate(200 0) scale(-1 1)">${leaves}</g>`);
    }
    // base and stem
    parts.push(`<rect x="62" y="152" width="76" height="22" rx="4" fill="${t >= 7 ? '#3b2a1a' : '#5b4636'}"/>`);
    parts.push(`<rect x="72" y="144" width="56" height="12" rx="3" fill="${fill}"/>`);
    parts.push(`<path d="M92 112h16l4 32h-24z" fill="${fill}"/>`);
    if (t >= 7) parts.push('<rect x="84" y="158" width="32" height="10" rx="2" fill="#fde68a"/>');
    // handles
    if (t >= 2) {
      parts.push(`<path d="M56 46 C28 46 28 92 66 96" fill="none" stroke="${fill}" stroke-width="9" stroke-linecap="round"/>`);
      parts.push(`<path d="M144 46 C172 46 172 92 134 96" fill="none" stroke="${fill}" stroke-width="9" stroke-linecap="round"/>`);
    }
    // cup
    parts.push(`<path d="M52 36h96v34a48 48 0 0 1-96 0z" fill="${fill}" stroke="rgba(0,0,0,.18)" stroke-width="2"/>`);
    parts.push('<path d="M64 44h10v26a34 34 0 0 0 8 22" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>');
    // star emblem
    if (t >= 3) parts.push('<path d="M100 52l6 12 13 2-9.5 9 2.3 13L100 82l-11.8 6 2.3-13-9.5-9 13-2z" fill="#fff" fill-opacity=".85"/>');
    // gems
    if (t >= 4) {
      parts.push('<circle cx="70" cy="40" r="5" fill="#e03131" stroke="#fff" stroke-width="1.5"/><circle cx="130" cy="40" r="5" fill="#1971c2" stroke="#fff" stroke-width="1.5"/><circle cx="100" cy="40" r="6" fill="#2f9e44" stroke="#fff" stroke-width="1.5"/>');
    }
    // crown
    if (t >= 7) {
      parts.push('<path d="M72 34 L76 10 L88 24 L100 4 L112 24 L124 10 L128 34z" fill="#ffd43b" stroke="#b45309" stroke-width="2.5" stroke-linejoin="round"/>');
      parts.push('<circle cx="100" cy="22" r="4" fill="#e03131"/><circle cx="84" cy="27" r="3" fill="#1971c2"/><circle cx="116" cy="27" r="3" fill="#1971c2"/>');
    }
    // sparkles
    if (t >= 8) {
      const sp = (x, y, s, d) => `<path class="tr-spark" style="animation-delay:${d}s" d="M${x} ${y - s}L${x + s / 4} ${y - s / 4}L${x + s} ${y}L${x + s / 4} ${y + s / 4}L${x} ${y + s}L${x - s / 4} ${y + s / 4}L${x - s} ${y}L${x - s / 4} ${y - s / 4}z" fill="#fff"/>`;
      parts.push(sp(40, 120, 10, 0) + sp(165, 115, 8, .5) + sp(150, 20, 9, 1) + sp(30, 30, 7, 1.4));
    }
    // Higher tiers are also physically bigger.
    const scale = (0.7 + t * 0.0375).toFixed(3);
    return `<svg viewBox="0 0 200 200" role="img" aria-hidden="true"><defs>${defs}</defs><g transform="translate(100 176) scale(${scale}) translate(-100 -176)">${parts.join('')}</g></svg>`;
  }

  window.Trophy = { TIERS, tierOf, svg };
})();
