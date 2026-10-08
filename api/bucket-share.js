// Lien de partage d'une Bucket List (/bucket-list/partage?l=…, réécrit vers cette fonction dans vercel.json) : sert l'app avec des balises de partage
// personnalisées (titre, description, image générée), pour que l'aperçu montre la liste de la personne.
import { appHtml, decode, itemsOf, escAttr, deN } from './_bucket.js';

export const config = { runtime: 'nodejs' };

export default function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const l = url.searchParams.get('l');
  let html = appHtml();
  const p = l ? decode(l) : null;

  if (p) {
    const { items, lang, name } = itemsOf(p);
    const d = items.filter(i => i.s === 'done').length, t = items.length - d;
    const fr = lang === 'fr';
    const title = fr ? (name ? `La Bucket List ${deN(name)}` : 'Une Bucket List') : (name ? `${name}'s Bucket List` : 'A Bucket List');
    const stats = fr ? `${d} vécue${d > 1 ? 's' : ''} · ${t} à vivre` : `${d} lived · ${t} to live`;
    const sample = items.filter(i => i.s === 'done').slice(0, 3).map(i => i.label).join(', ');
    const desc = `${stats}${sample ? (fr ? ` — dont ${sample}…` : ` — including ${sample}…`) : ''} ${fr ? 'Et toi, que veux-tu vivre ?' : 'What do you want to live?'}`;
    const img = `https://${req.headers.host}/api/bucket-og?l=${encodeURIComponent(l)}`;
    const pageUrl = `https://${req.headers.host}/bucket-list/partage?l=${encodeURIComponent(l)}`;
    const T = escAttr(title), D = escAttr(desc), I = escAttr(img), U = escAttr(pageUrl);
    html = html
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${T}">`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${D}">`)
      .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${U}">`)
      .replace(/<meta property="og:image" [^>]*>/, `<meta property="og:image" content="${I}">`)
      .replace(/<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${T}">`)
      .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${T}">`)
      .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${D}">`)
      .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${I}">`)
      .replace(/<meta property="og:locale" [^>]*>/, `<meta property="og:locale" content="${fr ? 'fr_CA' : 'en_CA'}">`);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Pas de cache CDN : chaque lien a son propre aperçu (et le rendu ne coûte presque rien)
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Bucket-Share', p ? 'personalise' : (l ? 'invalide' : 'absent'));
  res.status(200).send(html);
}
