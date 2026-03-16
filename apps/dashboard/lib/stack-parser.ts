/**
 * Parses a V8-style stack trace and extracts unique source file paths.
 * Skips node_modules, Next.js internals, and webpack bundles.
 * Returns at most 5 unique file paths.
 */
export function parseStackTrace(stackTrace: string): string[] {
  if (!stackTrace) return []

  const lines = stackTrace.split('\n')
  const paths = new Set<string>()

  for (const line of lines) {
    if (paths.size >= 5) break

    // Match patterns like:
    //   at Component (webpack-internal:///./src/app/page.tsx:42:10)
    //   at Module.default (/app/src/utils/helper.ts:12:5)
    //   at Object.<anonymous> (src/lib/api.ts:8:3)
    const match = line.match(/\(([^)]+)\)/) || line.match(/at\s+([^\s]+)/)
    if (!match) continue

    const location = match[1]

    // Extract just the file path (before the line:col)
    const fileMatch = location.match(/^([^:]+\.[jt]sx?)(?::\d+)?(?::\d+)?$/)
    if (!fileMatch) continue

    const filePath = fileMatch[1]

    // Skip internal/bundler paths
    if (
      filePath.includes('node_modules') ||
      filePath.includes('webpack-internal') ||
      filePath.includes('<anonymous>') ||
      filePath.includes('next/dist') ||
      filePath.startsWith('internal/') ||
      filePath.startsWith('node:')
    ) {
      continue
    }

    // Normalize: strip leading ./ or /
    const normalized = filePath.replace(/^\.\//, '').replace(/^\//, '')
    if (normalized) paths.add(normalized)
  }

  return Array.from(paths)
}

/**
 * Parse line numbers alongside file paths for richer context.
 */
export interface StackFrame {
  path: string
  line: number
}

export function parseStackFrames(stackTrace: string): StackFrame[] {
  if (!stackTrace) return []

  const lines = stackTrace.split('\n')
  const frames: StackFrame[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    if (frames.length >= 5) break

    const locationMatch = line.match(/\(([^)]+)\)/) || line.match(/at\s+([^\s]+:\d+:\d+)/)
    if (!locationMatch) continue

    const location = locationMatch[1]
    const frameMatch = location.match(/^([^:]+\.[jt]sx?):(\d+)(?::\d+)?$/)
    if (!frameMatch) continue

    const [, filePath, lineStr] = frameMatch

    if (
      filePath.includes('node_modules') ||
      filePath.includes('webpack-internal') ||
      filePath.includes('next/dist') ||
      filePath.startsWith('internal/') ||
      filePath.startsWith('node:')
    ) {
      continue
    }

    const normalized = filePath.replace(/^\.\//, '').replace(/^\//, '')
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    frames.push({ path: normalized, line: parseInt(lineStr, 10) })
  }

  return frames
}
