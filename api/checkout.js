// Démarre une commande d'affiche : reçoit le fichier d'impression (JPEG) rendu par l'app,
// le dépose dans Vercel Blob, puis crée une session Stripe Checkout et renvoie son URL.
// POST /api/checkout?format=50x70&style=ros&lang=fr&name=Marie   (corps : image/jpeg)
import Stripe from 'stripe';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { FORMATS, STYLES, SHIP_TO, readRaw } from './_shop.js';

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
  const name = (url.searchParams.get('name') || '').replace(/[\u0000-\u001f]/g, '').slice(0, 40).trim();
  if (!fmt) return res.status(400).json({ error: 'format' });

  let body;
  try { body = await readRaw(req, MAX); } catch (e) { return res.status(e.status || 400).json({ error: 'body' }); }
  // fichier JPEG uniquement (signature FF D8 FF)
  if (body.length < 1000 || body[0] !== 0xff || body[1] !== 0xd8 || body[2] !== 0xff) return res.status(400).json({ error: 'file' });

  try {
    const file = await put(`bucket-list/commandes/${new Date().toISOString().slice(0, 10)}-${randomUUID()}.jpg`, body, { access: 'public', contentType: 'image/jpeg' });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const base = `https://${req.headers.host}/bucket-list/`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: lang,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'cad',
          unit_amount: fmt.price,
          product_data: {
            name: fmt[lang],
            description: `${STYLES[style][lang]}${name ? ' · ' + name : ''} · ${lang === 'fr' ? 'livraison incluse' : 'shipping included'}`,
            images: [file.url],
          },
        },
      }],
      shipping_address_collection: { allowed_countries: SHIP_TO },
      metadata: { format, style, lang, name, file: file.url },
      success_url: `${base}?commande=merci&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}?commande=annulee`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('checkout', e && e.name, e && e.message);
    return res.status(502).json({ error: 'checkout' });
  }
}
