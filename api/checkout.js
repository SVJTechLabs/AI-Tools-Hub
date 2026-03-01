// ============================================================
// SVJ AI Tools — Stripe Checkout Session API
// Vercel Serverless Function: /api/checkout
//
// Setup Instructions:
//   1. Add STRIPE_SECRET_KEY to Vercel env vars (Dashboard → Settings → Environment Variables)
//      Use sk_test_... for testing, sk_live_... for production
//   2. Create a Product + Price in Stripe Dashboard ($9.99/month recurring)
//   3. Replace STRIPE_PRICE_ID below with your actual Price ID (price_...)
//   4. Update SUCCESS_URL and CANCEL_URL to match your deployed domain
// ============================================================

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_REPLACE_WITH_YOUR_PRICE_ID';
const SUCCESS_URL = process.env.SITE_URL
  ? `${process.env.SITE_URL}/?success=1`
  : 'https://ai-tools-hub-beta.vercel.app/?success=1';
const CANCEL_URL = process.env.SITE_URL
  ? `${process.env.SITE_URL}/?canceled=1`
  : 'https://ai-tools-hub-beta.vercel.app/?canceled=1';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe is not configured. Please contact support.' });
  }

  try {
    const { priceId } = req.body;
    const resolvedPriceId = (priceId && priceId !== 'STRIPE_PRICE_ID_PLACEHOLDER')
      ? priceId
      : STRIPE_PRICE_ID;

    // Create Stripe Checkout Session via REST API (no npm package needed)
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': resolvedPriceId,
      'line_items[0][quantity]': '1',
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      'payment_method_types[0]': 'card',
      'billing_address_collection': 'auto',
      'allow_promotion_codes': 'true',
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      throw new Error(session.error?.message || 'Failed to create checkout session');
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[Stripe Checkout Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
