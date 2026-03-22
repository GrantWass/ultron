import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Stripe webhook verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const service = createServiceRoleClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId   = session.metadata?.user_id
      if (!userId) break

      await service.from('profiles').update({
        plan:                    'pro',
        stripe_customer_id:      session.customer as string,
        stripe_subscription_id:  session.subscription as string,
      }).eq('id', userId)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await service.from('profiles').update({
        plan:                   'free',
        stripe_subscription_id: null,
      }).eq('stripe_subscription_id', sub.id)
      break
    }

    case 'customer.subscription.updated': {
      const sub    = event.data.object as Stripe.Subscription
      const active = sub.status === 'active' || sub.status === 'trialing'
      await service.from('profiles').update({
        plan: active ? 'pro' : 'free',
        ...(active ? {} : { stripe_subscription_id: null }),
      }).eq('stripe_subscription_id', sub.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
