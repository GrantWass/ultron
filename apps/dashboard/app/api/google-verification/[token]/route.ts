export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const expected = process.env.GOOGLE_VERIFICATION_TOKEN

  if (!expected || params.token !== expected) {
    return new Response('Not Found', { status: 404 })
  }

  return new Response(`google${params.token}`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}
