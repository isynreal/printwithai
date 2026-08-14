import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const multiplayerConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = multiplayerConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null

export function normalizeRoom(row) {
  if (!row) return null
  return {
    code: row.code,
    name: row.name,
    host: row.host_name,
    hostId: row.host_id,
    count: Array.isArray(row.players) ? row.players.length : 0,
    players: Array.isArray(row.players) ? row.players : [],
    state: row.state,
    prompt: row.prompt || '',
    topic: row.state === 'lobby' ? '等待中' : '遊戲進行中',
  }
}

export async function listPublicRooms() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('rooms')
    .select('code,name,host_name,host_id,state,prompt,players,created_at')
    .eq('state', 'lobby')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data.map(normalizeRoom)
}

export async function createRemoteRoom(room, hostToken) {
  const { data, error } = await supabase.rpc('create_room', {
    p_code: room.code,
    p_name: room.name,
    p_host_id: room.hostId,
    p_host_name: room.host,
    p_host_token: hostToken,
    p_player: room.players[0],
  })
  if (error) throw error
  return normalizeRoom(data)
}

export async function joinRemoteRoom(code, player) {
  const { data, error } = await supabase.rpc('join_room', { p_code: code, p_player: player })
  if (error) throw error
  return normalizeRoom(data)
}

export async function updateRemoteRoom(code, hostToken, state, prompt = '') {
  const { data, error } = await supabase.rpc('host_update_room', {
    p_code: code,
    p_host_token: hostToken,
    p_state: state,
    p_prompt: prompt,
  })
  if (error) throw error
  return normalizeRoom(data)
}

export function subscribeToRooms(onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('public-room-list')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

export function subscribeToRoom(code, onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`room-${code}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` }, (event) => onChange(normalizeRoom(event.new)))
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
