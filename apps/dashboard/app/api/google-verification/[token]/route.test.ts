import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GET } from './route'

const TOKEN = 'abc123XYZ_-token'

async function get(token: string) {
  return GET(new Request('https://ultron.live/google' + token + '.html'), {
    params: { token },
  })
}

describe('GET /api/google-verification/[token]', () => {
  const original = process.env.GOOGLE_VERIFICATION_TOKEN

  beforeEach(() => {
    process.env.GOOGLE_VERIFICATION_TOKEN = TOKEN
  })

  afterEach(() => {
    if (original === undefined) delete process.env.GOOGLE_VERIFICATION_TOKEN
    else process.env.GOOGLE_VERIFICATION_TOKEN = original
  })

  it('returns the bare google<token> string as text/plain on match', async () => {
    const res = await get(TOKEN)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/plain')
    expect(await res.text()).toBe('google' + TOKEN)
  })

  it('returns 404 when the token does not match', async () => {
    const res = await get('wrong-token')
    expect(res.status).toBe(404)
  })

  it('returns 404 when GOOGLE_VERIFICATION_TOKEN is unset', async () => {
    delete process.env.GOOGLE_VERIFICATION_TOKEN
    const res = await get(TOKEN)
    expect(res.status).toBe(404)
  })
})
