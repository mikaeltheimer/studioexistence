// Tâche planifiée (Vercel Cron, voir vercel.json) : supprime les fichiers d'impression Bucket List
// de plus de 12 mois, comme le promet la politique de confidentialité (/confidentialite/).
// Vercel appelle cette fonction avec « Authorization: Bearer $CRON_SECRET » : sans CRON_SECRET, rien n'est supprimé.
import { list, del } from '@vercel/blob';

export const config = { runtime: 'nodejs' };
export const PREFIX = 'bucket-list/commandes/';
export const MAX_AGE_DAYS = 365;

export async function cleanup(now = Date.now(), api = { list, del }) {
  const limit = now - MAX_AGE_DAYS * 86400e3;
  let cursor, scanned = 0, deleted = 0;
  do {
    const page = await api.list({ prefix: PREFIX, cursor, limit: 1000 });
    scanned += page.blobs.length;
    const old = page.blobs.filter(b => new Date(b.uploadedAt).getTime() < limit).map(b => b.url);
    if (old.length) { await api.del(old); deleted += old.length; }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return { scanned, deleted };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'not_configured', missing: ['CRON_SECRET'] });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });
  try {
    const out = await cleanup();
    console.log('blob-cleanup', JSON.stringify(out));
    return res.status(200).json(out);
  } catch (e) {
    console.error('blob-cleanup', e && e.name, e && e.message);
    return res.status(500).json({ error: 'cleanup' });
  }
}
