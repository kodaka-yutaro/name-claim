(() => {
  const cfg = window.NAMEIT_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };

  // Language page (/ja/) > ?lang= > saved choice > browser language > English
  const pathLang = (location.pathname.match(/^\/([a-z]{2})\//) || [])[1];
  function pickLang() {
    const wanted = [pathLang, new URLSearchParams(location.search).get('lang'), store.get('lang'), ...(navigator.languages || [navigator.language])];
    for (const l of wanted) {
      const code = (l || '').toLowerCase().split('-')[0];
      if (I18N[code]) return code;
    }
    return 'en';
  }

  let lang = pickLang();
  let last = null;
  const t = (key, vars = {}) =>
    (I18N[lang][key] ?? I18N.en[key]).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const fmt = (n) => new Intl.NumberFormat(lang).format(n);

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = I18N[lang].dir || 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
    if (last) render(last);
    renderTown(false);
    loadStats();
  }

  const select = $('lang');
  for (const [code, { label }] of Object.entries(I18N)) select.add(new Option(label, code));
  select.value = lang;
  select.onchange = () => {
    store.set('lang', select.value);
    // Move to that language's own page, so the address can be shared in that language.
    location.href = (pathLang ? '../' : './') + (select.value === 'en' ? '' : select.value + '/');
  };

  // Each browser gets a Supabase guest account; its id is what makes "one count per device".
  const sb = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

  const help = $('help');
  $('help-open').onclick = () => { loadStats(); help.showModal(); };
  help.onclick = (e) => { if (e.target === help) help.close(); };

  async function ensureSession() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) return;
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw error;
  }

  function render(data) {
    last = data;
    const box = $('result');
    box.hidden = false;
    $('result-levelup').hidden = true;
    box.className = data.error ? 'error' : data.result === 'taken' ? 'fail' : 'win';
    if (data.error) {
      $('result-title').textContent = t('err_' + ({ empty: 'empty', too_long: 'too_long', rate_limited: 'rate' }[data.error] || 'server'));
      $('result-body').textContent = '';
    } else {
      $('result-title').textContent = t(data.result + '_title');
      $('result-body').textContent = t(data.result + '_body', { name: data.name, n: fmt(data.count) });
    }
    const note = data.result === 'taken' && data.repeat;
    $('result-note').hidden = !note;
    $('result-note').textContent = note ? t('repeat_note') : '';
  }

  // Town: every name this device proposed first is one resident. The server's count wins;
  // the cached copy only makes the first paint instant.
  let wins = Number(store.get('wins')) || 0;

  function renderTown(animate) {
    const stage = Town.stageOf(wins);
    const next = Town.STAGES[stage + 1];
    const prev = Town.STAGES[stage];
    const names = I18N[lang].stages || I18N.en.stages;
    $('town-art').innerHTML = Town.svg(wins);
    $('town').className = 'town' + (animate ? ' grow-anim' : '');
    $('town-name').textContent = `Lv.${stage} ${names[stage]}`;
    $('town-pop').textContent = t('wins', { n: fmt(wins) });
    $('town-bar').style.width = next ? ((wins - prev) / (next - prev)) * 100 + '%' : '100%';
    $('town-next').textContent = next ? t('next', { left: fmt(next - wins) }) : t('top');
  }

  function setWins(n) {
    if (typeof n !== 'number' || n === wins) return false;
    const grew = Town.stageOf(n) > Town.stageOf(wins);
    wins = n;
    store.set('wins', String(n));
    renderTown(grew);
    return grew;
  }

  // Residents: the names this device claimed first. The server list wins; the local copy
  // covers databases that don't have nc_my_names yet.
  const localResidents = () => { try { return JSON.parse(store.get('residents')) || []; } catch { return []; } };
  function addResident(name) {
    const list = localResidents().filter((r) => r.name !== name);
    list.unshift({ name, count: 1 });
    store.set('residents', JSON.stringify(list.slice(0, 1000)));
  }

  async function openResidents() {
    let list = localResidents();
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const { data, error } = await sb.rpc('nc_my_names');
        if (!error && Array.isArray(data)) list = data;
      }
    }
    const ol = $('residents-list');
    ol.replaceChildren(...list.map((r) => {
      const li = document.createElement('li');
      const a = document.createElement('span'), b = document.createElement('span');
      a.textContent = r.name;
      b.textContent = t('times', { n: fmt(r.count) });
      li.append(a, b);
      return li;
    }));
    $('residents-count').textContent = fmt(Math.max(wins, list.length));
    $('residents-empty').hidden = list.length > 0;
    $('residents').showModal();
  }
  $('residents-open').onclick = openResidents;

  // Share card: the town plus its name and population, drawn on a 1200×630 canvas.
  function townImage() {
    const src = Town.svg(wins).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="756" height="630" ');
    return new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = fail;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    });
  }

  function fitText(ctx, text, max, size, weight) {
    do ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans JP", sans-serif`;
    while (ctx.measureText(text).width > max && --size > 12);
  }

  async function shareCard() {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 630;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 1200, 630);
    g.addColorStop(0, '#1b2a6b'); g.addColorStop(1, '#0b6e5a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1200, 630);
    ctx.drawImage(await townImage(), 0, 0);
    const stage = Town.stageOf(wins);
    const names = I18N[lang].stages || I18N.en.stages;
    const x = 978, w = 400;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    fitText(ctx, 'Lv.' + stage, w, 34, 700);
    ctx.fillText('Lv.' + stage, x, 200);
    ctx.fillStyle = '#fff';
    fitText(ctx, names[stage], w, 56, 800);
    ctx.fillText(names[stage], x, 270);
    fitText(ctx, fmt(wins), w, 110, 900);
    ctx.fillText(fmt(wins), x, 390);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    const pop = t('wins', { n: fmt(wins) });
    fitText(ctx, pop, w, 30, 600);
    ctx.fillText(pop, x, 440);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    fitText(ctx, 'Name It First · nameit.kdking-tools.com', w, 24, 600);
    ctx.fillText('Name It First · nameit.kdking-tools.com', x, 580);
    return new Promise((ok) => c.toBlob(ok, 'image/png'));
  }

  const SITE = 'https://nameit.kdking-tools.com/' + (lang === 'en' ? '' : lang + '/');
  let shareFile = null;
  $('share-open').onclick = async () => {
    const names = I18N[lang].stages || I18N.en.stages;
    const text = t('share_text', { town: names[Town.stageOf(wins)], n: fmt(wins) });
    $('share-x').href = 'https://x.com/intent/tweet?' + new URLSearchParams({ text, url: SITE });
    $('share-img').removeAttribute('src');
    $('share').showModal();
    try {
      const blob = await shareCard();
      shareFile = new File([blob], 'my-town.png', { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      $('share-img').src = url;
      $('share-save').href = url;
      $('share-native').hidden = !(navigator.canShare && navigator.canShare({ files: [shareFile] }));
      $('share-native').onclick = () => navigator.share({ files: [shareFile], text: text + ' ' + SITE }).catch(() => {});
    } catch (err) { console.warn(err); }
  };
  for (const id of ['residents', 'share']) $(id).onclick = (e) => { if (e.target === $(id)) $(id).close(); };

  async function loadWins() {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return setWins(0);
    const { data, error } = await sb.rpc('nc_my_wins');
    if (!error) setWins(data);
  }

  // The worldwide total counts up to its new value instead of jumping.
  let worldShown = null;
  function showWorld(target) {
    const from = worldShown ?? Math.floor(target * 0.9);
    const start = performance.now(), dur = from === target ? 0 : 900;
    const step = (now) => {
      const p = dur ? Math.min(1, (now - start) / dur) : 1;
      $('world-num').textContent = fmt(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    worldShown = target;
    requestAnimationFrame(step);
  }

  async function loadStats() {
    if (!sb) return;
    const { data } = await sb.rpc('nc_stats');
    if (!data) return;
    $('stats').textContent = t('stats', { names: fmt(data.names), proposals: fmt(data.proposals) });
    $('world').hidden = false;
    showWorld(Number(data.names));
  }
  setInterval(() => { if (!document.hidden) loadStats(); }, 30000);

  $('form').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('name').value.trim();
    if (!name) return render({ error: 'empty' });
    if ([...name].length > 50) return render({ error: 'too_long' });
    if (!sb) return render({ error: 'server' });
    const btn = $('submit');
    btn.disabled = true;
    btn.textContent = t('checking');
    try {
      await ensureSession();
      const { data, error } = await sb.rpc('nc_propose', { p_name: name });
      if (error) throw error;
      // Older databases don't return wins yet; count successes locally until they do.
      if (data.result === 'success') addResident(data.name);
      const grew = setWins(data.wins ?? (data.result === 'success' ? wins + 1 : wins));
      render(data);
      const news = [data.result === 'success' && '🏠 ' + t('moved_in', { name: data.name }), grew && '🎉 ' + t('levelup')].filter(Boolean);
      $('result-levelup').hidden = !news.length;
      $('result-levelup').textContent = news.join('  ');
      if (!data.error) loadStats();
    } catch (err) {
      console.warn(err);
      render({ error: /rate/i.test(err?.message || '') ? 'rate_limited' : 'server' });
    } finally {
      btn.disabled = false;
      btn.textContent = t('submit');
    }
  };

  // Ads load only after config.js has the AdSense ids, so nothing shows before approval.
  if (cfg.adsenseClient) {
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(cfg.adsenseClient);
    document.head.appendChild(s);
    if (cfg.adsenseSlot) {
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      Object.assign(ins.dataset, { adClient: cfg.adsenseClient, adSlot: cfg.adsenseSlot, adFormat: 'auto', fullWidthResponsive: 'true' });
      $('ad').appendChild(ins);
      $('ad').hidden = false;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    }
  }

  applyLang();
  loadWins();
})();
