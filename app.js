(() => {
  const cfg = window.NAMEIT_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };

  // ?lang= > saved choice > browser language > English
  function pickLang() {
    const wanted = [new URLSearchParams(location.search).get('lang'), store.get('lang'), ...(navigator.languages || [navigator.language])];
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
    loadStats();
  }

  const select = $('lang');
  for (const [code, { label }] of Object.entries(I18N)) select.add(new Option(label, code));
  select.value = lang;
  select.onchange = () => { lang = select.value; store.set('lang', lang); applyLang(); };

  // Each browser gets a Supabase guest account; its id is what makes "one count per device".
  const sb = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

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

  async function loadStats() {
    if (!sb) return;
    const { data } = await sb.rpc('nc_stats');
    if (data) $('stats').textContent = t('stats', { names: fmt(data.names), proposals: fmt(data.proposals) });
  }

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
      render(data);
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
})();
