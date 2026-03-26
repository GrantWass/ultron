import { initTracker, captureError } from '@ultron-dev/tracker'

// ============================================================
// ULTRON SDK INITIALIZATION
// Session replay starts immediately — every interaction on this
// page will be captured in the 30-second buffer before any error.
// ============================================================

console.log('%c[DEMO] ShopDemo starting up...', 'color: #6366f1; font-weight: bold; font-size: 14px')
console.log('[DEMO] Initializing Ultron SDK with session replay enabled')

const tracker = initTracker({
  apiKey: import.meta.env.VITE_ULTRON_API_KEY || 'ultrn_demo_key_replace_me',
  debug: true,
  reportAllVitals: true,
  slowRequestThreshold: 2000,
  sessionReplay: { bufferSeconds: 30 },
})

console.log('[DEMO] Ultron initialized — session replay is now recording this checkout flow')
console.log('[DEMO] SDK config:', {
  sessionReplay: true,
  bufferSeconds: 30,
  debug: true,
  reportAllVitals: true,
  slowRequestThreshold: '2000ms',
})

// ============================================================
// PAGE STATE MACHINE
// ============================================================

let currentPage = 'product'
let cartItems = 0

function showPage(id) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active', 'visible')
  })

  const page = document.getElementById(`page-${id}`)
  page.classList.add('active')

  // Trigger CSS transition on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      page.classList.add('visible')
    })
  })

  currentPage = id
}

// ============================================================
// PRODUCT PAGE
// ============================================================

console.log('[DEMO] Product page loaded', { product: 'Pro Developer Kit', price: 149, currency: 'USD' })
console.log('[DEMO] Fetching product details from API...')

// Simulate a successful product data fetch — visible in the Network tab
fetch('https://jsonplaceholder.typicode.com/posts/1')
  .then(res => res.json())
  .then(data => {
    console.log('[DEMO] Product API response received', { status: 200, productId: 'prod_001' })
  })
  .catch(err => {
    console.warn('[DEMO] Product API unavailable, using cached data', err.message)
  })

// Thumbnail switching
document.querySelectorAll('.thumb').forEach((thumb, i) => {
  thumb.addEventListener('click', () => {
    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'))
    thumb.classList.add('active')
    const sources = [
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80',
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80',
    ]
    document.querySelector('.product-image').src = sources[i]
  })
})

// Add to Cart
document.getElementById('add-to-cart').addEventListener('click', async () => {
  const btn = document.getElementById('add-to-cart')
  btn.textContent = 'Adding...'
  btn.disabled = true

  console.log('%c[DEMO] User clicked "Add to Cart"', 'color: #10b981; font-weight: bold')
  console.log('[DEMO] Adding item to cart', { productId: 'prod_001', name: 'Pro Developer Kit', price: 149, quantity: 1 })
  console.log('[DEMO] Fetching cart totals from API...')

  // Simulate cart API call — visible in Network tab as a successful request
  try {
    const res = await fetch('https://jsonplaceholder.typicode.com/posts/2')
    const data = await res.json()
    console.log('[DEMO] Cart API response', { status: 200, items: 1, subtotal: 149, discount: 50 })
  } catch (err) {
    console.warn('[DEMO] Cart API unavailable, continuing with local state')
  }

  // Update cart badge
  cartItems = 1
  const badge = document.getElementById('cart-badge')
  badge.style.display = 'flex'
  document.getElementById('cart-count').textContent = cartItems

  // Transition to checkout
  setTimeout(() => {
    console.log('[DEMO] Transitioning to checkout page')
    showPage('checkout')
  }, 400)
})

// ============================================================
// CHECKOUT PAGE
// ============================================================

// Auto-fill each field individually on click
const autoFillValues = {
  'field-name':    'John Smith',
  'field-email':   'john@example.com',
  'field-card':    '4242 4242 4242 4242',
  'field-expiry':  '12 / 27',
  'field-cvv':     '123',
  'field-address': '123 Main St, San Francisco, CA 94102',
}
Object.entries(autoFillValues).forEach(([id, value]) => {
  document.getElementById(id).addEventListener('focus', (e) => {
    if (!e.target.value) e.target.value = value
  })
})

// Card number formatting
document.getElementById('field-card').addEventListener('input', (e) => {
  let val = e.target.value.replace(/\D/g, '').substring(0, 16)
  val = val.replace(/(.{4})/g, '$1 ').trim()
  e.target.value = val
})

// Expiry formatting
document.getElementById('field-expiry').addEventListener('input', (e) => {
  let val = e.target.value.replace(/\D/g, '').substring(0, 4)
  if (val.length >= 2) val = val.substring(0, 2) + ' / ' + val.substring(2)
  e.target.value = val
})

// Place Order — the key interaction that triggers the error
document.getElementById('place-order').addEventListener('click', async () => {
  const name = document.getElementById('field-name').value
  const email = document.getElementById('field-email').value
  const card = document.getElementById('field-card').value
  const expiry = document.getElementById('field-expiry').value
  const cvv = document.getElementById('field-cvv').value

  // Show loading state
  document.getElementById('place-order-text').textContent = 'Processing...'
  document.getElementById('place-order-spinner').style.display = 'inline-block'
  document.getElementById('place-order').disabled = true

  console.log('%c[DEMO] User clicked "Place Order"', 'color: #f59e0b; font-weight: bold')
  console.log('[DEMO] Checkout form submitted', {
    name: name || 'John Smith',
    email: email || 'john@example.com',
    cardLast4: card ? card.slice(-4) : '4242',
    hasExpiry: !!expiry,
    hasCvv: !!cvv,
  })
  console.log('[DEMO] Calling POST /api/checkout — payment processing...')
  console.log('[DEMO] Watch the Network tab: this request will fail with 500')

  try {
    // This request intentionally returns 500 — Ultron will capture it as a network error
    const res = await fetch('https://httpbin.org/status/500', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 14900,
        currency: 'usd',
        card_token: 'tok_demo_' + Date.now(),
        idempotency_key: 'ord_' + Math.random().toString(36).slice(2),
      }),
    })

    if (!res.ok) {
      console.error('[DEMO] Payment API returned', res.status, '— throwing payment error')
      // This throw is the key error: it's an uncaught error in the async handler,
      // which Ultron captures via window.addEventListener('unhandledrejection')
      throw new Error(`Payment processing failed: server returned ${res.status}`)
    }
  } catch (err) {
    // Reset button state
    document.getElementById('place-order-text').textContent = 'Place Order — $149'
    document.getElementById('place-order-spinner').style.display = 'none'
    document.getElementById('place-order').disabled = false

    const errorId = 'err_' + Math.random().toString(36).slice(2, 10)
    const orderId = 'ord_' + Date.now()

    console.error('[DEMO] Caught payment error:', err.message)
    console.log('[DEMO] Calling captureError() with full order context...')
    console.log('[DEMO] This error + the session replay will appear in your Ultron dashboard')

    // Manually capture with rich metadata — this is what shows up in the dashboard
    captureError(err, {
      userId: 'user_demo_42',
      userEmail: email || 'john@example.com',
      orderId,
      errorId,
      productId: 'prod_001',
      productName: 'Pro Developer Kit',
      cardLast4: card ? card.replace(/\s/g, '').slice(-4) : '4242',
      amount: 149,
      currency: 'USD',
      step: 'payment_processing',
      paymentGateway: 'stripe',
      checkoutDurationMs: Math.round(Math.random() * 15000 + 5000),
    })

    console.log('[DEMO] captureError() called — error queued. Ultron will flush to dashboard in ~5s.')
    console.log('[DEMO] Session replay snapshot will be attached to this error.')
    console.log('[DEMO] Error ID:', errorId, '| Order ID:', orderId)

    // Show error page
    document.getElementById('error-code-display').textContent = err.message
    document.getElementById('error-id').textContent = errorId
    showPage('error')
  }
})

// Try Again — go back to checkout
document.getElementById('try-again').addEventListener('click', () => {
  console.log('[DEMO] User clicked "Try Again" — returning to checkout')
  showPage('checkout')
  // Reset button state
  document.getElementById('place-order-text').textContent = 'Place Order — $149'
  document.getElementById('place-order-spinner').style.display = 'none'
  document.getElementById('place-order').disabled = false
})

// ============================================================
// INITIAL PAGE REVEAL
// ============================================================

// Slight delay so the page transition CSS is ready
setTimeout(() => {
  showPage('product')
  console.log('[DEMO] Ready. Ultron is recording. Click "Add to Cart" to begin the checkout flow.')
  console.log('[DEMO] Tip: open DevTools Network tab and filter by "Fetch/XHR" to watch requests')
}, 50)
