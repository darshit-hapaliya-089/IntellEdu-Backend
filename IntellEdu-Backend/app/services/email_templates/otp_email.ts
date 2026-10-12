const DEFAULT_LOGO_URL = 'https://intell-edu.vercel.app/intelledu-logo.png'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function createOtpEmail(
  code: string,
  expirySeconds = 60,
  logoUrl = DEFAULT_LOGO_URL,
  year = new Date().getFullYear()
) {
  const safeCode = escapeHtml(code)
  const safeLogoUrl = escapeHtml(logoUrl)
  const safeYear = escapeHtml(String(year))
  const safeExpirySeconds = escapeHtml(String(expirySeconds))
  const subject = `${safeCode} is your IntellEdu verification code`
  const text = [
    'IntellEdu Verification',
    '',
    safeCode,
    '',
    `Use the verification code above to continue. It expires in ${expirySeconds} seconds.`,
    'Never share this code with anyone. IntellEdu will never ask for it by phone, chat or email.',
    '',
    'If you did not request this code, you can safely ignore this email.',
  ].join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>IntellEdu Verification</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media only screen and (max-width: 480px) {
      .email-content { padding-left: 24px !important; padding-right: 24px !important; }
      .email-outer { padding: 20px 12px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-page { background-color: #171923 !important; }
      .email-card { background-color: #ffffff !important; }
      .email-content, .email-code-cell { background-color: #ffffff !important; }
      .email-title, .email-code { color: #0f172a !important; }
      .email-body, .email-footer { color: #475569 !important; }
    }
  </style>
</head>
<body class="email-page" bgcolor="#F5F3EF" style="margin:0;padding:0;background-color:#F5F3EF;">
  <div style="display:none;font-size:1px;color:#F5F3EF;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    Your IntellEdu verification code is ${safeCode}. It expires in ${safeExpirySeconds} seconds.
    &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
  </div>
  <table class="email-page" role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#F5F3EF" style="width:100%;border-collapse:collapse;background-color:#F5F3EF;">
    <tr>
      <td class="email-outer" align="center" style="padding:40px 16px;">
        <table class="email-card" role="presentation" width="520" border="0" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width:100%;max-width:520px;border:1px solid #E8E4DC;border-radius:16px;border-collapse:separate;border-spacing:0;background-color:#FFFFFF;overflow:hidden;">
          <tr>
            <td align="center" bgcolor="#1E1B4B" style="padding:28px 24px 26px;background-color:#1E1B4B;background-image:linear-gradient(135deg,#1E1B4B 0%,#302D75 100%);">
              <img src="${safeLogoUrl}" width="88" height="88" alt="IntellEdu" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;max-width:88px;color:#FFFFFF;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;">
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#FFFFFF" style="padding:0;background-color:#FFFFFF;">
              <table role="presentation" width="48" border="0" cellpadding="0" cellspacing="0" style="width:48px;border-collapse:collapse;">
                <tr><td height="2" bgcolor="#C9A96E" style="height:2px;font-size:0;line-height:0;background-color:#C9A96E;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-content" align="left" bgcolor="#FFFFFF" style="padding:34px 40px 40px;background-color:#FFFFFF;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 10px;color:#8A6D3B;font-size:11px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">IntellEdu Verification</p>
              <h1 class="email-title" style="margin:0 0 24px;color:#0F172A;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:34px;font-weight:400;">Verify your account</h1>
              <p class="email-body" style="margin:0 0 8px;color:#64748B;font-size:15px;line-height:24px;">Hello,</p>
              <p class="email-body" style="margin:0 0 24px;color:#64748B;font-size:15px;line-height:24px;">Use the verification code below to continue. It expires in ${safeExpirySeconds} seconds.</p>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td class="email-code-cell" align="center" bgcolor="#F6F5FF" style="padding:0;background-color:#F6F5FF;border:1px solid #E6E3FA;border-top:2px solid #C9A96E;border-radius:12px;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td align="center" style="padding:24px 12px;">
                          <span class="email-code" style="display:inline-block;color:#1E1B4B;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:36px;line-height:44px;font-weight:700;letter-spacing:10px;user-select:all;-webkit-user-select:all;">${safeCode}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p class="email-body" style="margin:16px 0 28px;color:#64748B;font-size:12px;line-height:20px;">Never share this code with anyone. IntellEdu will never ask for it by phone, chat or email.</p>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                <tr><td height="1" bgcolor="#ECE8E0" style="height:1px;font-size:0;line-height:0;background-color:#ECE8E0;">&nbsp;</td></tr>
              </table>
              <p class="email-footer" style="margin:24px 0 16px;color:#64748B;font-size:13px;line-height:21px;">If you did not request this code, you can safely ignore this email.</p>
              <p class="email-footer" style="margin:0 0 6px;color:#94A3B8;font-size:11px;line-height:17px;">IntellEdu · Smart Education</p>
              <p class="email-footer" style="margin:0;color:#94A3B8;font-size:11px;line-height:17px;">© ${safeYear} IntellEdu. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html, text }
}
