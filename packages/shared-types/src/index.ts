// Database row types

export interface Profile {
  id: string
  plan: 'free' | 'pro'
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  api_key: string
  created_at: string
}

export interface ErrorRecord {
  id: string
  project_id: string
  event_type: EventType
  message: string
  stack_trace: string | null
  url: string | null
  browser: string | null
  os: string | null
  viewport: string | null
  connection: string | null
  session_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  invited_email: string
  user_id: string | null
  role: 'member'
  status: 'pending' | 'accepted'
  token: string
  invited_at: string
  accepted_at: string | null
}

export interface GithubConnection {
  id: string
  project_id: string
  repo_owner: string
  repo_name: string
  access_token: string
  created_at: string
}

export interface FixSuggestion {
  id: string
  error_id: string
  suggestion: string
  relevant_files: RelevantFile[]
  created_at: string
}

export interface RelevantFile {
  path: string
  content: string
}

// SDK payload type — shared between tracker SDK and ingest route

export type EventType = 'error' | 'network' | 'vital' | 'resource_error'

export interface ErrorPayload {
  event_type: EventType
  message: string
  stack: string
  url: string
  browser: string
  os: string
  /** viewport_width:viewport_height:pixel_ratio */
  viewport: string
  /** e.g. "4g", "wifi", "unknown" */
  connection: string
  session_id: string
  metadata?: Record<string, unknown>
  timestamp: number
}

export interface IngestPayload {
  errors: ErrorPayload[]
  // api_key in body as fallback when sendBeacon is used (can't set headers)
  api_key?: string
}

// API response types

export interface PaginatedErrors {
  data: ErrorRecord[]
  total: number
  page: number
  limit: number
}

export interface ErrorWithCount extends ErrorRecord {
  count: number
  last_seen: string
  first_seen: string
}

// GitHub API response

export interface GitHubFileContent {
  path: string
  content: string
  encoding: string
}

// Fix request/response

export interface FixRequest {
  error_id: string
}
