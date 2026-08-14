-- Run once in Supabase SQL Editor for an existing project.
-- Rooms become unusable exactly 20 minutes after creation and are physically
-- deleted by the scheduled job within the following minute.

alter table public.rooms
  alter column expires_at set default (now() + interval '20 minutes');

update public.rooms
set expires_at = created_at + interval '20 minutes';

delete from public.rooms
where expires_at <= now();

create index if not exists rooms_expires_at_idx
  on public.rooms (expires_at);

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
      updated_at = now()
  where code = upper(p_code)
    and expires_at > now()
    and host_token_hash = encode(digest(p_host_token, 'sha256'), 'hex')
  returning * into target_room;

  if not found then raise exception 'Host verification failed or room expired'; end if;
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
  select * into target_room
  from public.rooms
  where code = upper(p_code)
    and host_token_hash = encode(digest(p_host_token, 'sha256'), 'hex')
    and expires_at > now()
  for update;

  if not found then raise exception 'Host verification failed or room expired'; end if;
  next_results := target_room.results;

  for player_item in select value from jsonb_array_elements(target_room.players)
  loop
    if player_item->>'id' <> target_room.host_id
      and not next_results @> jsonb_build_array(jsonb_build_object('id', player_item->>'id')) then
      next_results := next_results || jsonb_build_array(jsonb_build_object(
        'id', player_item->>'id',
        'name', player_item->>'name',
        'score', 0,
        'description', '未在時間內完成作品',
        'image', ''
      ));
    end if;
  end loop;

  update public.rooms
  set results = next_results, state = 'results', updated_at = now()
  where code = target_room.code
  returning * into target_room;
  return target_room;
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-expired-printwithai-rooms',
  '* * * * *',
  $$ delete from public.rooms where expires_at <= now() $$
);
