export function getOS(ua: string): string {
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Linux/.test(ua)) return 'Linux'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  return 'Unknown'
}

export function getBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera\//.test(ua)) return 'Opera'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  return 'Unknown'
}

/** Returns "width:height:pixelRatio" e.g. "1440:900:2" */
export function getViewport(): string {
  try {
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = Math.round(window.devicePixelRatio ?? 1)
    return `${w}:${h}:${dpr}`
  } catch {
    return ''
  }
}

/** Returns connection type: "4g" | "3g" | "2g" | "slow-2g" | "wifi" | "unknown" */
export function getConnection(): string {
  try {
    // navigator.connection is not universally available
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string; type?: string }
    }
    const conn = nav.connection
    if (!conn) return 'unknown'
    // type is more descriptive when available (e.g. "wifi", "cellular")
    return conn.type ?? conn.effectiveType ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
