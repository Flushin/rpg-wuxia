// Edge Function do protótipo (Supabase, Deno). Rotas (POST, JSON, com o token do jogador no Authorization):
//   { action: 'list' }                         → os 4 espaços (sem aplicar offline)
//   { action: 'open', slot }                   → abre o personagem: ganho offline com o relógio do servidor
//   { action: 'save', slot, save, baseVersion } → grava (recusa se baseVersion não for a versão atual: conflito)
// A lógica do jogo vem de ../_shared/mistpeak-server.mjs (gerado por `npm run build:backend`).
// Deploy: ver backend/README.md.
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-types="../_shared/mistpeak-server.d.ts"
import { acceptUpload, openCharacter, type StoredCharacter } from '../_shared/mistpeak-server.mjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Row = {
  slot: number;
  save: StoredCharacter['save'];
  version: number;
  checksum: string;
  server_saved_at: number;
  flags: string[];
  last_played: boolean;
};
const toStored = (r: Row): StoredCharacter => ({
  slot: r.slot,
  save: r.save,
  version: r.version,
  checksum: r.checksum,
  serverSavedAt: Number(r.server_saved_at),
  flags: r.flags ?? [],
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  // cliente com o token do jogador só para saber quem é; gravação com a chave de serviço (ignora a RLS)
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await asUser.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return json({ error: 'sem login' }, 401);
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now = Date.now(); // relógio do servidor
  const body = await req.json().catch(() => ({}));
  const slot = Number(body.slot);

  const read = async (): Promise<Row | null> => {
    const { data } = await db.from('characters').select('*').eq('user_id', userId).eq('slot', slot).maybeSingle();
    return data as Row | null;
  };
  const write = async (row: StoredCharacter, lastPlayed: boolean) => {
    if (lastPlayed) await db.from('characters').update({ last_played: false }).eq('user_id', userId);
    const rec = {
      user_id: userId,
      slot: row.slot,
      save: row.save,
      version: row.version,
      checksum: row.checksum,
      server_saved_at: row.serverSavedAt,
      flags: row.flags,
      last_played: lastPlayed,
      updated_at: new Date(now).toISOString(),
    };
    const { error } = await db.from('characters').upsert(rec);
    if (error) throw error;
    await db.from('character_history').insert({
      user_id: userId,
      slot: row.slot,
      version: row.version,
      save: row.save,
      checksum: row.checksum,
      server_saved_at: row.serverSavedAt,
    });
  };

  try {
    if (body.action === 'list') {
      const { data } = await db
        .from('characters')
        .select('slot, version, server_saved_at, last_played, save->name, save->level, save->classId')
        .eq('user_id', userId);
      return json({ now, slots: data ?? [] });
    }
    if (!(slot >= 0 && slot <= 3)) return json({ error: 'espaço inválido' }, 400);
    if (body.action === 'open') {
      const cur = await read();
      if (!cur) return json({ error: 'vazio' }, 404);
      const { row, offline } = await openCharacter(toStored(cur), now, cur.last_played);
      if (offline) await write(row, true);
      return json({ now, character: row, offline });
    }
    if (body.action === 'save') {
      const cur = await read();
      if (cur && Number(body.baseVersion) !== cur.version)
        return json({ error: 'conflito', server: toStored(cur) }, 409);
      const row = await acceptUpload(cur ? toStored(cur) : null, slot, body.save, now);
      await write(row, true);
      return json({ now, version: row.version, checksum: row.checksum, flags: row.flags });
    }
    return json({ error: 'ação desconhecida' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'erro no servidor' }, 500);
  }
});
