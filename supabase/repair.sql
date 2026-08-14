-- Run this once if schema.sql was executed before the permissions/search-path fix.
grant select on table public.rooms to anon, authenticated;

alter function public.create_room(text, text, text, text, text, jsonb)
  set search_path = public, extensions;

alter function public.join_room(text, jsonb)
  set search_path = public, extensions;

alter function public.host_update_room(text, text, text, text)
  set search_path = public, extensions;
