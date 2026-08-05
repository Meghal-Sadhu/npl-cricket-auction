import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.config import settings

logger = logging.getLogger(__name__)

def send_otp_email(to_email: str, otp_code: str) -> bool:
    """
    Sends a 6-digit OTP verification email to the user's corporate email address via Outlook/Office365 SMTP.
    """
    smtp_server = settings.SMTP_SERVER or "smtp.office365.com"
    smtp_port = settings.SMTP_PORT or 587
    smtp_user = settings.SMTP_USER or "meghal.sadhu@nikkisoceig.com"
    smtp_password = settings.SMTP_PASSWORD
    from_email = settings.SMTP_FROM_EMAIL or smtp_user

    subject = f"🔑 Your NPL 2027 Verification Code: {otp_code}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #090d16; color: #e2e8f0; margin: 0; padding: 20px; }}
        .container {{ max-width: 520px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
        .logo {{ text-align: center; margin-bottom: 24px; }}
        .logo h1 {{ color: #3b82f6; font-size: 22px; font-weight: 900; margin: 0; letter-spacing: 1px; }}
        .logo p {{ color: #94a3b8; font-size: 12px; margin-top: 4px; }}
        .otp-box {{ background: #1e293b; border: 2px dashed #3b82f6; border-radius: 12px; text-align: center; padding: 20px; margin: 24px 0; }}
        .otp-code {{ font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #fbbf24; margin: 0; font-family: monospace; }}
        .info {{ color: #cbd5e1; font-size: 14px; line-height: 1.6; text-align: center; }}
        .footer {{ text-align: center; margin-top: 32px; color: #64748b; font-size: 11px; border-top: 1px solid #1e293b; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <h1>NIKKISO PREMIER LEAGUE 2027</h1>
          <p>Official Corporate Cricket Bidding Portal</p>
        </div>
        <p class="info">Hello,</p>
        <p class="info">You requested to reset your password for your NPL Auction Portal account (<strong>{to_email}</strong>). Use the verification code below to complete your password reset:</p>
        
        <div class="otp-box">
          <p class="otp-code">{otp_code}</p>
        </div>

        <p class="info">This OTP code is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
        
        <div class="footer">
          <p>© 2027 Nikkiso Corporate Cricket Bidding Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    """

    if not smtp_user or not smtp_password:
        logger.error(f"[OUTLOOK SMTP ERROR] SMTP_USER ({smtp_user}) or SMTP_PASSWORD not set in server environment. Unable to authenticate with Outlook SMTP server.")
        print(f"[OUTLOOK SMTP MISSING CREDS] Sender: {smtp_user} | Recipient: {to_email} | OTP: {otp_code}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email

        part_html = MIMEText(html_content, "html")
        msg.attach(part_html)

        with smtplib.SMTP(smtp_server, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, [to_email], msg.as_string())

        logger.info(f"OTP email successfully sent via Outlook SMTP ({smtp_user}) to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email via Outlook SMTP: {e}")
        print(f"[OUTLOOK SMTP ERROR] Failed to send email from {smtp_user} to {to_email}: {e}")
        return False
