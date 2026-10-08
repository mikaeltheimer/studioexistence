// Outils partagés par les fonctions d'aperçu de la Bucket List (non exposé comme route : préfixe « _ »)
import { readFileSync } from 'fs';
import { join } from 'path';

export const PAL = { nature:'#57E36A', voyages:'#FFEE2E', corps:'#FF5A5F', sensations:'#FF9F2E', accomplissements:'#3FE0D0', relations:'#FF66B8', culture:'#55B8FF', mystere:'#C29BFF' };

let _html = null, _data = null;
export function appHtml() {
  if (!_html) _html = readFileSync(join(process.cwd(), 'bucket-list', 'index.html'), 'utf8');
  return _html;
}
// La liste d'expériences vit dans index.html (const DATA = [...];) : on la relit ici
export function experiences() {
  if (!_data) {
    const m = appHtml().match(/const DATA = (\[[\s\S]*?\]);\s*\n/);
    _data = m ? JSON.parse(m[1]) : [];
  }
  return _data;
}

export function decode(str) {
  try {
    let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const p = JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
    return p && typeof p === 'object' ? p : null;
  } catch (e) { return null; }
}

// Liste ordonnée par catégorie : [{label, cat, s:'done'|'todo'}]
export function itemsOf(p) {
  const lang = p.l === 'en' ? 'en' : 'fr';
  const done = new Set(Array.isArray(p.d) ? p.d : []), todo = new Set(Array.isArray(p.t) ? p.t : []);
  const custom = Array.isArray(p.c) ? p.c.slice(0, 60) : [];
  const out = [];
  experiences().forEach(c => {
    c.items.forEach(i => {
      if (done.has(i.id)) out.push({ label: i[lang] || i.fr, cat: c.id, s: 'done' });
      else if (todo.has(i.id)) out.push({ label: i[lang] || i.fr, cat: c.id, s: 'todo' });
    });
    custom.filter(x => Array.isArray(x) && x[1] === c.id).forEach(x => out.push({ label: String(x[0]).slice(0, 120), cat: c.id, s: x[2] ? 'done' : 'todo' }));
  });
  return { items: out, lang, name: String(p.n || '').slice(0, 40).trim() };
}

export const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
