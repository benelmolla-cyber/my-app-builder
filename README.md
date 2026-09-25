# Sparky AI

Sparky is a mobile-first, dark creative studio for real AI image and short-video generation. Authentication and private data are backed by Supabase, generation runs through Replicate, and recurring billing uses Stripe Checkout and verified webhooks.

## Product rules

- New accounts receive **12 trial credits** and a trial end date seven days after signup.
- Images cost **1 credit** and videos cost **10 credits**. The database reserves credits atomically before contacting Replicate and refunds them if generation fails.
- Every successfully paid subscription invoice grants **100 credits**. Stripe event IDs make grants idempotent.
- The email in `OWNER_EMAIL` has unlimited **app credits**. This is checked only by the server and does **not** make Replicate usage free—the owner still incurs provider charges for every generation.
- Sparky never fakes a completed generation or payment. Provider and billing errors are shown as errors.

## Accounts and settings required before launch

1. **Supabase:** create a project, run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor, enable Email auth, choose whether email confirmation is required, and set the Site URL plus redirect URLs to the production domain. Copy the URL, anon key, and service-role key.
2. **Replicate:** create an account with billing enabled and an API token. Confirm the configured image and video models are available in your region/account and review their current pricing and safety policies.
3. **Stripe:** create a recurring product/price (the interval is your choice), copy its price ID, and add a webhook endpoint at `https://YOUR_DOMAIN/api/stripe-webhook`. Subscribe it to `invoice.paid`, `customer.subscription.updated`, and `customer.subscription.deleted`; copy the signing secret.
4. **Owner:** set `OWNER_EMAIL` to the exact, confirmed Supabase login email. Owner access only bypasses Sparky credit deductions; it does not remove Replicate costs.
5. **Vercel:** import this repository, keep the root directory as-is, add every variable from `.env.example` for Production (use test Stripe keys in Preview), and set `APP_URL` to the canonical HTTPS URL.
6. Add production legal pages, moderation/acceptable-use rules, support contact, custom domain, transactional email/SMTP, monitoring, rate limiting/WAF, and a retention/deletion policy before accepting public traffic.

## Local setup

```bash
npm install
cp .env.example .env.local
# Fill in test/sandbox credentials only
npm run dev
```

Forward Stripe test events while developing:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Use Stripe test mode and a non-production Replicate account. Automated tests mock provider calls; they do not make paid API calls.

## Security notes

The browser receives only the Supabase anon key. Service-role, Replicate, and Stripe secrets remain in serverless functions. API requests validate the Supabase access token server-side. Row Level Security prevents users from reading another user's profile or generations, while all balance mutations require the service role and execute as locked database transactions.

Replicate output URLs are stored in the private database, but provider-hosted URLs may themselves be publicly reachable. For stronger retention/privacy guarantees, copy successful outputs into a private Supabase Storage bucket and issue signed URLs.
