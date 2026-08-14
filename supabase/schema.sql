create extension if not exists pgcrypto;

create table if not exists public.rooms (
  code text primary key check (code ~ '^[A-Z0-9]{6,8}$'),
  name text not null check (char_length(name) between 1 and 40),
  host_id text not null,
  host_name text not null check (char_length(host_name) between 1 and 20),
  host_token_hash text not null,
  state text not null default 'lobby' check (state in ('lobby', 'prompt', 'drawing', 'scoring', 'results')),
  prompt text not null default '' check (char_length(prompt) <= 30),
  players jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array' and jsonb_array_length(players) <= 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);

create index if not exists rooms_lobby_created_idx
  on public.rooms (created_at desc)
  where state = 'lobby';

alter table public.rooms enable row level security;

drop policy if exists "rooms are publicly readable" on public.rooms;
create policy "rooms are publicly readable"
  on public.rooms for select
  to anon, authenticated
  using (expires_at > now());

create or replace function public.create_room(
  p_code text,
  p_name text,
  p_host_id text,
  p_host_name text,
  p_host_token text,
  p_player jsonb
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  created_room public.rooms;
begin
  if p_host_token is null or char_length(p_host_token) < 20 then
    raise exception 'Invalid host token';
  end if;
  insert into public.rooms (code, name, host_id, host_name, host_token_hash, players)
  values (
    upper(p_code),
    left(p_name, 40),
    p_host_id,
    left(p_host_name, 20),
    encode(digest(p_host_token, 'sha256'), 'hex'),
    jsonb_build_array(p_player)
  )
  returning * into created_room;
  return created_room;
end;
$$;

create or replace function public.join_room(p_code text, p_player jsonb)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
begin
  select * into target_room
  from public.rooms
  where code = upper(p_code) and expires_at > now()
  for update;

  if not found then raise exception 'Room not found'; end if;
  if target_room.state <> 'lobby' then raise exception 'Game already started'; end if;
  if target_room.players @> jsonb_build_array(jsonb_build_object('id', p_player->>'id')) then
    return target_room;
  end if;
  if jsonb_array_length(target_room.players) >= 6 then raise exception 'Room is full'; end if;

  update public.rooms
  set players = players || jsonb_build_array(p_player), updated_at = now()
  where code = target_room.code
  returning * into target_room;
  return target_room;
end;
$$;

create or replace function public.host_update_room(
  p_code text,
  p_host_token text,
  p_state text,
  p_prompt text default ''
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms;
begin
  if p_state not in ('lobby', 'prompt', 'drawing', 'scoring', 'results') then
    raise exception 'Invalid room state';
  end if;

  update public.rooms
  set state = p_state,
      prompt = case when p_state = 'drawing' then left(p_prompt, 30) else prompt end,
      updated_at = now(),
      expires_at = now() + interval '6 hours'
  where code = upper(p_code)
    and host_token_hash = encode(digest(p_host_token, 'sha256'), 'hex')
  returning * into target_room;

  if not found then raise exception 'Host verification failed'; end if;
  return target_room;
end;
$$;

revoke all on function public.create_room(text, text, text, text, text, jsonb) from public;
revoke all on function public.join_room(text, jsonb) from public;
revoke all on function public.host_update_room(text, text, text, text) from public;
grant execute on function public.create_room(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.join_room(text, jsonb) to anon, authenticated;
grant execute on function public.host_update_room(text, text, text, text) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
end $$;
