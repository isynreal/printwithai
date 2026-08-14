const CHANNEL_NAME = 'draw-ai-room-v1'

export function createGameBus(onMessage) {
  if (!('BroadcastChannel' in window)) return { send() {}, close() {} }
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (event) => onMessage(event.data)
  return {
    send: (message) => channel.postMessage(message),
    close: () => channel.close(),
  }
}
