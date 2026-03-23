export function loginAlertTemplate(ip: string, timestamp: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0b0e14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0e14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#141720;border-radius:12px;border:1px solid #1e2330;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;">
              <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                <span style="color:#8b5cf6;">Nov</span>Ex
              </div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:24px 32px;">
              <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#ffffff;">New Login Detected</h1>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#8a8fa0;">
                A new login to your NovEx account was detected. If this was you, no action is needed.
              </p>
              <table cellpadding="0" cellspacing="0" style="background-color:#0b0e14;border-radius:8px;width:100%;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px;">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="font-size:12px;color:#8a8fa0;padding-bottom:8px;">IP Address</td>
                        <td style="font-size:14px;color:#ffffff;padding-bottom:8px;text-align:right;font-family:monospace;">${ip}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#8a8fa0;">Time</td>
                        <td style="font-size:14px;color:#ffffff;text-align:right;">${timestamp}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#8a8fa0;">
                If this wasn't you, please change your password immediately and enable two-factor authentication.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 32px;border-top:1px solid #1e2330;">
              <p style="margin:0;font-size:11px;color:#555a6b;text-align:center;">
                NovEx Crypto Exchange &mdash; This is an automated security notification.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
