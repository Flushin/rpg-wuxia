-- Protótipo do save na nuvem (roadmap M0). Uma linha por personagem (4 espaços por conta).
-- Quem escreve é só a Edge Function save-sync (com a chave de serviço, que ignora a RLS); o aparelho pode LER os
-- próprios personagens direto (RLS), mas não gravar: assim o relógio e a conferência ficam sempre no servidor.

create table if not exists public.characters (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 0 and 3),
  save jsonb not null,
  version integer not null default 1,
  checksum text not null,
  server_saved_at bigint not null, -- ms, relógio do servidor
  flags text[] not null default '{}', -- motivos de suspeita do último envio (E4c: só marca)
  last_played boolean not null default false, -- só o último personagem jogado recebe ganho offline
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

-- Histórico das últimas versões (base para a tela de conflito e a restauração do M1).
create table if not exists public.character_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null,
  version integer not null,
  save jsonb not null,
  checksum text not null,
  server_saved_at bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists character_history_user_slot on public.character_history (user_id, slot, version desc);

alter table public.characters enable row level security;
alter table public.character_history enable row level security;

-- O dono lê os próprios personagens. Nenhuma política de insert/update/delete: o cliente não grava direto.
drop policy if exists "dono lê" on public.characters;
create policy "dono lê" on public.characters for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "dono lê histórico" on public.character_history;
create policy "dono lê histórico" on public.character_history
  for select to authenticated using ((select auth.uid()) = user_id);

-- Guarda só as 5 últimas versões de cada personagem.
create or replace function public.trim_character_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.character_history h
  where h.user_id = new.user_id and h.slot = new.slot
    and h.id not in (
      select id from public.character_history
      where user_id = new.user_id and slot = new.slot
      order by version desc limit 5
    );
  return null;
end $$;
drop trigger if exists trim_history on public.character_history;
create trigger trim_history after insert on public.character_history
  for each row execute function public.trim_character_history();
