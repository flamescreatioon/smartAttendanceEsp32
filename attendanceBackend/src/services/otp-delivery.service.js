import nodemailer from 'nodemailer';

let cachedTransporter;

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_PORT
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
    && process.env.SMTP_FROM,
  );
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE ?? '').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return cachedTransporter;
}

function buildOtpEmail({ studentName, sessionTitle, otpCode, expiresAt }) {
  const expiresLabel = new Date(expiresAt).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const subject = `Your attendance OTP for ${sessionTitle}`;
  const text = [
    `Hello ${studentName},`,
    '',
    `Your Smart Attendance OTP is: ${otpCode}`,
    `This code expires at ${expiresLabel}.`,
    '',
    'If you did not request this code, please ignore this message.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hello ${studentName},</p>
      <p>Your Smart Attendance OTP is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${otpCode}</p>
      <p>This code expires at <strong>${expiresLabel}</strong>.</p>
      <p>If you did not request this code, please ignore this message.</p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendAttendanceOtpEmail({
  email,
  studentName,
  sessionTitle,
  otpCode,
  expiresAt,
}) {
  const message = buildOtpEmail({
    studentName,
    sessionTitle,
    otpCode,
    expiresAt,
  });

  const transporter = getTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`Development OTP email for ${email}: ${otpCode}`);
      return {
        channel: 'development',
        delivered: false,
        message: 'Development mode: OTP not emailed. Use the displayed dev OTP or configure SMTP.',
      };
    }

    return {
      channel: 'unconfigured',
      delivered: false,
      message: 'Email delivery is not configured yet. Ask the lecturer to contact support.',
    };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return {
    channel: 'email',
    delivered: true,
    message: `A 6-digit OTP has been sent to ${email}.`,
  };
}
