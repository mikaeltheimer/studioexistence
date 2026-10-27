// Courriels de commande envoyés par Resend (https://resend.com) : confirmation au client, avis de vente à Studio Existence.
// Variables : RESEND_API_KEY (obligatoire pour envoyer), ORDER_FROM (ex. « Studio Existence <commandes@studioexistence.com> »,
// domaine vérifié dans Resend), ORDER_NOTIFY (adresse qui reçoit l'avis de vente), ORDER_REPLY_TO (réponses des clients).
import { FORMATS, STYLES, recipientFrom, externalId } from './_shop.js';

const INK = '#1C1A2B', PAPER = '#FBF4E6', CARD = '#FFFDF8', YEL = '#FFEE2E', PINK = '#FF66B8';
const PENS = [
  ['#57E36A', { fr: 'Vert', en: 'Green' }, { fr: 'Nature', en: 'Nature' }],
  ['#FFEE2E', { fr: 'Jaune', en: 'Yellow' }, { fr: 'Voyages & Géographie', en: 'Travel & Geography' }],
  ['#FF5A5F', { fr: 'Rouge', en: 'Red' }, { fr: 'Corps & Limites physiques', en: 'Body & Physical Limits' }],
  ['#FF9F2E', { fr: 'Orange', en: 'Orange' }, { fr: 'Sensations fortes', en: 'Thrills' }],
  ['#3FE0D0', { fr: 'Turquoise', en: 'Turquoise' }, { fr: 'Accomplissements', en: 'Achievements' }],
  ['#FF66B8', { fr: 'Rose', en: 'Pink' }, { fr: 'Relations humaines', en: 'Human Connections' }],
  ['#55B8FF', { fr: 'Bleu', en: 'Blue' }, { fr: 'Culture', en: 'Culture' }],
  ['#C29BFF', { fr: 'Lilas', en: 'Lilac' }, { fr: 'Insolite & mystère', en: 'Odd & Mysterious' }],
];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// montant dans la devise de la commande ; en anglais, « CA$ » ou « $ » (USD) sans ambiguïté
const money = (cents, lang, cur = 'cad') => new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-US', { style: 'currency', currency: String(cur || 'cad').toUpperCase() }).format((cents || 0) / 100);
export const orderNo = sessionId => externalId(sessionId).slice(0, 8).toUpperCase();

export function customerEmail(session, site = 'https://www.studioexistence.com') {
  const m = session.metadata || {}, fr = m.lang !== 'en', L = fr ? 'fr' : 'en';
  const fmt = FORMATS[m.format] || {}, style = (STYLES[m.style] || STYLES.man)[L];
  const r = recipientFrom(session), first = (m.name || r.name.split(' ')[0] || '').trim();
  const no = orderNo(session.id), total = money(session.amount_total, L, session.currency), tax = session.total_details?.amount_tax || 0;
  const T = fr ? {
    subject: `Ta Bucket List part à l'impression (commande ${no})`,
    hi: first ? `Merci, ${esc(first)} !` : 'Merci !',
    lead: "Ta commande est confirmée. Ton affiche est imprimée sur demande, juste pour toi, puis expédiée par notre partenaire d'impression.",
    recap: 'Ta commande', no: 'Commande', item: 'Affiche', styleL: 'Style', total: 'Total payé', taxL: 'dont taxes', ship: 'Livraison à',
    when: "Délais : 2 à 5 jours ouvrables de fabrication, puis quelques jours de transport. Tu recevras un avis d'expédition avec le suivi du colis.",
    kit: 'Ton kit de surligneurs', kitp: 'Les couleurs de ton affiche suivent le paquet de 8 surligneurs STABILO BOSS ORIGINAL (couleurs classiques). Quand tu vis une nouvelle expérience, surligne-la avec la couleur de sa catégorie.',
    help: "Une question, un souci à la livraison ? Réponds simplement à ce courriel.", terms: 'Conditions de vente', by: 'Studio Existence inc. · Sutton (Québec)',
  } : {
    subject: `Your Bucket List is off to the printer (order ${no})`,
    hi: first ? `Thank you, ${esc(first)}!` : 'Thank you!',
    lead: 'Your order is confirmed. Your poster is printed on demand, just for you, then shipped by our print partner.',
    recap: 'Your order', no: 'Order', item: 'Poster', styleL: 'Style', total: 'Total paid', taxL: 'incl. taxes', ship: 'Shipping to',
    when: "Timing: 2 to 5 business days to print, then a few days in transit. You'll get a shipping notice with tracking.",
    kit: 'Your highlighter kit', kitp: 'Your poster colours follow the pack of 8 STABILO BOSS ORIGINAL highlighters (classic colours). When you live a new experience, highlight it in its category colour.',
    help: 'A question, or a problem with delivery? Just reply to this email.', terms: 'Terms of sale', by: 'Studio Existence inc. · Sutton, Québec',
  };
  const addr = [r.name, r.address1, r.address2, `${r.city}${r.state_code ? ' (' + r.state_code + ')' : ''} ${r.zip}`.trim(), r.country_code === 'US' ? (fr ? 'États-Unis' : 'United States') : ''].filter(Boolean);
  const row = (k, v) => `<tr><td style="padding:4px 0;color:#4A4458;font-size:14px;width:120px;vertical-align:top">${k}</td><td style="padding:4px 0;font-size:14px;font-weight:700">${v}</td></tr>`;
  const pens = PENS.map(([c, n, cat]) => `<tr><td style="padding:3px 10px 3px 0;width:30px"><div style="width:26px;height:11px;background:${c};border:1px solid ${INK};border-radius:2px"></div></td><td style="padding:3px 0;font-size:14px"><b>${n[L]}</b> <span style="color:#4A4458">${cat[L]}</span></td></tr>`).join('');
  const img = m.preview ? `<tr><td style="padding:8px 0 24px" align="center"><img src="${esc(m.preview)}" width="260" alt="" style="display:block;width:260px;max-width:70%;height:auto;border:6px solid ${INK};box-shadow:8px 8px 0 ${PINK}"></td></tr>` : '';
  const html = `<!doctype html><html lang="${L}"><body style="margin:0;padding:0;background:${PAPER};color:${INK};font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="font-family:Georgia,serif;font-size:22px;padding-bottom:20px">Bucket <span style="font-style:italic;background:${YEL};padding:0 4px">List</span></td></tr>
<tr><td style="font-family:Georgia,serif;font-size:34px;line-height:1.1;padding-bottom:12px">${T.hi}</td></tr>
<tr><td style="font-size:16px;line-height:1.5;padding-bottom:22px">${T.lead}</td></tr>
${img}
<tr><td style="background:${CARD};border:1.5px solid ${INK};border-radius:8px;padding:16px 18px">
  <div style="font-family:Georgia,serif;font-size:20px;padding-bottom:8px">${T.recap}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
  ${row(T.no, no)}${row(T.item, esc(fmt[L] || m.format))}${row(T.styleL, esc(style) + (m.name ? ' · ' + esc(m.name) : ''))}
  ${row(T.total, total + (tax ? ` <span style="font-weight:400;color:#4A4458">(${T.taxL} ${money(tax, L, session.currency)})</span>` : ''))}
  ${row(T.ship, addr.map(esc).join('<br>'))}
  </table>
  <div style="font-size:14px;line-height:1.5;color:#4A4458;padding-top:10px">${T.when}</div>
</td></tr>
<tr><td style="height:18px"></td></tr>
<tr><td style="background:${CARD};border:1.5px solid ${INK};border-radius:8px;padding:16px 18px">
  <div style="font-family:Georgia,serif;font-size:20px;padding-bottom:8px">${T.kit}</div>
  <div style="font-size:14px;line-height:1.5;padding-bottom:10px">${T.kitp}</div>
  <table role="presentation" cellpadding="0" cellspacing="0">${pens}</table>
</td></tr>
<tr><td style="font-size:14px;line-height:1.5;padding:22px 0 6px">${T.help}</td></tr>
<tr><td style="font-size:12px;color:#4A4458;padding-top:6px">${T.by} · <a href="${site}/conditions/${fr ? '' : '#en'}" style="color:#4A4458">${T.terms}</a> · <a href="${site}/bucket-list/" style="color:#4A4458">studioexistence.com/bucket-list</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [T.hi.replace(/&#39;/g, "'"), '', T.lead, '', `${T.no} : ${no}`, `${T.item} : ${fmt[L] || m.format}`, `${T.styleL} : ${style}${m.name ? ' · ' + m.name : ''}`,
    `${T.total} : ${total}${tax ? ` (${T.taxL} ${money(tax, L, session.currency)})` : ''}`, `${T.ship} : ${addr.join(', ')}`, '', T.when, '', `${T.kit} — ${T.kitp}`, '', T.help, '', T.by].join('\n');
  return { subject: T.subject, html, text };
}

export function sellerEmail(session, printful = {}) {
  const m = session.metadata || {}, r = recipientFrom(session), no = orderNo(session.id);
  const fmt = (FORMATS[m.format] || {}).fr || m.format;
  const lines = [
    `Commande ${no} — ${fmt}, ${(STYLES[m.style] || STYLES.man).fr}${m.name ? ' · ' + m.name : ''}`,
    `Total : ${money(session.amount_total, 'fr', session.currency)} (taxes ${money(session.total_details?.amount_tax, 'fr', session.currency)})`,
    `Client : ${r.name} <${r.email}>`,
    `Livraison : ${[r.address1, r.address2, r.city, r.state_code, r.zip].filter(Boolean).join(', ')}`,
    `Printful : commande ${printful.id || '?'}${printful.confirm ? ' (envoyée en production)' : ' (BROUILLON à confirmer dans Printful)'}`,
    `Fichier d'impression : ${m.file || '?'}`,
    `Stripe : ${session.id}`,
  ];
  return { subject: `Nouvelle commande Bucket List ${no} — ${money(session.amount_total, 'fr', session.currency)}`, text: lines.join('\n') };
}

// Envoi idempotent : Resend ignore un second envoi avec la même clé (webhook rejoué par Stripe)
export async function sendResend(msg, key, fetchImpl = fetch) {
  const r = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(msg),
  });
  if (!r.ok) { const j = await r.text().catch(() => ''); throw new Error(`resend ${r.status}: ${j.slice(0, 200)}`); }
  return r.json().catch(() => ({}));
}

export async function sendOrderEmails(session, printful, fetchImpl = fetch) {
  if (!process.env.RESEND_API_KEY) return { skipped: true };
  const from = process.env.ORDER_FROM || 'Studio Existence <commandes@studioexistence.com>';
  const replyTo = process.env.ORDER_REPLY_TO || 'mikael@studioexistence.com';
  const out = {};
  const to = session.customer_details?.email;
  if (to) { const c = customerEmail(session); await sendResend({ from, to: [to], reply_to: replyTo, subject: c.subject, html: c.html, text: c.text }, `client-${session.id}`, fetchImpl); out.client = true; }
  if (process.env.ORDER_NOTIFY) { const v = sellerEmail(session, printful); await sendResend({ from, to: [process.env.ORDER_NOTIFY], reply_to: to || replyTo, subject: v.subject, text: v.text }, `vente-${session.id}`, fetchImpl); out.vendeur = true; }
  return out;
}
