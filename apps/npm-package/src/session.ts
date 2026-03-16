const SESSION_KEY = '__ultron_sid__'

function generateUUID(): string {
  // RFC 4122 v4 UUID without crypto dependency
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

let cachedSessionId: string | null = null

export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId

  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      cachedSessionId = stored
      return stored
    }
    const id = generateUUID()
    sessionStorage.setItem(SESSION_KEY, id)
    cachedSessionId = id
    return id
  } catch {
    // sessionStorage not available (e.g., private browsing restrictions)
    if (!cachedSessionId) cachedSessionId = generateUUID()
    return cachedSessionId
  }
}
