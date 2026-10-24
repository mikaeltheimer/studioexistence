// Image d'aperçu (1200×630) d'une Bucket List partagée : prénom, compteurs, quelques expériences, et l'affiche Manifeste en miniature.
import { ImageResponse } from '@vercel/og';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PAL, decode, itemsOf, deN } from './_bucket.js';

export const config = { runtime: 'nodejs' };

const INK = '#1C1A2B', PAPER = '#FBF4E6', CARD = '#FFFDF8', YEL = '#FFEE2E';
const font = f => readFileSync(join(process.cwd(), 'bucket-list', 'fonts', f));
let FONTS = null;
function fonts() {
  if (!FONTS) FONTS = [
    { name: 'Serif', data: font('dm-serif-display-400.woff'), weight: 400, style: 'normal' },
    { name: 'Serif', data: font('dm-serif-display-400-italic.woff'), weight: 400, style: 'italic' },
    { name: 'Sans', data: font('plus-jakarta-sans-600.woff'), weight: 600, style: 'normal' },
    { name: 'Sans', data: font('plus-jakarta-sans-800.woff'), weight: 800, style: 'normal' },
  ];
  return FONTS;
}
// petit constructeur d'éléments (sans React)
const h = (type, style, ...children) => ({ type, props: { style: type === 'div' && !style.display ? { display: 'flex', ...style } : style, children: children.flat().filter(c => c !== null && c !== undefined && c !== false) } });
function mix(hex, p) { const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), b = [251, 244, 230]; return `rgb(${a.map((v, i) => Math.round(v * p + b[i] * (1 - p))).join(',')})`; }
const hl = c => c === YEL ? c : mix(c, .62);
const cut = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;

const LOGO = (() => {
  const C = ['#57E36A', '#FFEE2E', '#FF5A5F', '#FF9F2E', '#3FE0D0', '#FF66B8', '#55B8FF', '#C29BFF'];
  const rays = C.map((c, i) => { const a = -Math.PI / 2 + i * Math.PI / 4; return `<line x1="${60 + Math.cos(a) * 26}" y1="${60 + Math.sin(a) * 26}" x2="${60 + Math.cos(a) * 50}" y2="${60 + Math.sin(a) * 50}" stroke="${c}" stroke-width="15" stroke-linecap="round"/>`; }).join('');
  return 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">${rays}<circle cx="60" cy="60" r="20" fill="${INK}"/></svg>`).toString('base64');
})();

const lineCol = c => c === YEL ? '#E0C400' : c;
function manifeste(items, fr, name) {
  const SW = 350, SH = Math.round(350 * Math.SQRT2), PAD = 26, BODY_H = SH - 2 * PAD - 70;
  // taille de texte : la liste remplit la feuille, comme sur la vraie affiche (au-delà de la place disponible en 7 px, on tronque)
  const area = (SW - 2 * PAD) * BODY_H * .8, cost = it => Math.min(it.label.length, 40) + 3;
  const cap = area / (.5 * 1.62 * 49);
  let list = [], used = 0; for (const it of items) { if (used + cost(it) > cap) break; list.push(it); used += cost(it); }
  const fs = Math.max(7, Math.min(24, Math.sqrt(area / ((used || 1) * .5 * 1.62))));
  const words = list.map(it => h('div', it.s === 'done'
    ? { fontFamily: 'Serif', fontSize: fs, lineHeight: 1.3, background: hl(PAL[it.cat] || INK), padding: `0 ${fs * .18}px`, marginRight: fs * .35, marginBottom: fs * .28 }
    : { fontFamily: 'Serif', fontSize: fs, lineHeight: 1.3, padding: `0 ${fs * .18}px`, marginRight: fs * .35, marginBottom: fs * .28, borderBottom: `${Math.max(1.5, fs * .09)}px dashed ${lineCol(PAL[it.cat] || INK)}` },
    cut(it.label, 40)));
  const tTop = fr ? 'La Bucket List' : (name ? `${name}'s` : 'A');
  const tHl = fr ? (name ? deN(name) : '') : 'Bucket List';
  return h('div', { position: 'absolute', right: 70, top: 34, width: SW + 24, height: SH + 24, padding: 12, background: INK, transform: 'rotate(3deg)', boxShadow: `16px 18px 0 ${YEL}` },
    h('div', { width: SW, height: SH, background: PAPER, display: 'flex', flexDirection: 'column', padding: PAD },
      h('div', { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', fontFamily: 'Serif', fontSize: 22, marginBottom: 18 },
        h('div', { marginRight: 6 }, cut(tTop, 20)), tHl ? h('div', { fontStyle: 'italic', background: YEL, padding: '0 5px' }, cut(tHl, 18)) : null),
      h('div', { display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', height: BODY_H }, words),
      h('div', { display: 'flex', justifyContent: 'center', marginTop: 'auto', fontFamily: 'Sans', fontWeight: 800, fontSize: 7, letterSpacing: 1.5, opacity: .45 }, 'STUDIOEXISTENCE.COM/BUCKET-LIST')));
}

export function render(p) {
  const { items, lang, name } = itemsOf(p);
  const fr = lang === 'fr';
  const d = items.filter(i => i.s === 'done'), t = items.filter(i => i.s === 'todo');

  const pill = (dot, n, word) => h('div', { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 999, border: `2.5px solid ${INK}`, background: CARD },
    h('div', { width: 16, height: 16, borderRadius: 999, background: dot, border: `2px solid ${INK}` }),
    h('div', { fontFamily: 'Serif', fontSize: 38, lineHeight: 1 }, String(n)),
    h('div', { fontFamily: 'Sans', fontWeight: 800, fontSize: 20 }, word));
  const titleTop = fr ? 'La Bucket List' : (name ? `${name}'s` : 'A');
  const titleHl = fr ? (name ? deN(name) : '') : 'Bucket List';
  const max = titleHl ? 4 : 5;
  const pick = d.slice(0, max - 1).concat(t.slice(0, Math.max(1, max - Math.min(max - 1, d.length)))).slice(0, max);
  return h('div', { width: 1200, height: 630, display: 'flex', background: PAPER, color: INK, padding: '50px 60px', position: 'relative', fontFamily: 'Sans' },
    // colonne gauche
    h('div', { display: 'flex', flexDirection: 'column', width: 660 },
      h('div', { display: 'flex', alignItems: 'center', gap: 12 },
        h('img', { width: 40, height: 40 }), // remplacé plus bas (props src)
        h('div', { fontFamily: 'Serif', fontSize: 30, display: 'flex' }, 'Bucket', h('div', { fontStyle: 'italic', marginLeft: 8, padding: '0 6px', background: YEL }, 'List'))),
      h('div', { display: 'flex', flexDirection: 'column', marginTop: 26, fontFamily: 'Serif', fontSize: 66, lineHeight: 1.02 },
        h('div', {}, titleTop),
        titleHl ? h('div', { display: 'flex' }, h('div', { fontStyle: 'italic', background: YEL, padding: '0 10px', marginLeft: -10 }, cut(titleHl, 22))) : null),
      h('div', { display: 'flex', gap: 12, marginTop: 24 }, pill(INK, d.length, fr ? (d.length > 1 ? 'vécues' : 'vécue') : 'lived'), pill(CARD, t.length, fr ? 'à vivre' : 'to live')),
      h('div', { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 },
        pick.map(it => h('div', { display: 'flex' },
          h('div', it.s === 'done'
            ? { fontFamily: 'Serif', fontSize: 27, background: hl(PAL[it.cat]), padding: '1px 8px' }
            : { fontFamily: 'Serif', fontSize: 27, padding: '1px 8px', borderBottom: `3px dashed ${PAL[it.cat] === YEL ? '#E0C400' : PAL[it.cat]}` }, cut(it.label, 46))))),
      h('div', { display: 'flex', marginTop: 'auto', fontFamily: 'Sans', fontWeight: 800, fontSize: 17, letterSpacing: 3, opacity: .6 },
        (fr ? 'ET TOI ? · ' : 'YOUR TURN · ') + 'STUDIOEXISTENCE.COM/BUCKET-LIST')),
    // affiche Manifeste en miniature (même logique que l'app : surligné = vécu, souligné = à vivre)
    manifeste(items, fr, name));
}
// branche les src des images (le constructeur h ne gère que les styles)
function withImages(tree, p) {
  const imgs = [];
  (function walk(n) { if (!n || typeof n !== 'object') return; if (n.type === 'img') imgs.push(n); (n.props.children || []).forEach(walk); })(tree);
  imgs[0].props = { ...imgs[0].props, src: LOGO, width: 40, height: 40 };
  return tree;
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const p = decode(url.searchParams.get('l')) || {};
  const img = new ImageResponse(withImages(render(p), p), { width: 1200, height: 630, fonts: fonts() });
  const buf = Buffer.from(await img.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
  res.status(200).send(buf);
}
