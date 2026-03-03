import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  return transporter;
}

export async function sendParamsEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> {
  const trans = getTransporter();
  if (!trans) return false;
  const from = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@psp.local';
  const fromName = process.env.SMTP_FROM_NAME || 'PSP Onboarding';
  try {
    await trans.sendMail({
      from: `"${fromName}" <${from}>`,
      to: to.trim(),
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    });
    return true;
  } catch {
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
