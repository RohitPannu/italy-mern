export async function load() {
  if (__PREVIEW__) { // static data so the single-file preview works without a server
    const [p, m] = await Promise.all([import('../../server/data/programs.json'), import('../../server/data/meta.json')]);
    return { programs: p.default.map((x, i) => ({ ...x, _id: 'p' + i })), meta: m.default };
  }
  const [programs, meta] = await Promise.all([fetch('/api/programs').then(r => r.json()), fetch('/api/meta').then(r => r.json())]);
  if (!Array.isArray(programs)) throw new Error('Could not load programs');
  return { programs, meta };
}
export async function sendLead(b) {
  if (__PREVIEW__) throw new Error('Preview only. Run the Node server to receive messages.');
  const r = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not send'); return j;
}
