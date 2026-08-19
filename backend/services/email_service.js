const nodemailer = require('nodemailer');

let transporter = null;

function init() {
  if (!process.env.SMTP_HOST) {
    console.warn('⚠️  SMTP_HOST not set — weekly summary emails will be skipped.');
    return;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildHtml(client, stats) {
  const weekEnd = new Date();
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const hasActivity = stats.sessions > 0;

  return `
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#111;color:#e8e8e8;border-radius:12px;">
  <h1 style="color:#F6B000;font-size:20px;margin:0 0 4px;">GymPal Weekly Digest</h1>
  <p style="color:#888;font-size:13px;margin:0 0 20px;">${fmt(weekStart)} — ${fmt(weekEnd)}</p>

  <p style="font-size:15px;">Hey ${client.full_name || client.username},</p>

  ${hasActivity ? `
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr>
      <td style="padding:12px;background:#1a1a2e;border-radius:8px 0 0 8px;text-align:center;">
        <div style="font-size:28px;font-weight:bold;color:#F6B000;">${stats.sessions}</div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Sessions</div>
      </td>
      <td style="padding:12px;background:#1a1a2e;text-align:center;">
        <div style="font-size:28px;font-weight:bold;color:#F6B000;">${stats.volume.toLocaleString()} kg</div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Volume</div>
      </td>
      <td style="padding:12px;background:#1a1a2e;border-radius:0 8px 8px 0;text-align:center;">
        <div style="font-size:28px;font-weight:bold;color:#F6B000;">${stats.streak} 🔥</div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Week Streak</div>
      </td>
    </tr>
  </table>
  <p style="color:#ccc;font-size:14px;">Keep the momentum going. Every session counts.</p>
  ` : `
  <p style="color:#ccc;font-size:14px;margin:16px 0;">No sessions recorded last week — let's get back on track! One session is all it takes to restart the habit.</p>
  `}

  <p style="color:#555;font-size:11px;margin-top:24px;">— GymPal</p>
</div>`;
}

async function sendWeeklySummary(client, stats) {
  if (!transporter) return;
  if (!client.email) return;

  const html = buildHtml(client, stats);
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"GymPal" <noreply@gympal.app>',
      to: client.email,
      subject: `Your week at GymPal — ${stats.sessions} session${stats.sessions !== 1 ? 's' : ''}`,
      html,
    });
    console.log(`📧 Weekly summary sent to ${client.email}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${client.email}:`, err.message);
  }
}

module.exports = { init, sendWeeklySummary };
