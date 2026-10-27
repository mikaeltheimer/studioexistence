// Webhook Stripe : quand une affiche est payée, crée la commande chez Printful avec le fichier d'impression.
// Par défaut la commande Printful est créée en BROUILLON (à confirmer dans le tableau de bord Printful).
// Mettre PRINTFUL_AUTO_CONFIRM=1 pour l'envoyer directement en production.
import Stripe from 'stripe';
import { del } from '@vercel/blob';
import { FORMATS, variantFor, externalId, recipientFrom, readRaw } from './_shop.js';
import { sendOrderEmails } from './_email.js';

export const config = { runtime: 'nodejs' };

export async function createPrintfulOrder(session, fetchImpl = fetch) {
  const m = session.metadata || {};
  const fmt = FORMATS[m.format];
  const variant = variantFor(m.format);
  if (!fmt || !variant || !m.file) throw new Error(`config: format=${m.format} variant=${variant} file=${!!m.file}`);
  const confirm = process.env.PRINTFUL_AUTO_CONFIRM === '1';
  const headers = { Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}`, 'Content-Type': 'application/json' };
  if (process.env.PRINTFUL_STORE_ID) headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;
  const order = {
    external_id: externalId(session.id),
    recipient: recipientFrom(session),
    items: [{ variant_id: variant, quantity: 1, name: fmt.fr + (m.name ? ` (${m.name})` : ''), files: [{ type: 'default', url: m.file }] }],
  };
  const r = await fetchImpl(`https://api.printful.com/orders?confirm=${confirm}`, { method: 'POST', headers, body: JSON.stringify(order) });
  const j = await r.json().catch(() => ({}));
  if (r.ok) return { created: true, id: j?.result?.id, confirm };
  // webhook rejoué : la commande existe déjà avec cet external_id
  const msg = JSON.stringify(j).toLowerCase();
  if (r.status === 400 && msg.includes('external') && (msg.includes('exist') || msg.includes('already') || msg.includes('unique'))) return { created: false, duplicate: true };
  throw new Error(`printful ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
}

// Panier abandonné : la session a expiré sans paiement, le fichier d'impression ne sert plus à rien
export async function dropAbandoned(session, delImpl = del) {
  const ours = u => /^https:\/\/[^/]+\.blob\.vercel-storage\.com\/bucket-list\/commandes\//.test(u || '');
  const files = [session.metadata?.file, session.metadata?.preview].filter(ours);
  if (session.payment_status === 'paid' || !files.length) return { deleted: false };
  await delImpl(files.length === 1 ? files[0] : files);
  return { deleted: true, n: files.length };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_missing');
  let event;
  try {
    const raw = await readRaw(req, 1024 * 1024);
    event = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (e) {
    console.error('webhook signature', e.message);
    return res.status(400).send('bad signature');
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    // « no_payment_required » : commande entièrement couverte par un code promo à 100 %
    if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
      try {
        const out = await createPrintfulOrder(session);
        console.log('printful', session.id, JSON.stringify(out));
        // courriels (Resend) : envoi idempotent, un rejeu du webhook ne crée pas de doublon
        console.log('courriels', session.id, JSON.stringify(await sendOrderEmails(session, out)));
      } catch (e) {
        // 500 : Stripe réessaiera automatiquement (pendant ~3 jours), le temps de corriger la configuration
        console.error('commande error', session.id, e.message);
        return res.status(500).json({ error: 'commande' });
      }
    }
  }
  if (event.type === 'checkout.session.expired') {
    try { console.log('abandon', event.data.object.id, JSON.stringify(await dropAbandoned(event.data.object))); }
    catch (e) { console.error('abandon error', event.data.object.id, e.message); return res.status(500).json({ error: 'blob' }); }
  }
  return res.status(200).json({ received: true });
}
