import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Zap, AlertCircle, Wifi, Activity, Wand2,
  ArrowRight, Check, Package, Clock,
} from 'lucide-react'

export default async function RootPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const loggedIn = !!session

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Zap className="h-4 w-4 text-primary" />
          Ultron
        </div>
        <div className="flex items-center gap-4">
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link
                href="/login"
                className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Now with AI fix suggestions
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-center leading-[1.1] mb-6">
            Know what broke.<br />
            <span className="text-primary">Know how to fix it.</span>
          </h1>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-10 leading-relaxed">
            Lightweight error monitoring for indie devs and small teams. Catch JS errors,
            slow network requests, and web vitals — then let AI tell you exactly how to fix them.
            Paste 3 lines and you're live.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 mb-16 flex-wrap">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-xs text-muted-foreground">No credit card. No setup fee.</span>
          </div>

          {/* Dashboard mock */}
          <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden max-w-4xl mx-auto">
            {/* Mock browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/30">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
              <span className="mx-auto text-xs text-muted-foreground font-mono">ultron.dev/dashboard</span>
            </div>

            {/* Mock sidebar + content */}
            <div className="flex h-[340px]">
              {/* Sidebar */}
              <div className="w-40 border-r border-border bg-muted/20 p-3 shrink-0 hidden sm:block">
                <div className="flex items-center gap-1.5 mb-4 text-xs font-semibold">
                  <Zap className="h-3 w-3 text-primary" />
                  Ultron
                </div>
                <div className="space-y-0.5">
                  <div className="rounded px-2 py-1.5 text-xs bg-accent text-accent-foreground flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3" /> my-app
                  </div>
                  <div className="rounded px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3" /> api-server
                  </div>
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Error list */}
                <div className="flex-1 divide-y divide-border overflow-auto">
                  {/* Error row 1 — JS error */}
                  <div className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 shrink-0">error</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono font-medium truncate">TypeError: Cannot read properties of undefined (reading 'name')</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">/dashboard/profile · Chrome · 2s ago</p>
                      </div>
                    </div>
                  </div>

                  {/* Error row 2 — network */}
                  <div className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 shrink-0">network</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono font-medium truncate">Server error 503 (Service Unavailable): GET /trips/deferred-ids — 30,217ms</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">/trips · Safari · 4m ago · slow</p>
                      </div>
                    </div>
                  </div>

                  {/* Error row 3 — vital */}
                  <div className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 shrink-0">vital</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono font-medium truncate">LCP 4821ms (poor)</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">img#hero · navigate · ttfb: 842ms · 12m ago</p>
                      </div>
                    </div>
                  </div>

                  {/* Error row 4 — resource */}
                  <div className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 shrink-0">resource</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono font-medium truncate">Failed to load: /fonts/brand-display.woff2</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">/landing · Firefox · 18m ago</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI fix panel */}
                <div className="border-t border-border bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Wand2 className="h-3 w-3 text-primary" />
                    <span className="text-[11px] font-medium text-primary">AI Fix Suggestion</span>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                    The <span className="text-foreground bg-muted rounded px-1">user</span> object may be null during initial render. Add optional chaining:{' '}
                    <span className="text-foreground bg-muted rounded px-1">user?.profile?.name</span> or guard with an early return.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3-line integration ───────────────────────────────────────────── */}
      <section className="py-16 px-6 border-y border-border bg-muted/20">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Setup in under 60 seconds</p>
          <pre className="text-left text-sm font-mono bg-background border border-border rounded-lg p-5 overflow-x-auto leading-relaxed shadow-sm">
            <span className="text-muted-foreground">{`# 1. install`}</span>{'\n'}
            {'npm install @ultron-dev/tracker\n\n'}
            <span className="text-muted-foreground">{`# 2. drop in 3 lines`}</span>{'\n'}
            <span className="text-primary">{'import'}</span>{' { initTracker } '}<span className="text-primary">{'from'}</span>{' '}<span className="text-green-600 dark:text-green-400">{`'@ultron-dev/tracker'`}</span>{'\n\n'}
            {'initTracker({\n'}
            {'  apiKey: '}<span className="text-green-600 dark:text-green-400">{`'your-api-key'`}</span>{',\n'}
            {'  endpoint: '}<span className="text-green-600 dark:text-green-400">{`'https://yourapp.com'`}</span>{',\n'}
            {'})\n\n'}
            <span className="text-muted-foreground">{`# 3. that's it`}</span>
          </pre>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Everything you need. Nothing you don't.</h2>
          <p className="text-muted-foreground text-center mb-12 text-sm max-w-xl mx-auto">
            Most error tools were built for enterprise teams. Ultron was built for the developer actually shipping the code.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: <AlertCircle className="h-5 w-5 text-red-500" />,
                title: 'JS Error Tracking',
                desc: 'Automatic capture of unhandled errors and promise rejections — with full stack traces, device, browser, and session context.',
                color: 'border-red-200 dark:border-red-900/50',
              },
              {
                icon: <Wifi className="h-5 w-5 text-orange-500" />,
                title: 'Network Monitoring',
                desc: 'Every slow or failed fetch and XHR request captured automatically. Status codes, response bodies, timing breakdown, query params.',
                color: 'border-orange-200 dark:border-orange-900/50',
              },
              {
                icon: <Activity className="h-5 w-5 text-purple-500" />,
                title: 'Web Vitals',
                desc: 'LCP, FCP, CLS, INP and TTFB tracked out of the box. Pinpoint the exact element causing slowness, including navigation type and load time.',
                color: 'border-purple-200 dark:border-purple-900/50',
              },
              {
                icon: <Wand2 className="h-5 w-5 text-primary" />,
                title: 'AI Fix Suggestions',
                desc: 'Don\'t just see the error — know how to fix it. Connect your GitHub repo and Claude reads your actual source code to give you a real fix.',
                color: 'border-blue-200 dark:border-blue-900/50',
              },
            ].map(({ icon, title, desc, color }) => (
              <div key={title} className={`rounded-xl border ${color} bg-card p-5 space-y-3`}>
                <div className="flex items-center gap-2">
                  {icon}
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why not Sentry ───────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-y border-border bg-muted/20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Why not just use Sentry?</h2>
          <p className="text-muted-foreground text-center mb-10 text-sm">
            Sentry is powerful — and that's the problem. You want errors fixed, not a second job managing dashboards.
          </p>

          <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {/* Header */}
            <div className="bg-muted/50 px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sentry / others</div>
            <div className="bg-primary/10 px-5 py-3 text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> Ultron
            </div>
            {[
              ['Complex setup with source maps, releases, DSN config', '3 lines of code, live in 60 seconds'],
              ['50–200kb SDK that slows your app', 'Lightweight bundle, minimal overhead'],
              ['Alerts with no guidance', 'AI fix suggestions tied to your source code'],
              ['$26–$80+/mo for small teams', 'Simple, affordable pricing'],
              ['Overwhelming UI built for enterprise', 'Clean dashboard built for developers'],
              ['JS errors only (or pay more)', 'Errors + network + vitals in one'],
            ].map(([them, us], i) => (
              <>
                <div key={`them-${i}`} className="bg-background px-5 py-3 text-xs text-muted-foreground border-t border-border flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">✕</span> {them}
                </div>
                <div key={`us-${i}`} className="bg-primary/5 px-5 py-3 text-xs text-foreground border-t border-border flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" /> {us}
                </div>
              </>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">From zero to monitored in 3 steps</h2>

          <div className="space-y-6">
            {[
              {
                n: '1',
                icon: <Package className="h-4 w-4" />,
                title: 'Install the package',
                desc: 'One npm install. Works with Next.js, React, Vue, SvelteKit, and plain JavaScript.',
                code: 'npm install @ultron-dev/tracker',
              },
              {
                n: '2',
                icon: <Zap className="h-4 w-4" />,
                title: 'Add 3 lines to your app',
                desc: 'Call initTracker once at startup. No config files, no build steps, no source map uploads.',
                code: `initTracker({ apiKey: '...', endpoint: '...' })`,
              },
              {
                n: '3',
                icon: <Clock className="h-4 w-4" />,
                title: 'Watch errors roll in (and get fixed)',
                desc: 'Open your dashboard. See errors in real time with device, session, and network context. Hit "Fix" and let AI do the thinking.',
                code: null,
              },
            ].map(({ n, icon, title, desc, code }) => (
              <div key={n} className="flex gap-5">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                    {n}
                  </div>
                  {n !== '3' && <div className="w-px flex-1 bg-border min-h-[2rem]" />}
                </div>
                <div className="pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    {icon}
                    <h3 className="text-sm font-semibold">{title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{desc}</p>
                  {code && (
                    <pre className="text-xs font-mono bg-muted/50 border border-border rounded-md px-3 py-2 inline-block">
                      {code}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-border bg-muted/10">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="flex justify-center">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Start catching bugs today.</h2>
          <p className="text-muted-foreground text-sm">
            Free to start. No credit card. No complex setup.<br />
            Just paste 3 lines and know the moment something breaks.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            Ultron
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Get started</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
