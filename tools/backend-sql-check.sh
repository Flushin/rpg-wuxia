#!/usr/bin/env bash
# Protótipo do backend (roadmap M0): testa a migração do Supabase (tabelas, RLS e histórico de 5 versões) num
# Postgres local descartável, imitando o que o Supabase tem pronto (schema auth, auth.uid(), papéis).
# Precisa do Postgres instalado (initdb/pg_ctl). Não roda na CI. Uso: npm run check:backend-sql
set -euo pipefail
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
[ -x "$PGBIN/initdb" ] || { echo "Postgres não encontrado (initdb)"; exit 1; }
DIR=$(mktemp -d)
trap '"$PGBIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
RUNAS=""
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DIR" 2>/dev/null || useradd -m postgres; chown -R postgres "$DIR"; RUNAS="runuser -u postgres --"; fi
$RUNAS "$PGBIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p 54329 -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL="psql -h $DIR -p 54329 -U postgres -v ON_ERROR_STOP=1 -q -X -t -A -o /dev/null"
$PSQL <<'SQL'
-- o que o Supabase já tem pronto (versão mínima)
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
SQL
$PSQL -f backend/supabase/migrations/20261119000000_characters.sql
$PSQL <<'SQL'
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
insert into auth.users values (:A), (:B);
-- a função (service_role) grava um personagem para cada um e 7 versões no histórico do A
set role service_role;
insert into public.characters (user_id, slot, save, checksum, server_saved_at) values
  (:A, 0, '{"name":"Ana"}', 'x', 1), (:B, 0, '{"name":"Bia"}', 'y', 1);
insert into public.character_history (user_id, slot, version, save, checksum, server_saved_at)
  select :A, 0, v, '{}', 'x', v from generate_series(1, 7) v;
reset role;

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

select pg_temp.check((select count(*) from public.character_history where user_id = :A) = 5,
  'histórico guarda só as 5 últimas versões');
select pg_temp.check((select min(version) from public.character_history where user_id = :A) = 3,
  'as versões mais antigas saem primeiro');

-- jogador A logado
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select pg_temp.check((select count(*) from public.characters) = 1, 'A vê só o próprio personagem');
select pg_temp.check((select save->>'name' from public.characters) = 'Ana', 'A lê o próprio save');
select pg_temp.check((select count(*) from public.character_history) = 5, 'A vê só o próprio histórico');
do $$ begin
  begin
    update public.characters set save = '{"name":"Hack"}';
    if found then raise exception 'FALHOU: A conseguiu gravar direto'; end if;
    raise notice 'ok: A não grava direto (update não afeta nenhuma linha)';
  exception when insufficient_privilege then raise notice 'ok: A não grava direto';
  end;
  begin
    insert into public.characters (user_id, slot, save, checksum, server_saved_at)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 1, '{}', 'z', 1);
    raise exception 'FALHOU: A conseguiu criar personagem direto';
  exception when insufficient_privilege then raise notice 'ok: A não cria personagem direto (RLS)';
  end;
end $$;
reset role;

-- sem login
set role anon;
select pg_temp.check((select count(*) from public.characters) = 0, 'sem login não vê nada');
reset role;
select pg_temp.check((select save->>'name' from public.characters where user_id = :A) = 'Ana', 'save do A intacto');
-- apagar a conta apaga tudo (E5: exclusão de conta)
delete from auth.users where id = :A;
select pg_temp.check((select count(*) from public.characters where user_id = :A) = 0
  and (select count(*) from public.character_history where user_id = :A) = 0, 'apagar a conta apaga personagens e histórico');
SQL
echo "Tudo certo."
