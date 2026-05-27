import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")


def send_otp_email(to_email: str, otp: str, username: str) -> bool:
    """
    Sends a 6-digit OTP to the user's email for password reset.
    OTP expires in 10 minutes.

    If Gmail is not configured in .env, the OTP is printed to the
    backend console window so you can still test without email setup.
    """

    # Always print OTP to console — useful for local development
    print("\n" + "=" * 60)
    print(f"  PASSWORD RESET OTP for {username} ({to_email})")
    print(f"  OTP CODE : {otp}  (expires in 10 minutes)")
    print("=" * 60 + "\n")

    # If email not configured, skip sending — user can read OTP from console
    if not SMTP_USER or not SMTP_PASSWORD:
        print("  [DEV MODE] Email not configured.")
        print("  Fill SMTP_USER and SMTP_PASSWORD in backend/.env to enable real email.\n")
        return True

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;background:#f0f2f5;padding:20px;margin:0;">
      <div style="max-width:460px;margin:auto;background:#1a1a2e;
                  border-radius:16px;padding:36px;color:#e0e0e0;">

        <h2 style="color:#e94560;margin:0 0 4px;">💰 Money Manager</h2>
        <p style="color:#888;margin:0 0 28px;font-size:13px;">Password Reset Request</p>

        <p style="margin:0 0 8px;">Hi <strong>{username}</strong>,</p>
        <p style="color:#aaa;font-size:14px;margin:0 0 28px;line-height:1.6;">
          Use the OTP below to reset your password.<br>
          It is valid for <strong style="color:#e0e0e0;">10 minutes</strong> only.
        </p>

        <!-- Big OTP display box -->
        <div style="background:#0f3460;border:2px solid #e94560;border-radius:12px;
                    padding:24px;text-align:center;margin-bottom:28px;">
          <div style="color:#aaa;font-size:12px;letter-spacing:2px;
                      text-transform:uppercase;margin-bottom:8px;">Your OTP Code</div>
          <div style="font-size:42px;font-weight:bold;letter-spacing:12px;
                      color:#e94560;font-family:monospace;">{otp}</div>
        </div>

        <p style="color:#888;font-size:12px;line-height:1.7;margin:0;">
          ⏱ This OTP expires in <strong style="color:#e0e0e0;">10 minutes</strong>.<br>
          🔒 Never share this OTP with anyone.<br>
          ❌ If you didn't request this, ignore this email.
        </p>

        <hr style="border:none;border-top:1px solid #2a2a4a;margin:24px 0;">
        <p style="color:#555;font-size:11px;margin:0;">
          Money Manager · This is an automated email, do not reply.
        </p>
      </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"{otp} is your Money Manager OTP"
        msg["From"]    = f"Money Manager <{SMTP_USER}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())

        print(f"  [EMAIL] OTP sent to {to_email}\n")
        return True

    except smtplib.SMTPAuthenticationError:
        print("  [EMAIL ERROR] Gmail login failed.")
        print("  Make sure you used a Gmail App Password (not your normal Gmail password).")
        print("  See backend/.env.example for setup instructions.\n")
        return True  # OTP still printed to console above

    except Exception as e:
        print(f"  [EMAIL ERROR] {e}\n")
        return True  # OTP still printed to console above
