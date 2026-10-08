// Webhook Stripe : quand une affiche est payée, crée la commande chez Printful avec le fichier d'impression.
// Par défaut la commande Printful est créée en BROUILLON (à confirmer dans le tableau de bord Printful).
// Mettre PRINTFUL_AUTO_CONFIRM=1 pour l'envoyer directement en production.
import Stripe from 'stripe';
import { FORMATS, variantFor, externalId, recipientFrom, readRaw } from './_shop.js';

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
    if (session.payment_status === 'paid') {
      try {
        const out = await createPrintfulOrder(session);
        console.log('printful', session.id, JSON.stringify(out));
      } catch (e) {
        // 500 : Stripe réessaiera automatiquement (pendant ~3 jours), le temps de corriger la configuration
        console.error('printful error', session.id, e.message);
        return res.status(500).json({ error: 'printful' });
      }
    }
  }
  return res.status(200).json({ received: true });
}
