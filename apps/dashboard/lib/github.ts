import { decrypt } from './crypto'
import type { RelevantFile } from '@ultron/types'

const GITHUB_API = 'https://api.github.com'

export function getGitHubOAuthUrl(csrfToken: string): string {
  const state = Buffer.from(csrfToken).toString('base64url')
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_REDIRECT_URI!,
    scope: 'repo',
    state,
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

export function parseOAuthState(state: string): { csrfToken: string } | null {
  try {
    return { csrfToken: Buffer.from(state, 'base64url').toString('utf8') }
  } catch {
    return null
  }
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    }),
  })

  const data = await response.json() as { access_token?: string; error?: string }
  if (data.error || !data.access_token) {
    throw new Error(data.error ?? 'Failed to exchange code for token')
  }

  return data.access_token
}

/**
 * Search a repo for files matching a keyword query, then fetch their contents.
 * Used as a fallback when no file paths can be parsed from the stack trace.
 */
export async function searchAndFetchGitHubFiles(
  encryptedToken: string,
  owner: string,
  repo: string,
  keywords: string[],
  maxFiles = 3,
): Promise<RelevantFile[]> {
  const token = decrypt(encryptedToken)

  if (keywords.length === 0) return []

  const q = encodeURIComponent(`${keywords.join(' ')} repo:${owner}/${repo}`)
  const searchRes = await fetch(`${GITHUB_API}/search/code?q=${q}&per_page=${maxFiles}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!searchRes.ok) return []

  const { items } = await searchRes.json() as { items: { path: string }[] }
  if (!items?.length) return []

  const paths = items.slice(0, maxFiles).map((item) => item.path)
  return fetchGitHubFiles(encryptedToken, owner, repo, paths)
}

export async function fetchGitHubFiles(
  encryptedToken: string,
  owner: string,
  repo: string,
  filePaths: string[]
): Promise<RelevantFile[]> {
  const token = decrypt(encryptedToken)
  const files: RelevantFile[] = []

  const fetchPromises = filePaths.slice(0, 5).map(async (path) => {
    try {
      const response = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )

      if (!response.ok) return null

      const data = await response.json() as {
        content: string
        encoding: string
        path: string
      }

      if (data.encoding !== 'base64') return null

      const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8')
      return { path: data.path, content }
    } catch {
      return null
    }
  })

  const results = await Promise.all(fetchPromises)
  for (const result of results) {
    if (result) files.push(result)
  }

  return files
}
