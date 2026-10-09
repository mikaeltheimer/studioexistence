// Boutique Bucket List : formats vendus, prix (en cents CAD, livraison incluse) et correspondance Printful.
// Les prix affichés dans l'app (constante SHOP de bucket-list/index.html) doivent rester identiques à ceux-ci.
import { createHash } from 'crypto';

export const FORMATS = {
  a3: { fr: 'Affiche Bucket List A3 (29,7 × 42 cm)', en: 'Bucket List poster A3 (29.7 × 42 cm)', price: 4900, variantEnv: 'PRINTFUL_VARIANT_A3' },
  a2: { fr: 'Affiche Bucket List A2 (42 × 59,4 cm)', en: 'Bucket List poster A2 (42 × 59.4 cm)', price: 6900, variantEnv: 'PRINTFUL_VARIANT_A2' },
};
export const STYLES = { man: { fr: 'Manifeste', en: 'Manifesto' }, ros: { fr: 'Rosace', en: 'Rosette' } };
export const SHIP_TO = ['CA'];

export const variantFor = fmt => Number(process.env[FORMATS[fmt]?.variantEnv] || 0);
// identifiant de commande Printful (32 caractères max) dérivé de la session Stripe : rejouer le webhook ne crée pas de doublon
export const externalId = sessionId => createHash('md5').update(String(sessionId)).digest('hex');

export async function readRaw(req, max) {
  const chunks = []; let n = 0;
  for await (const chunk of req) { const c = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); n += c.length; if (n > max) { const e = new Error("too_large"); e.status = 413; throw e; } chunks.push(c); }
  return Buffer.concat(chunks);
}

// Adresse de livraison : selon la version de l'API Stripe, elle est dans shipping_details ou collected_information
export function recipientFrom(session) {
  const sd = session.collected_information?.shipping_details || session.shipping_details || {};
  const a = sd.address || session.customer_details?.address || {};
  return {
    name: sd.name || session.customer_details?.name || '',
    address1: a.line1 || '', address2: a.line2 || '',
    city: a.city || '', state_code: a.state || '', country_code: a.country || 'CA', zip: a.postal_code || '',
    email: session.customer_details?.email || '', phone: session.customer_details?.phone || '',
  };
}
