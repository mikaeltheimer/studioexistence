// Bons cadeaux Bucket List : un code promo Stripe à usage unique, d'une valeur égale au prix du format offert.
// Le bon n'expire jamais ; si les prix augmentent, la différence éventuelle est payée au moment de commander.
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ImageResponse } from '@vercel/og';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { FORMATS, CURRENCIES } from './_shop.js';

export const SITE = 'https://www.studioexistence.com';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sans 0/O ni 1/I/L : lisible à la main
// code déterministe dérivé de la session Stripe : un webhook rejoué retrouve le même bon
export function giftCode(sessionId) {
  const h = createHash('sha256').update('bl-gift:' + sessionId).digest();
  let s = ''; for (let i = 0; i < 8; i++) s += ALPHA[h[i] % ALPHA.length];
  return `BL-${s.slice(0, 4)}-${s.slice(4)}`;
}
export const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^BL/, '').slice(0, 8);
export const prettyCode = c => { const x = cleanCode(c); return x.length === 8 ? `BL-${x.slice(0, 4)}-${x.slice(4)}` : ''; };
export const giftUrl = code => `${SITE}/bucket-list/?cadeau=${encodeURIComponent(code)}`;
export const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

// Après paiement du bon : coupon (montant fixe dans la devise) + code promo à usage unique. Idempotent.
export async function createGift(stripe, session) {
  const m = session.metadata || {}, fmt = FORMATS[m.format], cur = CURRENCIES[m.cur] ? m.cur : 'cad';
  if (!fmt) throw new Error('gift format');
  const code = giftCode(session.id);
  const existing = await stripe.promotionCodes.list({ code, limit: 1 });
  if (existing.data[0]) return { code, promo: existing.data[0].id, created: false };
  const meta = { kind: 'gift', format: m.format, cur, lang: m.lang === 'en' ? 'en' : 'fr', from: clip(m.from, 40), to: clip(m.to, 40), msg: clip(m.msg, 240), session: session.id };
  const coupon = await stripe.coupons.create({ amount_off: fmt[CURRENCIES[cur].field], currency: cur, duration: 'once', max_redemptions: 1, name: `Bon cadeau Bucket List ${m.format.toUpperCase()}`, metadata: meta }, { idempotencyKey: `gift-coupon-${session.id}` });
  const promo = await stripe.promotionCodes.create({ promotion: { type: 'coupon', coupon: coupon.id }, code, max_redemptions: 1, metadata: meta }, { idempotencyKey: `gift-promo-${session.id}` });
  // le code est aussi rangé sur le paiement, pour que la page de remerciement le retrouve
  if (session.payment_intent) await stripe.paymentIntents.update(typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id, { metadata: { gift_code: code } }).catch(() => {});
  return { code, promo: promo.id, created: true };
}

// Bon valide ? Renvoie ses informations publiques (jamais d'adresse ni de courriel)
export async function lookupGift(stripe, rawCode) {
  const code = prettyCode(rawCode); if (!code) return { valid: false, reason: 'format' };
  const r = await stripe.promotionCodes.list({ code, limit: 1, expand: ['data.promotion.coupon'] });
  const p = r.data[0]; if (!p || p.metadata?.kind !== 'gift') return { valid: false, reason: 'unknown' };
  const c = p.promotion?.coupon; const m = p.metadata;
  if (!p.active || (p.max_redemptions && p.times_redeemed >= p.max_redemptions)) return { valid: false, reason: 'used', code };
  return { valid: true, code, id: p.id, format: m.format, cur: m.cur, lang: m.lang, from: m.from, to: m.to, msg: m.msg, amount: c && typeof c === 'object' ? c.amount_off : null };
}

/* ---------- Bon à imprimer (A5 paysage) ---------- */
const INK = '#1C1A2B', PAPER = '#FBF4E6', CARD = '#FFFDF8', YEL = '#FFEE2E', PINK = '#FF66B8';
const file = (...p) => readFileSync(join(process.cwd(), 'bucket-list', ...p));
let FONTS = null;
const fonts = () => FONTS || (FONTS = [
  { name: 'Serif', data: file('fonts', 'dm-serif-display-400.woff'), weight: 400, style: 'normal' },
  { name: 'Serif', data: file('fonts', 'dm-serif-display-400-italic.woff'), weight: 400, style: 'italic' },
  { name: 'Sans', data: file('fonts', 'plus-jakarta-sans-600.woff'), weight: 600, style: 'normal' },
  { name: 'Sans', data: file('fonts', 'plus-jakarta-sans-800.woff'), weight: 800, style: 'normal' },
]);
const h = (type, style, ...children) => ({ type, props: { style: type === 'div' && !style.display ? { display: 'flex', ...style } : style, children: children.flat().filter(c => c !== null && c !== undefined && c !== false && c !== '') } });
const img = (src, style) => ({ type: 'img', props: { src, style } });
const LOGO = (() => {
  const C = ['#57E36A', '#FFEE2E', '#FF5A5F', '#FF9F2E', '#3FE0D0', '#FF66B8', '#55B8FF', '#C29BFF'];
  const rays = C.map((c, i) => { const a = -Math.PI / 2 + i * Math.PI / 4; return `<line x1="${60 + Math.cos(a) * 26}" y1="${60 + Math.sin(a) * 26}" x2="${60 + Math.cos(a) * 50}" y2="${60 + Math.sin(a) * 50}" stroke="${c}" stroke-width="15" stroke-linecap="round"/>`; }).join('');
  return 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">${rays}<circle cx="60" cy="60" r="20" fill="${INK}"/></svg>`).toString('base64');
})();
const moneyTxt = (cents, lang, cur) => new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-US', { style: 'currency', currency: cur.toUpperCase(), minimumFractionDigits: 0 }).format(cents / 100);

export const W = 1754, H = 1240;   // A5 paysage à ~212 dpi
export async function cardTree(info) {
  const fr = info.lang !== 'en', L = fr ? 'fr' : 'en', fmt = FORMATS[info.format] || FORMATS.a3;
  const cur = CURRENCIES[info.cur] ? info.cur : 'cad', amount = info.amount ?? fmt[CURRENCIES[cur].field];
  const qr = 'data:image/svg+xml;base64,' + Buffer.from(await QRCode.toString(giftUrl(info.code), { type: 'svg', margin: 0, color: { dark: INK, light: '#00000000' } })).toString('base64');
  const poster = 'data:image/jpeg;base64,' + file(`cadeau-man-${L}.jpg`).toString('base64');
  const T = fr ? {
    top: 'Bon cadeau', title: info.to ? `Un cadeau pour toi, ${info.to}` : 'Un cadeau pour toi',
    what: `Ce bon t'offre ton affiche Bucket List ${info.format.toUpperCase()} (${fmt.fr.match(/\((.*)\)/)?.[1] || ''}), imprimée sur papier mat épais et livrée chez toi.`,
    steps: ['Scanne le code, ou va sur studioexistence.com/bucket-list/cadeau', 'Réponds aux cartes : ton affiche se compose', 'Ton bon s’applique au moment de commander'],
    from: n => `— ${n}`, val: `Valeur : ${moneyTxt(amount, 'fr', cur)}. N’expire jamais. Si les prix changent, la différence éventuelle sera à payer.`,
  } : {
    top: 'Gift card', title: info.to ? `A gift for you, ${info.to}` : 'A gift for you',
    what: `This card gives you your own Bucket List poster ${info.format.toUpperCase()} (${fmt.en.match(/\((.*)\)/)?.[1] || ''}), printed on thick matte paper and delivered to your door.`,
    steps: ['Scan the code or go to studioexistence.com/bucket-list/cadeau', 'Answer the cards: your poster takes shape', 'Your gift card applies when you order'],
    from: n => `— ${n}`, val: `Value: ${moneyTxt(amount, 'en', cur)}. Never expires. If prices change, any difference will be due at checkout.`,
  };
  return h('div', { width: W, height: H, background: PAPER, color: INK, fontFamily: 'Sans', padding: 90, position: 'relative' },
    // affiche d'exemple
    h('div', { position: 'absolute', left: 110, top: 170, width: 560, height: 792, padding: 16, background: INK, transform: 'rotate(-4deg)', boxShadow: `22px 24px 0 ${YEL}` },
      img(poster, { width: 528, height: 760 })),
    // texte
    h('div', { position: 'absolute', left: 800, top: 90, width: 864, height: 1060, flexDirection: 'column' },
      h('div', { alignItems: 'center', gap: 14 }, img(LOGO, { width: 52, height: 52 }),
        h('div', { fontFamily: 'Serif', fontSize: 40 }, 'Bucket'), h('div', { fontFamily: 'Serif', fontStyle: 'italic', fontSize: 40, background: YEL, padding: '0 10px' }, 'List'),
        h('div', { marginLeft: 'auto', fontWeight: 800, fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', opacity: .6 }, T.top)),
      h('div', { fontFamily: 'Serif', fontSize: 76, lineHeight: 1.05, marginTop: 56, letterSpacing: -1 }, T.title),
      info.msg ? h('div', { fontFamily: 'Serif', fontStyle: 'italic', fontSize: 38, lineHeight: 1.3, marginTop: 30, color: '#3A3448' }, `« ${info.msg} »`.replace(/^« (.*) »$/, fr ? '« $1 »' : '“$1”')) : null,
      info.from ? h('div', { fontSize: 30, fontWeight: 800, marginTop: 18 }, T.from(info.from)) : null,
      h('div', { fontSize: 27, lineHeight: 1.45, marginTop: 40, color: '#3A3448' }, T.what),
      h('div', { marginTop: 'auto', gap: 40, alignItems: 'flex-end' },
        h('div', { flexDirection: 'column', gap: 12, flex: 1 },
          ...T.steps.map((s, i) => h('div', { alignItems: 'center', gap: 16, fontSize: 24, fontWeight: 600 },
            h('div', { width: 40, height: 40, flexShrink: 0, borderRadius: 999, border: `3px solid ${INK}`, background: [YEL, PINK, '#57E36A'][i], alignItems: 'center', justifyContent: 'center', fontFamily: 'Serif', fontSize: 22 }, String(i + 1)), s)),
          h('div', { marginTop: 20, alignSelf: 'flex-start', fontSize: 44, fontWeight: 800, letterSpacing: 4, padding: '12px 26px', border: `4px solid ${INK}`, borderRadius: 14, background: CARD }, info.code)),
        h('div', { width: 230, height: 230, padding: 14, background: CARD, border: `4px solid ${INK}`, borderRadius: 14 }, img(qr, { width: 196, height: 196 }))),
      h('div', { fontSize: 19, marginTop: 26, color: '#4A4458' }, T.val)));
}
export async function cardPng(info) {
  const r = new ImageResponse(await cardTree(info), { width: W, height: H, fonts: fonts() });
  return Buffer.from(await r.arrayBuffer());
}
export async function cardPdf(info) {
  const png = await cardPng(info);
  const pdf = await PDFDocument.create(); pdf.setTitle(info.lang === 'en' ? 'Bucket List gift card' : 'Bon cadeau Bucket List'); pdf.setAuthor('Studio Existence inc.');
  const page = pdf.addPage([595.28, 419.53]);   // A5 paysage, en points
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 419.53 });
  return Buffer.from(await pdf.save());
}
