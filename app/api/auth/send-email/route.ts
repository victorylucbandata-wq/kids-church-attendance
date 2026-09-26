import { verifyWebhook } from '@/app/lib/webhook-signature'

// Supabase Auth "Send Email" hook (plan 4.1). Supabase signs the request; this route checks
// the signature, builds the email, and hands it to n8n, which sends it through Gmail.
// Configure in Supabase: Authentication -> Hooks -> Send Email -> HTTPS -> <site>/api/auth/send-email

type HookPayload = {
  user: { email?: string }
  email_data: { token_hash: string; redirect_to: string; email_action_type: string; site_url: string }
}

const COPY: Record<string, { subject: string; heading: string; body: string; button: string }> = {
  magiclink: {
    subject: 'Your Kids Church sign-in link',
    heading: 'Sign in to Kids Church Check-In',
    body: 'Tap the button below to sign in. The link works once and expires within an hour.',
    button: 'Sign in',
  },
  invite: {
    subject: "You're invited to Kids Church Check-In",
    heading: "You've been invited to help with check-in",
    body: 'A kids ministry lead added you to their church on Kids Church Check-In. Tap below to accept and sign in.',
    button: 'Accept invite',
  },
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function render(copy: (typeof COPY)[string], link: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#eff6ff;font-family:Nunito,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fff;border:1px solid #dbeafe;border-radius:24px;padding:32px">
<tr><td style="font-size:24px;font-weight:900;padding-bottom:12px">${escape(copy.heading)}</td></tr>
<tr><td style="font-size:16px;line-height:1.6;color:#475569;padding-bottom:24px">${escape(copy.body)}</td></tr>
<tr><td><a href="${escape(link)}" style="display:inline-block;background:#1a6bd6;color:#fff;font-weight:900;font-size:16px;text-decoration:none;padding:14px 28px;border-radius:16px">${escape(copy.button)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#64748b;padding-top:24px">If you didn't ask for this, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`
  const text = `${copy.heading}\n\n${copy.body}\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`
  return { html, text }
}

// Supabase shows `message` to the caller when the hook fails.
const fail = (status: number, message: string) =>
  Response.json({ error: { http_code: status, message } }, { status })

export async function POST(request: Request) {
  const raw = await request.text()
  const ok = verifyWebhook(
    process.env.SEND_EMAIL_HOOK_SECRET,
    {
      id: request.headers.get('webhook-id'),
      timestamp: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'),
    },
    raw
  )
  if (!ok) return fail(401, 'Invalid signature')

  const { user, email_data } = JSON.parse(raw) as HookPayload
  const copy = COPY[email_data.email_action_type]
  if (!user.email || !copy) return fail(400, `Unsupported email type: ${email_data.email_action_type}`)

  // redirect_to is the app's /auth/confirm URL (checked by Supabase against its allow list).
  const confirm = new URL(email_data.redirect_to || `${email_data.site_url}/auth/confirm`)
  confirm.searchParams.set('token_hash', email_data.token_hash)
  confirm.searchParams.set('type', email_data.email_action_type)
  const { html, text } = render(copy, confirm.toString())

  const mailer = process.env.N8N_MAILER_WEBHOOK_URL
  const token = process.env.N8N_MAILER_TOKEN
  if (!mailer || !token) return fail(500, 'Email sending is not configured')

  try {
    const res = await fetch(mailer, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mailer-Token': token },
      body: JSON.stringify({ to: user.email, subject: copy.subject, html, text }),
      signal: AbortSignal.timeout(15_000),
    })
    // n8n can answer 200 even when a step failed; only its final "Reply sent" node says sent: true.
    const reply = (await res.json().catch(() => null)) as { sent?: boolean } | null
    if (!res.ok || reply?.sent !== true) return fail(502, 'Email was not sent (check the n8n mailer workflow)')
  } catch {
    return fail(502, 'Email service unreachable')
  }
  return Response.json({})
}
