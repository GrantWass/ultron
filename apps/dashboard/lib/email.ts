import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = "Ultron <noreply@ultron.live>"

export async function sendInviteEmail({
  to,
  inviterEmail,
  projectName,
  inviteUrl,
}: {
  to: string
  inviterEmail: string
  projectName: string
  inviteUrl: string
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterEmail} invited you to ${projectName} on Ultron`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px">
          <span style="font-size:18px;font-weight:700">⚡ Ultron</span>
        </div>

        <h1 style="font-size:20px;font-weight:700;margin:0 0 8px">You've been invited</h1>
        <p style="color:#64748b;margin:0 0 24px;font-size:15px;line-height:1.6">
          <strong>${inviterEmail}</strong> has invited you to view error logs for
          <strong>${projectName}</strong> on Ultron.
        </p>

        <a href="${inviteUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none">
          Accept invitation
        </a>

        <p style="color:#94a3b8;font-size:12px;margin-top:32px;line-height:1.6">
          If you weren't expecting this invitation, you can ignore this email.<br>
          This link expires in 7 days.
        </p>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:12px;margin:0">
          <a href="https://ultron.live" style="color:#94a3b8">ultron.live</a>
        </p>
      </div>
    `,
  })
}
