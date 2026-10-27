// Pays du visiteur (fourni par Vercel), pour afficher les prix dans la bonne devise : USD aux États-Unis, CAD ailleurs.
export const config = { runtime: 'nodejs' };
export default function handler(req, res) {
  const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase().slice(0, 2);
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ country, currency: country === 'US' ? 'usd' : 'cad' });
}
