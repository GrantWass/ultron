/**
 * Normalize an error message into a stable fingerprint for grouping.
 * Strips all dynamic values: numbers, UUIDs, hex hashes, IPs, durations, ports.
 *
 * Examples:
 *   "Slow response: GET http://localhost:5001/friendships — 4982ms"
 *     → "Slow response: GET http://localhost:{n}/friendships — {n}ms"
 *
 *   "404: /users/12345/profile not found"
 *     → "{n}: /users/{n}/profile not found"
 *
 *   "Cannot read properties of undefined (reading 'userData')"
 *     → unchanged (no dynamic values)
 */
export function fingerprint(message: string): string {
  return message
    // UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
    // Hex hashes (≥8 chars) in path-like contexts
    .replace(/\/[0-9a-f]{8,}\b/gi, '/{hash}')
    // IPv4 addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '{ip}')
    // All remaining standalone numbers (IDs, durations, ports, status codes, etc.)
    .replace(/\b\d+\b/g, '{n}')
    // Collapse any double spaces left behind
    .replace(/\s{2,}/g, ' ')
    .trim()
}
