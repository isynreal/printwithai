-- Run this once in Supabase SQL Editor to upgrade an existing rooms table.
alter table public.rooms
  add column if not exists results jsonb not null default '[]'::jsonb,
  add column if not exists round_started_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rooms_results_is_array'
      and conrelid = 'public.rooms'::regclass
  ) then
    alter table public.rooms
      add constraint rooms_results_is_array check (jsonb_typeof(results) = 'array');
  end if;
end $$;

-- Allow an existing player to reconnect after the round has started.
create or replace function public.join_room(p_code text, p_player jsonb)
returns public.rooms
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_room public.rooms;
begin
  select * into target_room
  from public.rooms
  where code = upper(p_code) and expires_at > now()
  for update;

  if not found then raise exception 'Room not found'; end if;
  if target_room.players @> jsonb_build_array(jsonb_build_object('id', p_player->>'id')) then
    return target_room;
  end if;
  if target_room.state <> 'lobby' then raise exception 'Game already started'; end if;
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
set search_path = public, extensions
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
      results = case when p_state = 'prompt' then '[]'::jsonb else results end,
      round_started_at = case when p_state = 'drawing' then now() else round_started_at end,
      updated_at = now(),
      expires_at = now() + interval '6 hours'
  where code = upper(p_code)
    and host_token_hash = encode(digest(p_host_token, 'sha256'), 'hex')
  returning * into target_room;
  if not found then raise exception 'Host verification failed'; end if;
  return target_room;
end;
$$;

create or replace function public.submit_result(p_code text, p_player_id text, p_result jsonb)
returns public.rooms
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_room public.rooms;
  next_results jsonb;
  clean_result jsonb;
  expected_count integer;
  submitted_count integer;
  numeric_score integer;
begin
  select * into target_room from public.rooms
  where code = upper(p_code) and expires_at > now() for update;
  if not found then raise exception 'Room not found'; end if;
  if target_room.state <> 'drawing' then raise exception 'Round is not accepting drawings'; end if;
  if p_player_id = target_room.host_id then raise exception 'Host is not a drawing player'; end if;
  if not target_room.players @> jsonb_build_array(jsonb_build_object('id', p_player_id)) then
    raise exception 'Player is not in this room';
  end if;
  numeric_score := (p_result->>'score')::integer;
  if numeric_score < 0 or numeric_score > 100 then raise exception 'Invalid score'; end if;
  if char_length(coalesce(p_result->>'image', '')) > 250000 then raise exception 'Drawing preview is too large'; end if;
  clean_result := jsonb_build_object(
    'id', p_player_id, 'name', left(coalesce(p_result->>'name', '玩家'), 20),
    'score', numeric_score, 'description', left(coalesce(p_result->>'description', ''), 80),
    'image', coalesce(p_result->>'image', '')
  );
  select coalesce(jsonb_agg(item), '[]'::jsonb) into next_results
  from jsonb_array_elements(target_room.results) item where item->>'id' <> p_player_id;
  next_results := next_results || jsonb_build_array(clean_result);
  expected_count := greatest(jsonb_array_length(target_room.players) - 1, 0);
  submitted_count := jsonb_array_length(next_results);
  update public.rooms
  set results = next_results,
      state = case when expected_count > 0 and submitted_count >= expected_count then 'results' else 'drawing' end,
      updated_at = now()
  where code = target_room.code returning * into target_room;
  return target_room;
end;
$$;

create or replace function public.finish_round(p_code text, p_host_token text)
returns public.rooms
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_room public.rooms;
  player_item jsonb;
  next_results jsonb;
begin
  select * into target_room from public.rooms
  where code = upper(p_code)
    and host_token_hash = encode(digest(p_host_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'Host verification failed'; end if;
  next_results := target_room.results;
  for player_item in select value from jsonb_array_elements(target_room.players)
  loop
    if player_item->>'id' <> target_room.host_id
      and not next_results @> jsonb_build_array(jsonb_build_object('id', player_item->>'id')) then
      next_results := next_results || jsonb_build_array(jsonb_build_object(
        'id', player_item->>'id', 'name', player_item->>'name', 'score', 0,
        'description', '未在時間內完成作品', 'image', ''
      ));
    end if;
  end loop;
  update public.rooms set results = next_results, state = 'results', updated_at = now()
  where code = target_room.code returning * into target_room;
  return target_room;
end;
$$;

revoke all on function public.submit_result(text, text, jsonb) from public;
revoke all on function public.finish_round(text, text) from public;
revoke all on function public.join_room(text, jsonb) from public;
grant execute on function public.submit_result(text, text, jsonb) to anon, authenticated;
grant execute on function public.finish_round(text, text) to anon, authenticated;
grant execute on function public.join_room(text, jsonb) to anon, authenticated;
