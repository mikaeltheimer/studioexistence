// Démarre une commande d'affiche : reçoit le fichier d'impression (JPEG) rendu par l'app,
// le dépose dans Vercel Blob, puis crée une session Stripe Checkout et renvoie son URL.
// POST /api/checkout?format=a2&style=ros&lang=fr&name=Marie&pl=123456
// corps : aperçu JPEG (pl octets, ~800 px) suivi du fichier d'impression JPEG ; sans « pl », le corps est le seul fichier d'impression
import Stripe from 'stripe';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { FORMATS, STYLES, CURRENCIES, readRaw, restoreMeta } from './_shop.js';
import { lookupGift } from './_gift.js';

export const config = { runtime: 'nodejs' };
const MAX = 4.4 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method' }); }
  // noms des variables manquantes (jamais leurs valeurs), pour diagnostiquer la configuration Vercel
  // Blob : ancien jeton (BLOB_READ_WRITE_TOKEN) ou nouvelle connexion OIDC (BLOB_STORE_ID, jeton fourni par Vercel à l'exécution)
  const missing = [];
  if (!process.env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) missing.push('BLOB_STORE_ID');
  if (missing.length) { console.error('checkout not_configured', missing.join(',')); return res.status(503).json({ error: 'not_configured', missing }); }
  const url = new URL(req.url, `https://${req.headers.host}`);
  const format = url.searchParams.get('format'), fmt = FORMATS[format];
  const style = STYLES[url.searchParams.get('style')] ? url.searchParams.get('style') : 'man';
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr';
  const cur = url.searchParams.get('cur') === 'usd' ? 'usd' : 'cad', CUR = CURRENCIES[cur];
  const name = (url.searchParams.get('name') || '').replace(/[\u0000-\u001f]/g, '').slice(0, 40).trim();
  if (!fmt) return res.status(400).json({ error: 'format' });

  let body;
  try { body = await readRaw(req, MAX); } catch (e) { return res.status(e.status || 400).json({ error: 'body' }); }
  const isJpeg = b => b.length >= 1000 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const pl = Number(url.searchParams.get('pl') || 0);
  const prev = pl > 0 && pl < body.length ? body.subarray(0, pl) : null;
  const print = prev ? body.subarray(pl) : body;
  // fichiers JPEG uniquement (signature FF D8 FF)
  if (!isJpeg(print) || (prev && !isJpeg(prev))) return res.status(400).json({ error: 'file' });

  try {
    const key = `bucket-list/commandes/${new Date().toISOString().slice(0, 10)}-${randomUUID()}`;
    const file = await put(`${key}.jpg`, print, { access: 'public', contentType: 'image/jpeg' });
    // aperçu léger : image du produit chez Stripe et dans le courriel (jamais le fichier pleine définition)
    const preview = prev ? await put(`${key}-apercu.jpg`, prev, { access: 'public', contentType: 'image/jpeg' }) : null;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const base = `https://${req.headers.host}/bucket-list/`;
    // moyens de paiement : configuration choisie dans Stripe (son identifiant diffère entre le mode test et le mode réel)
    // bon cadeau : appliqué d'office s'il est valide et dans la même devise (sinon la commande se fait sans, au prix normal)
    let gift = null;
    if (url.searchParams.get('gift')) {
      const g = await lookupGift(stripe, url.searchParams.get('gift')).catch(() => null);
      if (g && g.valid && g.cur === cur) gift = g; else return res.status(409).json({ error: 'gift', reason: g?.reason || 'currency' });
    }
    const pmc = (process.env.STRIPE_PAYMENT_METHOD_CONFIG || '').trim();
    const session = await stripe.checkout.sessions.create({
      ...(gift ? { discounts: [{ promotion_code: gift.id }] } : { allow_promotion_codes: true }),
      ...(pmc ? { payment_method_configuration: pmc } : {}),
      mode: 'payment',
      locale: lang,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: cur,
          unit_amount: fmt[CUR.field],
          tax_behavior: 'inclusive',   // prix affiché = prix payé : TPS/TVQ (ou TVH) incluses, calculées par Stripe Tax
          product_data: {
            name: fmt[lang],
            tax_code: 'txcd_99999999',   // bien matériel, taux général
            description: `${STYLES[style][lang]}${name ? ' · ' + name : ''} · ${lang === 'fr' ? 'taxes et livraison incluses' : 'taxes and shipping included'}`,
            // aperçu de l'affiche (ou image d'exemple) : le fichier d'impression pleine définition ne doit jamais être visible du client
            images: [preview ? preview.url : `https://${req.headers.host}/bucket-list/exemple-${style}-${lang}.jpg`],
          },
        },
      }],
      // un prix en USD ne se livre qu'aux États-Unis, un prix en CAD qu'au Canada
      shipping_address_collection: { allowed_countries: CUR.ship },
      automatic_tax: { enabled: true },   // taxe selon la province de l'adresse de livraison
      // codes promo créés dans Stripe (lancement, amis, partenaires) : proposés sauf si un bon cadeau est déjà appliqué
      metadata: { format, style, lang, name, cur, ...(gift ? { gift: gift.code } : {}), file: file.url, ...(preview ? { preview: preview.url } : {}), ...restoreMeta(url.searchParams.get('rc') || '') },
      // panier abandonné : la session expire après 1 h et le webhook supprime le fichier (checkout.session.expired)
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      success_url: `${base}?commande=merci&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}?commande=annulee`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('checkout', e && e.name, e && e.message);
    return res.status(502).json({ error: 'checkout' });
  }
}
