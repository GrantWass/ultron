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
 * Extract meaningful search keywords from an error message + stack trace.
 * Prioritises: property names in quotes, PascalCase identifiers (component/class names),
 * and function names from the top stack frames. Omits common generic identifiers and framework internals.
 * Returns at most 5 unique tokens, best for a GitHub code search query.
 */
const SKIP_IDENTIFIERS = new Set([
  // JS primitives / error types
  'Error', 'TypeError', 'Cannot', 'ReferenceError', 'SyntaxError', 'RangeError',
  'EvalError', 'URIError', 'AggregateError',
  'anonymous', 'default', 'undefined', 'null', 'true', 'false', 'Object', 'Array',
  'Promise', 'then', 'catch', 'finally', 'resolve', 'reject',

  // Generic browser event handlers
  'onClick', 'onChange', 'onSubmit', 'onLoad', 'onError', 'onFocus', 'onBlur',
  'onKeyDown', 'onKeyUp', 'onMouseDown', 'onMouseUp', 'onMouseMove', 'onScroll',
  'onInput', 'onReset', 'onSelect', 'onPointerDown', 'onPointerUp',
  'addEventListener', 'removeEventListener', 'dispatchEvent',

  // React / React DOM internals
  'executeDispatch', 'runWithFiberInDEV', 'processDispatchQueue',
  'batchedUpdates', 'dispatchDiscreteEvent', 'dispatchEventForPluginEventSystem',
  'commitRoot', 'commitWork', 'commitMutationEffects', 'commitLayoutEffects',
  'commitPassiveEffects', 'invokePassiveEffectCreate',
  'renderWithHooks', 'updateFunctionComponent', 'updateClassComponent',
  'reconcileChildren', 'reconcileChildFibers', 'createFiberFromElement',
  'performSyncWorkOnRoot', 'performConcurrentWorkOnRoot', 'performUnitOfWork',
  'workLoopSync', 'workLoopConcurrent', 'flushPassiveEffects', 'flushSyncCallbackQueue',
  'callCallback', 'invokeGuardedCallback', 'invokeGuardedCallbackDev',
  'unstable_scheduleCallback', 'flushWork', 'workLoop',
  'createElement', 'cloneElement', 'createContext', 'forwardRef', 'memo',
  'useState', 'useEffect', 'useLayoutEffect', 'useReducer', 'useCallback',
  'useMemo', 'useRef', 'useContext', 'useImperativeHandle',

  // Next.js internals
  'AppRouter', 'ClientRouter', 'ServerRouter', 'renderToString',
  'clientComponentLoadingModuleProxy', 'hydrate', 'hydrateRoot',

  // Vue 3 internals
  'callWithErrorHandling', 'callWithAsyncErrorHandling',
  'mountComponent', 'updateComponent', 'renderComponentRoot',
  'normalizeVNode', 'createVNode', 'patch', 'nextTick',
  'createApp', 'defineComponent',

  // Svelte internals
  'create_component', 'mount_component', 'destroy_component', 'create_fragment',
  'flush', 'schedule_update', 'dirty_components',

  // Angular internals
  'checkAndUpdateView', 'detectChangesInternal', 'callViewAction',
  'execComponentViewsAction', 'execEmbeddedViewsAction',

  // Webpack / bundler runtime
  'webpackJsonpCallback', 'requireModule', 'hotApply',

  // Node / runtime internals
  'Module._compile', 'processTicksAndRejections', 'AsyncLocalStorage',
])

export function extractSearchKeywords(message: string, stackTrace: string): string[] {
  const keywords = new Set<string>()

  // 1. "X is not a function" — X is the most useful search term
  const notFnMatch = message.match(/([a-zA-Z_$][a-zA-Z0-9_$.]{2,})\s+is not a function/)
  if (notFnMatch) keywords.add(notFnMatch[1].split('.').pop()!)

  // 2. Property name from runtime errors: (reading 'propName') or ['propName']
  const readingMatch = message.match(/\breading\s+['"]([a-zA-Z_$][a-zA-Z0-9_$]{2,})['"]/i)
  if (readingMatch) keywords.add(readingMatch[1])

  const bracketMatch = message.match(/\[['"]([a-zA-Z_$][a-zA-Z0-9_$]{2,})['"]\]/)
  if (bracketMatch) keywords.add(bracketMatch[1])

  // 3. PascalCase words in message — likely component/class names
  const pascalWords = message.match(/\b[A-Z][a-zA-Z0-9]{2,}\b/g) ?? []
  for (const w of pascalWords) {
    if (!SKIP_IDENTIFIERS.has(w)) keywords.add(w)
  }

  // 4. Top stack frames: prefer non-generic camelCase/PascalCase function names
  const stackLines = stackTrace.split('\n').slice(0, 15)
  for (const line of stackLines) {
    if (keywords.size >= 5) break

    // "at FunctionName" or "at FunctionName.method" — PascalCase = component/class
    const pascalFn = line.match(/\bat\s+([A-Z][a-zA-Z0-9]{2,})(?:[.(]|\s)/)
    if (pascalFn && !SKIP_IDENTIFIERS.has(pascalFn[1])) { keywords.add(pascalFn[1]); continue }

    // "at object.methodName" — longer camelCase methods from app code
    const dotFn = line.match(/\bat\s+(?:\w+\.)+([a-zA-Z_$][a-zA-Z0-9_$]{5,})\s/)
    if (dotFn && !SKIP_IDENTIFIERS.has(dotFn[1])) keywords.add(dotFn[1])
  }

  return Array.from(keywords).slice(0, 5)
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
