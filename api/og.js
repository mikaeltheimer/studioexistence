export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
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
    // Toute autre route : servir tel quel sans modification
    return fetch(req);
  }

  // Récupérer le index.html du bon sous-dossier
  const htmlUrl = new URL(path.replace(/\/?$/, '/index.html'), url.origin);
  const html = await fetch(htmlUrl).then(r => r.text());

  const patched = html
    .replace(/<meta property="og:title"[^>]*>/g,
      `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"[^>]*>/g,
      `<meta property="og:description" content="${desc}" />`)
    .replace(/<meta name="twitter:title"[^>]*>/g,
      `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description"[^>]*>/g,
      `<meta name="twitter:description" content="${desc}" />`);

  return new Response(patched, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
