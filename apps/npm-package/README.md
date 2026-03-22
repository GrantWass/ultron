# @ultron-dev/tracker

Lightweight browser error tracking SDK for [Ultron](https://ultron.live) — zero dependencies, under 5kb gzipped.

## Installation

```bash
npm install @ultron-dev/tracker
```

## Quick start

```ts
import { initTracker } from '@ultron-dev/tracker'

initTracker({
  apiKey: 'ultrn_your_project_api_key',
})
```

Get your API key from your project settings at [ultron.live](https://ultron.live).

## What it captures automatically

- **JavaScript errors** — uncaught exceptions and unhandled promise rejections
- **Network failures** — failed or slow `fetch` / XHR requests
- **Web vitals** — LCP, CLS, INP, FCP, TTFB, FID
- **Resource errors** — failed `<script>`, `<img>`, `<link>` loads
- **Session replays** — rrweb recordings buffered around errors (opt-in)

## Configuration

```ts
initTracker({
  apiKey: string              // Required. Your project API key.
  reportAllVitals?: boolean   // Report all web vitals, not just poor ones. Default: false
  slowRequestThreshold?: number // ms above which a network request is flagged as slow. Default: 3000
  sessionReplay?: boolean | SessionReplayConfig // Enable session replay. Default: false
})
```

### Session replay

Pass `true` to use defaults, or an object to customise:

```ts
initTracker({
  apiKey: 'ultrn_...',
  sessionReplay: {
    bufferSeconds: 30, // Seconds of activity to buffer before an error. Default: 30
  },
})
```

## Manual capture

Use `captureError` to report errors outside of the automatic listeners (e.g. inside a React error boundary):

```ts
import { captureError } from '@ultron-dev/tracker'

captureError(new Error('Something went wrong'), {
  component: 'CheckoutForm',
  userId: '123',
})
```

## Framework examples

### React

```tsx
// app/layout.tsx or index.tsx
import { useEffect } from 'react'
import { initTracker } from '@ultron-dev/tracker'

useEffect(() => {
  initTracker({ apiKey: process.env.NEXT_PUBLIC_ULTRON_API_KEY! })
}, [])
```

### Next.js App Router

```tsx
// components/ultron-provider.tsx
'use client'
import { useEffect } from 'react'

export function UltronProvider() {
  useEffect(() => {
    import('@ultron-dev/tracker').then(({ initTracker }) => {
      initTracker({ apiKey: process.env.NEXT_PUBLIC_ULTRON_API_KEY! })
    })
  }, [])
  return null
}
```

### Vanilla JS / CDN

```html
<script type="module">
  import { initTracker } from 'https://esm.sh/@ultron-dev/tracker'
  initTracker({ apiKey: 'ultrn_...' })
</script>
```

## TypeScript

All types are exported:

```ts
import type { TrackerConfig, SessionReplayConfig } from '@ultron-dev/tracker'
```

## License

MIT
