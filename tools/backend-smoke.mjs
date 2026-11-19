// Teste de ponta a ponta do protótipo no Supabase DE VERDADE (rodar depois de criar o projeto e fazer o deploy;
// ver backend/README.md). Sem dependências: usa só fetch.
// Uso: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ... npm run smoke:backend
// A anon key é pública (vai no app); a service_role NUNCA entra aqui nem no repositório.
const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
const anon = process.env.SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY (Supabase → Project Settings → API).');
  process.exit(1);
}
let fails = 0;
const ok = (c, m) => (c ? console.log('  ok:', m) : (fails++, console.error('  FALHOU:', m)));
const t0 = Date.now();

// 1. login convidado (anônimo): precisa estar ligado em Authentication → Sign In / Providers → Anonymous
const sign = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
const auth = await sign.json();
ok(sign.ok && auth.access_token, `login convidado (${Date.now() - t0} ms)`);
if (!auth.access_token) {
  console.error(auth);
  process.exit(1);
}
const call = async (body) => {
  const t = Date.now();
  const r = await fetch(`${url}/functions/v1/save-sync`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, ms: Date.now() - t, data: await r.json().catch(() => null) };
};

const save = {
  version: 1,
  name: 'Fumaça',
  classId: 'lamina',
  level: 3,
  xp: 10,
  freePoints: 0,
  attributes: { strength: 10, intelligence: 4, stamina: 10, agility: 6, willpower: 4 },
  mapId: 'floresta',
  lastSeen: 1,
  gold: 77,
};
const s1 = await call({ action: 'save', slot: 0, save });
ok(s1.status === 200 && s1.data?.version === 1, `salvar (versão ${s1.data?.version}, ${s1.ms} ms)`);
const s2 = await call({ action: 'save', slot: 0, save: { ...save, gold: 80 }, baseVersion: 1 });
ok(s2.status === 200 && s2.data?.version === 2, `salvar de novo (versão ${s2.data?.version}, ${s2.ms} ms)`);
const s3 = await call({ action: 'save', slot: 0, save, baseVersion: 1 });
ok(s3.status === 409, `versão velha dá conflito (${s3.status})`);
const l = await call({ action: 'list' });
ok(l.status === 200 && l.data?.slots?.length === 1, `listar (${l.ms} ms)`);
const o = await call({ action: 'open', slot: 0 });
ok(o.status === 200 && o.data?.character?.save?.gold === 80, `ler o save (${o.ms} ms)`);
ok(
  Math.abs((o.data?.character?.serverSavedAt ?? 0) - Date.now()) < 5 * 60_000,
  'lastSeen/relógio é o do servidor (não o 1 enviado)',
);
// 2. o aparelho NÃO consegue gravar direto na tabela (RLS)
const direct = await fetch(`${url}/rest/v1/characters`, {
  method: 'POST',
  headers: { apikey: anon, Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: auth.user?.id, slot: 1, save: {}, checksum: 'x', server_saved_at: 1 }),
});
ok(!direct.ok, `gravar direto na tabela é recusado (${direct.status})`);
console.log(fails ? `\n${fails} falha(s)` : `\nTudo certo (${Date.now() - t0} ms no total).`);
process.exit(fails ? 1 : 0);
