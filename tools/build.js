// Builds _site/ for GitHub Pages: copies the site files and writes one page per language
// (/es/, /ja/, ...) with translated title, description and text, so search engines in
// each language can find the game. English stays at the root.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_site');
const SITE = 'https://nameit.kdking-tools.com/';
const FILES = ['index.html', 'about.html', 'privacy.html', 'app.js', 'i18n.js', 'town.js', 'config.js',
  'style.css', 'icon.png', 'og.png', 'robots.txt', 'CNAME', 'ads.txt'];
const version = (process.env.GITHUB_SHA || 'dev').slice(0, 8);

global.window = {};
require(path.join(ROOT, 'i18n.js'));
const I18N = window.I18N;
const langs = Object.keys(I18N);
const pageUrl = (l) => SITE + (l === 'en' ? '' : l + '/');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const t = (l, key) => I18N[l][key] ?? I18N.en[key];

const alternates = [...langs.map((l) => `  <link rel="alternate" hreflang="${l}" href="${pageUrl(l)}">`),
  `  <link rel="alternate" hreflang="x-default" href="${SITE}">`].join('\n');

function page(src, l) {
  const prefix = l === 'en' ? '' : '../';
  const title = `Name It First · ${t(l, 'title')}`;
  const desc = t(l, 'tagline');
  let html = src
    .replace('<html lang="en">', `<html lang="${l}"${I18N[l].dir ? ` dir="${I18N[l].dir}"` : ''}>`)
    .replace(/<title>.*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(t(l, 'title'))}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${pageUrl(l)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${pageUrl(l)}`)
    .replace(/(\s*<link rel="icon")/, `\n${alternates}$1`)
    // Fill the visible text in this language so it is readable without running the script.
    .replace(/(<(\w+)\b[^>]*\bdata-i18n="(\w+)"[^>]*>)[^<]*(<\/\2>)/g, (_, open, tag, key, close) => open + esc(t(l, key)) + close)
    .replace(/(data-i18n-placeholder="(\w+)" placeholder=")[^"]*/g, (_, a, key) => a + esc(t(l, key)))
    // Local files: language pages live one folder down; ?v= makes browsers fetch fresh files after each deploy.
    .replace(/(href|src)="(style\.css|config\.js|i18n\.js|town\.js|app\.js)"/g, `$1="${prefix}$2?v=${version}"`)
    .replace(/(href)="(icon\.png|about\.html|privacy\.html)"/g, `$1="${prefix}$2"`);
  return html;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const f of FILES) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const l of langs) {
  const dir = l === 'en' ? OUT : path.join(OUT, l);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(index, l));
}

const links = langs.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l)}"/>`).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${langs.map((l) => `  <url>\n    <loc>${pageUrl(l)}</loc>\n${links}\n  </url>`).join('\n')}
  <url><loc>${SITE}about.html</loc></url>
  <url><loc>${SITE}privacy.html</loc></url>
</urlset>
`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
console.log(`Built ${langs.length} language pages into _site/`);
