import { readFileSync } from 'fs';
import { join } from 'path';

export const config = { runtime: 'nodejs' };

export default function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;

  let title, desc;

  if (path.startsWith('/whale-song')) {
    const hasChant = url.searchParams.has('chant');
    title = hasChant ? 'WhaleSong — Message reçu 🐋' : 'WhaleSong';
    desc  = hasChant
      ? 'Vous avez reçu un chant de baleine. Écoutez pour révéler le message.'
      : 'Traduisez vos messages en chant de baleine. Partagez le lien. Le destinataire écoute — et seulement après, le message se révèle.';

  } else if (path.startsWith('/droid-lang')) {
    const hasSignal = url.searchParams.has('signal');
    title = hasSignal ? 'Droid.lang — Message reçu 🤖' : 'Droid.lang';
    desc  = hasSignal
      ? 'Vous avez reçu un message en langage droïde. Écoutez pour révéler le message.'
      : 'Encodez vos messages en signal droïde. Partagez le lien. Le destinataire écoute — et seulement après, le message se révèle.';

  } else {
    res.status(404).send('Not found');
    return;
  }

  // Lire le fichier HTML depuis le disque (chemin relatif à la racine du projet)
  const subfolder = path.startsWith('/whale-song') ? 'whale-song' : 'droid-lang';
  const filePath = join(process.cwd(), subfolder, 'index.html');
  const html = readFileSync(filePath, 'utf8');

  const patched = html
    .replace(/<meta property="og:title"[^>]*>/g,
      `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"[^>]*>/g,
      `<meta property="og:description" content="${desc}" />`)
    .replace(/<meta name="twitter:title"[^>]*>/g,
      `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description"[^>]*>/g,
      `<meta name="twitter:description" content="${desc}" />`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(patched);
}
