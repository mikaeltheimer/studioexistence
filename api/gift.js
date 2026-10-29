// Bons cadeaux :
//   POST /api/gift?format=a3&cur=cad&lang=fr   corps JSON {from,to,msg}  -> session Stripe d'achat du bon
//   GET  /api/gift?code=BL-XXXX-XXXX                                     -> bon valide ? (de qui, pour qui, format)
//   GET  /api/gift?code=BL-XXXX-XXXX&pdf=1                               -> bon à imprimer (PDF A5)
//   GET  /api/gift?code=BL-XXXX-XXXX&png=1                               -> aperçu du bon (PNG)
//   GET  /api/gift?session_id=cs_…                                       -> code du bon après l'achat (page de remerciement)
import Stripe from 'stripe';
import { FORMATS, CURRENCIES, readRaw } from './_shop.js';
import { lookupGift, cardPdf, cardPng, clip, prettyCode, createGift, giftUrl } from './_gift.js';
import { sendGiftEmails } from './_email.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!process.env.STRIPE_SECRET_KEY) { console.error('gift not_configured STRIPE_SECRET_KEY'); return res.status(503).json({ error: 'not_configured', missing: ['STRIPE_SECRET_KEY'] }); }
  // mode de la clé (jamais la clé elle-même), pour vérifier qu'un aperçu tourne bien en mode test
  console.log('gift', req.method, (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live') ? 'live' : 'test');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const url = new URL(req.url, `https://${req.headers.host}`), q = url.searchParams;
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method === 'POST') {
      const fmt = FORMATS[q.get('format')]; if (!fmt) return res.status(400).json({ error: 'format' });
      const cur = q.get('cur') === 'usd' ? 'usd' : 'cad', lang = q.get('lang') === 'en' ? 'en' : 'fr';
      let body = {}; try { body = JSON.parse((await readRaw(req, 8000)).toString('utf8') || '{}'); } catch (e) { return res.status(400).json({ error: 'body' }); }
      const from = clip(body.from, 40), to = clip(body.to, 40), msg = clip(body.msg, 240);
      const pmc = (process.env.STRIPE_PAYMENT_METHOD_CONFIG || '').trim();
      const base = `https://${req.headers.host}/bucket-list/`;
      const session = await stripe.checkout.sessions.create({
        ...(pmc ? { payment_method_configuration: pmc } : {}),
        mode: 'payment', locale: lang,
        line_items: [{ quantity: 1, price_data: {
          currency: cur, unit_amount: fmt[CURRENCIES[cur].field], tax_behavior: 'inclusive',
          product_data: { name: lang === 'fr' ? `Bon cadeau Bucket List : affiche ${q.get('format').toUpperCase()}` : `Bucket List gift card: ${q.get('format').toUpperCase()} poster`,
            description: (lang === 'fr' ? `Pour ${to || 'une personne chère'}. Valable sans limite de temps, livraison ${cur === 'usd' ? 'aux États-Unis' : 'au Canada'} incluse.` : `For ${to || 'someone special'}. Never expires, shipping to ${cur === 'usd' ? 'the US' : 'Canada'} included.`),
            images: [`https://${req.headers.host}/bucket-list/exemple-man-${lang}.jpg`], tax_code: 'txcd_99999999' } } }],
        automatic_tax: { enabled: true }, billing_address_collection: 'required',
        metadata: { kind: 'gift', format: q.get('format'), cur, lang, from, to, msg },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        success_url: `${base}?cadeau-merci=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}?commande=annulee`,
      });
      return res.status(200).json({ url: session.url });
    }
    if (q.get('session_id')) {
      const s = await stripe.checkout.sessions.retrieve(q.get('session_id'), { expand: ['payment_intent'] });
      if (s.metadata?.kind !== 'gift') return res.status(404).json({ error: 'not_gift' });
      if (s.payment_status !== 'paid') return res.status(200).json({ ready: false, paid: false });
      // le paiement est confirmé : on crée le bon ici même, sans attendre le webhook (création et courriel idempotents,
      // le webhook qui arrive ensuite retrouve le même code et Resend ignore le second envoi)
      let code = s.payment_intent?.metadata?.gift_code;
      if (!code) {
        const g = await createGift(stripe, { ...s, payment_intent: s.payment_intent?.id || s.payment_intent });
        code = g.code;
        const m = s.metadata;
        const pdf = await cardPdf({ code, format: m.format, cur: m.cur, lang: m.lang, from: m.from, to: m.to, msg: m.msg }).catch(e => { console.error('bon pdf', e.message); return null; });
        console.log('cadeau (page)', s.id, code, JSON.stringify(await sendGiftEmails(s, code, giftUrl(code), pdf).catch(e => ({ erreur: e.message }))));
      }
      return res.status(200).json({ ready: true, code, to: s.metadata.to, lang: s.metadata.lang });
    }
    const code = prettyCode(q.get('code'));
    if (!code) return res.status(400).json({ valid: false, reason: 'format' });
    const info = await lookupGift(stripe, code);
    if (q.get('pdf') || q.get('png')) {
      if (!info.valid && info.reason !== 'used') return res.status(404).send('not found');
      const r = await stripe.promotionCodes.list({ code, limit: 1, expand: ['data.promotion.coupon'] });
      const p = r.data[0], m = p.metadata, c = p.promotion?.coupon;
      const card = { code, format: m.format, cur: m.cur, lang: m.lang, from: m.from, to: m.to, msg: m.msg, amount: c?.amount_off };
      if (q.get('png')) { // aperçu du bon sur la page de remerciement
        res.setHeader('Content-Type', 'image/png');
        return res.status(200).send(await cardPng(card));
      }
      const pdf = await cardPdf(card);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="bon-cadeau-bucket-list-${code}.pdf"`);
      return res.status(200).send(pdf);
    }
    const { id, ...pub } = info;
    return res.status(200).json(pub);
  } catch (e) {
    console.error('gift', e && e.name, e && e.message);
    return res.status(502).json({ error: 'gift' });
  }
}
