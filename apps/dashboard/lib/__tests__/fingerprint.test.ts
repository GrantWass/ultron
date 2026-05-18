import { describe, it, expect } from 'vitest'
import { fingerprint } from '../fingerprint'

describe('fingerprint', () => {
  it('replaces UUIDs', () => {
    expect(fingerprint('Error for user 550e8400-e29b-41d4-a716-446655440000'))
      .toBe('Error for user {uuid}')
  })

  it('replaces standalone numbers', () => {
    expect(fingerprint('404: /users/12345/profile not found'))
      .toBe('{n}: /users/{n}/profile not found')
  })

  it('replaces duration-style numbers', () => {
    expect(fingerprint('Slow response: GET /api/data — 4982ms'))
      .toBe('Slow response: GET /api/data — {n}ms')
  })

  it('replaces IPv4 addresses', () => {
    expect(fingerprint('Connection refused to 192.168.1.100'))
      .toBe('Connection refused to {ip}')
  })

  it('replaces hex hashes in path-like contexts', () => {
    expect(fingerprint('GET /static/abc123def456/bundle.js failed'))
      .toBe('GET /static/{hash}/bundle.js failed')
  })

  it('leaves non-dynamic messages unchanged', () => {
    const msg = "Cannot read properties of undefined (reading 'userData')"
    expect(fingerprint(msg)).toBe(msg)
  })

  it('produces identical fingerprints for two errors that differ only by ID', () => {
    const a = fingerprint('User 111 not found')
    const b = fingerprint('User 999 not found')
    expect(a).toBe(b)
  })

  it('produces different fingerprints for structurally different messages', () => {
    const a = fingerprint('User not found')
    const b = fingerprint('Project not found')
    expect(a).not.toBe(b)
  })

  it('collapses double spaces left after substitution', () => {
    // "GET 404" → "GET {n}" — no double spaces introduced
    const result = fingerprint('status 404 returned')
    expect(result).not.toMatch(/\s{2,}/)
  })

  it('trims leading and trailing whitespace', () => {
    expect(fingerprint('  error message  ')).toBe('error message')
  })

  it('handles empty string', () => {
    expect(fingerprint('')).toBe('')
  })

  it('replaces port numbers in URLs', () => {
    expect(fingerprint('Slow response: GET http://localhost:5001/friendships — 4982ms'))
      .toBe('Slow response: GET http://localhost:{n}/friendships — {n}ms')
  })
})
