import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.replace(/\s/g, '').trim();
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
    secure: env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  return transporter;
}

export async function sendOtpEmail(to: string, code: string, purpose: 'password-reset' | 'email-verify' | 'delete-account' = 'password-reset'): Promise<void> {
  const trans = getTransporter();
  if (!trans) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  }
  const from = env.MAIL_FROM || env.SMTP_USER || 'noreply@camp.local';

  const subjects: Record<string, string> = {
    'password-reset': 'Password reset verification code',
    'email-verify': 'Verify your email address',
    'delete-account': 'Account deletion verification code',
  };

  const bodies: Record<string, { text: string; html: string }> = {
    'password-reset': {
      text: `Your verification code is: ${code}. It expires in 10 minutes.`,
      html: `<p>You requested a password reset.</p><p>Your verification code: <strong>${code}</strong></p><p>This code expires in 10 minutes. If you did not request this, please ignore this email.</p>`,
    },
    'email-verify': {
      text: `Your email verification code is: ${code}. It expires in 10 minutes.`,
      html: `<p>Welcome to Camp! Please verify your email address.</p><p>Your verification code: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
    },
    'delete-account': {
      text: `Your account deletion verification code is: ${code}. It expires in 10 minutes.`,
      html: `<p>You requested to delete your Camp account.</p><p>Your verification code: <strong>${code}</strong></p><p>This code expires in 10 minutes. If you did not request this, please ignore this email and secure your account.</p>`,
    },
  };

  const body = bodies[purpose];
  await trans.sendMail({
    from: `"Camp" <${from}>`,
    to,
    subject: subjects[purpose],
    text: body.text,
    html: body.html,
  });
}
