function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function brand() {
  return {
    appName: 'FundiHub',
    primary: '#f97316',
    bg: '#0b1220',
    card: '#ffffff',
    text: '#0f172a',
    muted: '#64748b',
  };
}

function layout({ title, preheader, bodyHtml }) {
  const b = brand();
  const safeTitle = escapeHtml(title);
  const safePre = escapeHtml(preheader || '');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:${b.bg};font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePre}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${b.bg};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
            <tr>
              <td style="padding:0 0 16px 0;">
                <div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:0.2px;">
                  <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:${b.primary};margin-right:10px;">🛠</span>
                  ${escapeHtml(b.appName)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:${b.card};border-radius:18px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,0.25);">
                <div style="font-size:20px;font-weight:800;color:${b.text};margin:0 0 8px 0;">${safeTitle}</div>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 4px 0 4px;color:rgba(255,255,255,0.7);font-size:12px;line-height:18px;">
                If you didn’t request this, you can ignore this email.
                <div style="margin-top:8px;">© ${new Date().getFullYear()} ${escapeHtml(b.appName)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function otpEmail({ code, purpose = 'register', toEmail, name = '' }) {
  const prettyPurpose =
    purpose === 'fundi_approval' ? 'Fundi Approval' : purpose === 'register' ? 'Account Verification' : 'Verification';
  const preheader = `Your OTP code is ${code}. It expires in 10 minutes.`;

  const bodyHtml = `
    <div style="color:${brand().muted};font-size:14px;line-height:20px;margin-bottom:16px;">
      Hi ${escapeHtml(name || 'there')},<br/>
      Use the OTP below to complete <strong>${escapeHtml(prettyPurpose)}</strong>.
    </div>
    <div style="text-align:center;margin:18px 0 10px 0;">
      <div style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px 18px;">
        <div style="font-size:12px;color:#9a3412;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">One-time password</div>
        <div style="font-size:34px;font-weight:900;letter-spacing:0.22em;color:#9a3412;">${escapeHtml(code)}</div>
      </div>
    </div>
    <div style="color:${brand().muted};font-size:13px;line-height:18px;margin-top:12px;">
      This code expires in <strong>10 minutes</strong> and can be used once.<br/>
      Requested for: <span style="color:${brand().text};font-weight:600;">${escapeHtml(toEmail || '')}</span>
    </div>
  `;

  const subject =
    purpose === 'fundi_approval'
      ? 'Your FundiHub approval OTP'
      : purpose === 'register'
        ? 'Your FundiHub verification OTP'
        : 'Your FundiHub OTP';

  const text =
    purpose === 'fundi_approval'
      ? `Your FundiHub fundi approval OTP is ${code}. It expires in 10 minutes.`
      : `Your FundiHub OTP is ${code}. It expires in 10 minutes.`;

  return { subject, text, html: layout({ title: subject, preheader, bodyHtml }) };
}

export function adminNewFundiSubmissionEmail({ fundi, adminUrl, docs = {} }) {
  const title = 'New fundi verification submitted';
  const preheader = `${fundi?.firstName || ''} ${fundi?.lastName || ''} submitted verification documents.`;

  const row = (label, value) => `
    <tr>
      <td style="padding:10px 0;color:${brand().muted};font-size:13px;width:160px;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:${brand().text};font-size:13px;font-weight:600;">${escapeHtml(value || 'N/A')}</td>
    </tr>`;

  const linkBtn = (href, label) => `
    <a href="${escapeHtml(href)}" style="display:inline-block;background:${brand().primary};color:#fff;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;">
      ${escapeHtml(label)}
    </a>`;

  const docLinks = [
    docs.idPhotoUrl ? `<li><a href="${escapeHtml(docs.idPhotoUrl)}">ID Photo</a></li>` : '',
    docs.idPhotoBackUrl ? `<li><a href="${escapeHtml(docs.idPhotoBackUrl)}">ID Back</a></li>` : '',
    docs.selfieUrl ? `<li><a href="${escapeHtml(docs.selfieUrl)}">Selfie</a></li>` : '',
  ].filter(Boolean).join('');

  const bodyHtml = `
    <div style="color:${brand().muted};font-size:14px;line-height:20px;margin-bottom:12px;">
      A new fundi application was submitted and is waiting for your approval.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin-top:8px;">
      ${row('Name', `${fundi?.firstName || ''} ${fundi?.lastName || ''}`.trim())}
      ${row('Email', fundi?.email)}
      ${row('Phone', fundi?.phone)}
      ${row('ID Number', fundi?.idNumber)}
      ${row('Skills', Array.isArray(fundi?.skills) ? fundi.skills.join(', ') : '')}
      ${fundi?.notes ? row('Notes', fundi.notes) : ''}
    </table>

    ${docLinks ? `<div style="margin:14px 0 0 0;color:${brand().muted};font-size:13px;">
      Documents:
      <ul style="margin:8px 0 0 18px;padding:0;color:${brand().text};font-weight:600;">${docLinks}</ul>
    </div>` : ''}

    <div style="margin-top:18px;">
      ${adminUrl ? linkBtn(adminUrl, 'Open Pending Fundis') : ''}
    </div>
    <div style="margin-top:10px;color:${brand().muted};font-size:12px;line-height:18px;">
      Approve or reject inside the Admin Panel → Fundi Verification.
    </div>
  `;

  const subject = 'New fundi verification submitted';
  const text = `New fundi verification submitted: ${fundi?.firstName || ''} ${fundi?.lastName || ''} (${fundi?.email || ''}). Review in admin panel: ${adminUrl || ''}`.trim();
  return { subject, text, html: layout({ title, preheader, bodyHtml }) };
}

