import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

/** The Stripe Price ID for the Pro monthly subscription */
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID!
