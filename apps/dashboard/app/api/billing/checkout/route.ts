import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { stripe, STRIPE_PRO_PRICE_ID } from '@/lib/stripe'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceRoleClient()

  // Ensure profile row exists
  await service.from('profiles').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })

  // Get existing Stripe customer ID if any
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_customer_id, plan')
    .eq('id', user.id)
    .single()

  if (profile?.plan === 'pro') {
    return NextResponse.json({ error: 'Already on Pro' }, { status: 400 })
  }

  const origin = new URL(request.url).origin

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    ...(profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: user.email ?? undefined }),
    line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/dashboard/settings?billing=success`,
    cancel_url:  `${origin}/dashboard/settings?billing=cancelled`,
    metadata: { user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
