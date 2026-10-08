// Image d'aperçu (1200×630) d'une Bucket List partagée : prénom, compteurs, quelques expériences, rosace.
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

function rosaceSvg(items, size) {
  const N = items.length, c = size / 2, step = Math.PI * 2 / Math.max(N, 12);
  const a0 = N < 12 ? -Math.PI / 2 - step * N / 2 : -Math.PI / 2;
  const w = Math.max(3, Math.min(16, (2 * Math.PI * size * .3 / Math.max(N, 12)) * .55));
  const r0 = size * .2, r1 = size * .48;
  const rays = items.map((it, k) => {
    const a = a0 + (k + .5) * step, col = PAL[it.cat] || INK;
    const x1 = c + Math.cos(a) * r0, y1 = c + Math.sin(a) * r0, x2 = c + Math.cos(a) * r1, y2 = c + Math.sin(a) * r1;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${w.toFixed(1)}" stroke-linecap="round"${it.s === 'todo' ? ' opacity=".55"' : ''}/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rays}<circle cx="${c}" cy="${c}" r="${r0 * .82}" fill="${INK}"/></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
const LOGO = (() => {
  const C = ['#57E36A', '#FFEE2E', '#FF5A5F', '#FF9F2E', '#3FE0D0', '#FF66B8', '#55B8FF', '#C29BFF'];
  const rays = C.map((c, i) => { const a = -Math.PI / 2 + i * Math.PI / 4; return `<line x1="${60 + Math.cos(a) * 26}" y1="${60 + Math.sin(a) * 26}" x2="${60 + Math.cos(a) * 50}" y2="${60 + Math.sin(a) * 50}" stroke="${c}" stroke-width="15" stroke-linecap="round"/>`; }).join('');
  return 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">${rays}<circle cx="60" cy="60" r="20" fill="${INK}"/></svg>`).toString('base64');
})();

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
    h('div', { display: 'flex', flexDirection: 'column', width: 690 },
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
    // rosace
    h('div', { position: 'absolute', right: 50, top: 75, width: 480, height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center' },
      h('img', { width: 480, height: 480 }),
      h('div', { position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', color: PAPER },
        h('div', { fontFamily: 'Serif', fontSize: 58, lineHeight: 1 }, String(d.length)),
        h('div', { fontFamily: 'Sans', fontWeight: 800, fontSize: 12, letterSpacing: 2 }, fr ? 'VÉCUES' : 'LIVED'))));
}
// branche les src des images (le constructeur h ne gère que les styles)
function withImages(tree, p) {
  const { items } = itemsOf(p);
  const imgs = [];
  (function walk(n) { if (!n || typeof n !== 'object') return; if (n.type === 'img') imgs.push(n); (n.props.children || []).forEach(walk); })(tree);
  imgs[0].props = { ...imgs[0].props, src: LOGO, width: 40, height: 40 };
  imgs[1].props = { ...imgs[1].props, src: rosaceSvg(items.length ? items : [{ cat: 'voyages', s: 'todo' }], 480), width: 480, height: 480 };
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
