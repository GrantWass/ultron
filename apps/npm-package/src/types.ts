export interface SessionReplayConfig {
  /** Seconds of activity to buffer before an error. Default: 60 */
  bufferSeconds?: number
  /** Mask all input field values. Default: true */
  maskAllInputs?: boolean
}

export interface TrackerConfig {
  apiKey: string
  debug?: boolean
  /** Report all web vitals, not just poor ones. Default: false */
  reportAllVitals?: boolean
  /** Threshold in ms above which a network request is flagged as slow. Default: 3000 */
  slowRequestThreshold?: number
  /**
   * Enable session replay. Lazily loads rrweb (peer dependency) only when set.
   * Pass `true` for defaults or an object to customise.
   */
  sessionReplay?: boolean | SessionReplayConfig
}

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
  /** Set when sessionReplay is enabled — links this event to a recording. */
  session_recording_id?: string
  metadata?: Record<string, unknown>
  timestamp: number
}

export interface IngestBody {
  errors: ErrorPayload[]
  api_key?: string
}
