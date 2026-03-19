import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { registerSchema, loginSchema, forgotPasswordSchema, verifyOtpSchema, resetPasswordSchema } from '../validators/auth.validator';
import { sendOtpEmail } from '../utils/email';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

type OtpPurpose = 'password-reset' | 'email-verify' | 'delete-account';
const otpStore = new Map<string, { code: string; expiresAt: number; verified?: boolean; purpose: OtpPurpose }>();
const otpAttemptStore = new Map<string, { attempts: number; lockedUntil?: number }>();
const resendStore = new Map<string, number>();
const pendingRegistrations = new Map<string, { username: string; email: string; passwordHash: string; displayName: string; expiresAt: number }>();

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const { username, email, password, displayName } = result.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      res.status(409).json({ error: 'This email is already in use' });
      return;
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      res.status(409).json({ error: 'This username is already taken' });
      return;
    }

    const now = Date.now();
    const lastResend = resendStore.get(`reg:${normalizedEmail}`);
    if (lastResend != null && now - lastResend < RESEND_COOLDOWN_MS) {
      res.status(429).json({ error: 'Please wait before requesting another verification code.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    pendingRegistrations.set(normalizedEmail, { username, email: normalizedEmail, passwordHash, displayName, expiresAt: now + OTP_EXPIRY_MS });
    const code = generateOtp();
    const otpKey = `reg:${normalizedEmail}`;
    otpStore.set(otpKey, { code, expiresAt: now + OTP_EXPIRY_MS, purpose: 'email-verify' });
    otpAttemptStore.delete(otpKey);
    await sendOtpEmail(normalizedEmail, code, 'email-verify');
    resendStore.set(`reg:${normalizedEmail}`, now);

    res.status(200).json({ requiresVerification: true, email: normalizedEmail });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed, please try again' });
  }
}

export async function verifyRegistration(req: Request, res: Response): Promise<void> {
  const result = verifyOtpSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { email, code } = result.data;
  const normalizedEmail = email.toLowerCase();
  const otpKey = `reg:${normalizedEmail}`;
  const now = Date.now();

  let attempt = otpAttemptStore.get(otpKey);
  if (attempt?.lockedUntil != null && attempt.lockedUntil > now) {
    res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    return;
  }
  if (attempt?.lockedUntil != null && attempt.lockedUntil <= now) {
    otpAttemptStore.delete(otpKey);
    attempt = undefined;
  }

  const stored = otpStore.get(otpKey);
  if (!stored || stored.purpose !== 'email-verify') {
    res.status(400).json({ error: 'Invalid or expired code. Please register again.' });
    return;
  }
  if (now > stored.expiresAt) {
    otpStore.delete(otpKey);
    pendingRegistrations.delete(normalizedEmail);
    res.status(400).json({ error: 'Code expired. Please register again.' });
    return;
  }
  if (stored.code !== code) {
    const next = (attempt?.attempts ?? 0) + 1;
    if (next >= OTP_MAX_ATTEMPTS) {
      otpAttemptStore.set(otpKey, { attempts: next, lockedUntil: now + OTP_LOCKOUT_MS });
      res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    } else {
      otpAttemptStore.set(otpKey, { attempts: next });
      res.status(400).json({ error: 'Invalid code' });
    }
    return;
  }

  const pending = pendingRegistrations.get(normalizedEmail);
  if (!pending || now > pending.expiresAt) {
    otpStore.delete(otpKey);
    pendingRegistrations.delete(normalizedEmail);
    res.status(400).json({ error: 'Registration expired. Please register again.' });
    return;
  }

  try {
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      otpStore.delete(otpKey);
      pendingRegistrations.delete(normalizedEmail);
      res.status(409).json({ error: 'This email is already in use' });
      return;
    }
    const existingUsername = await User.findOne({ username: pending.username });
    if (existingUsername) {
      otpStore.delete(otpKey);
      pendingRegistrations.delete(normalizedEmail);
      res.status(409).json({ error: 'This username is already taken' });
      return;
    }

    const user = await User.create({
      username: pending.username,
      email: pending.email,
      passwordHash: pending.passwordHash,
      displayName: pending.displayName,
      emailVerified: true,
    });

    otpStore.delete(otpKey);
    otpAttemptStore.delete(otpKey);
    pendingRegistrations.delete(normalizedEmail);

    const payload = { userId: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion ?? 0 };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const userObj = user.toObject ? user.toObject() : user;
    if (!userObj.mutedServers) userObj.mutedServers = [];
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions);
    res.status(201).json({ accessToken, user: userObj });
  } catch (error) {
    console.error('VerifyRegistration error:', error);
    res.status(500).json({ error: 'Registration failed, please try again' });
  }
}

export async function resendRegistrationOtp(req: Request, res: Response): Promise<void> {
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const normalizedEmail = result.data.email.toLowerCase();
  const now = Date.now();
  const lastResend = resendStore.get(`reg:${normalizedEmail}`);
  if (lastResend != null && now - lastResend < RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: 'Please wait before requesting another code.' });
    return;
  }
  const pending = pendingRegistrations.get(normalizedEmail);
  if (!pending || now > pending.expiresAt) {
    res.status(400).json({ error: 'No pending registration. Please register again.' });
    return;
  }
  const code = generateOtp();
  const otpKey = `reg:${normalizedEmail}`;
  otpStore.set(otpKey, { code, expiresAt: now + OTP_EXPIRY_MS, purpose: 'email-verify' });
  otpAttemptStore.delete(otpKey);
  pending.expiresAt = now + OTP_EXPIRY_MS;
  await sendOtpEmail(normalizedEmail, code, 'email-verify');
  resendStore.set(`reg:${normalizedEmail}`, now);
  res.json({ message: 'Verification code resent' });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const { email, password } = result.data;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    await User.findByIdAndUpdate(user._id, { status: 'online' });

    const payload = { userId: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion ?? 0 };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const userObj = user.toObject ? user.toObject() : user;
    if (!userObj.mutedServers) userObj.mutedServers = [];
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions);
    res.json({ accessToken, user: userObj });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed, please try again' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (userId) {
    await User.findByIdAndUpdate(userId, { status: 'offline' }).catch(() => null);
  }
  res.clearCookie(REFRESH_TOKEN_COOKIE);
  res.json({ message: 'Logged out successfully' });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const token = req.cookies[REFRESH_TOKEN_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'No refresh token provided' });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    const currentVersion = user.tokenVersion ?? 0;
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== currentVersion) {
      res.clearCookie(REFRESH_TOKEN_COOKIE);
      res.status(401).json({ error: 'Session invalidated. Please log in again.' });
      return;
    }

    const newPayload = { userId: user._id.toString(), email: user.email, tokenVersion: currentVersion };
    const accessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, cookieOptions);
    res.json({ accessToken });
  } catch {
    res.clearCookie(REFRESH_TOKEN_COOKIE);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const userObj = user.toObject ? user.toObject() : user;
    if (!userObj.mutedServers) userObj.mutedServers = [];
    res.json({ user: userObj });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { email } = result.data;
  const normalizedEmail = email.toLowerCase();
  try {
    const now = Date.now();
    const lastResend = resendStore.get(normalizedEmail);
    if (lastResend != null && now - lastResend < RESEND_COOLDOWN_MS) {
      res.status(429).json({ error: 'Please wait before requesting another OTP.' });
      return;
    }
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      const code = generateOtp();
      otpStore.set(normalizedEmail, { code, expiresAt: now + OTP_EXPIRY_MS, purpose: 'password-reset' });
      otpAttemptStore.delete(normalizedEmail);
      await sendOtpEmail(normalizedEmail, code, 'password-reset');
      resendStore.set(normalizedEmail, now);
    }
    res.status(200).json({ message: 'If an account exists with this email, you will receive an OTP shortly.' });
  } catch (error) {
    console.error('ForgotPassword error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const result = verifyOtpSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { email, code } = result.data;
  const key = email.toLowerCase();
  const now = Date.now();
  let attempt = otpAttemptStore.get(key);
  if (attempt?.lockedUntil != null && attempt.lockedUntil > now) {
    res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    return;
  }
  if (attempt?.lockedUntil != null && attempt.lockedUntil <= now) {
    otpAttemptStore.delete(key);
    attempt = undefined;
  }
  const stored = otpStore.get(key);
  if (!stored) {
    res.status(400).json({ error: 'Invalid or expired code. Please request a new code.' });
    return;
  }
  if (now > stored.expiresAt) {
    otpStore.delete(key);
    res.status(400).json({ error: 'Code expired. Please request a new code.' });
    return;
  }
  if (stored.code !== code) {
    const next = (attempt?.attempts ?? 0) + 1;
    if (next >= OTP_MAX_ATTEMPTS) {
      otpAttemptStore.set(key, { attempts: next, lockedUntil: now + OTP_LOCKOUT_MS });
      res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    } else {
      otpAttemptStore.set(key, { attempts: next });
      res.status(400).json({ error: 'Invalid code' });
    }
    return;
  }
  stored.verified = true;
  otpAttemptStore.delete(key);
  res.json({ verified: true });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { email, code, newPassword } = result.data;
  const key = email.toLowerCase();
  const stored = otpStore.get(key);
  if (!stored || stored.code !== code || Date.now() > stored.expiresAt || !stored.verified) {
    otpStore.delete(key);
    res.status(400).json({ error: 'Invalid or expired code. Please start again.' });
    return;
  }
  try {
    const user = await User.findOne({ email: key });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    otpStore.delete(key);
    otpAttemptStore.delete(key);
    res.clearCookie(REFRESH_TOKEN_COOKIE);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('ResetPassword error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
}

export async function requestDeleteAccount(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const key = `del:${user.email}`;
    const now = Date.now();
    const lastResend = resendStore.get(key);
    if (lastResend != null && now - lastResend < RESEND_COOLDOWN_MS) {
      res.status(429).json({ error: 'Please wait before requesting another code.' });
      return;
    }
    const code = generateOtp();
    otpStore.set(key, { code, expiresAt: now + OTP_EXPIRY_MS, purpose: 'delete-account' });
    otpAttemptStore.delete(key);
    await sendOtpEmail(user.email, code, 'delete-account');
    resendStore.set(key, now);
    res.json({ message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error('RequestDeleteAccount error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
}

export async function confirmDeleteAccount(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { code } = req.body;
  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Invalid code format' });
    return;
  }
  try {
    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const key = `del:${user.email}`;
    const now = Date.now();

    let attempt = otpAttemptStore.get(key);
    if (attempt?.lockedUntil != null && attempt.lockedUntil > now) {
      res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
      return;
    }
    if (attempt?.lockedUntil != null && attempt.lockedUntil <= now) {
      otpAttemptStore.delete(key);
      attempt = undefined;
    }

    const stored = otpStore.get(key);
    if (!stored || stored.purpose !== 'delete-account' || now > stored.expiresAt) {
      otpStore.delete(key);
      res.status(400).json({ error: 'Invalid or expired code. Please request a new code.' });
      return;
    }
    if (stored.code !== code) {
      const next = (attempt?.attempts ?? 0) + 1;
      if (next >= OTP_MAX_ATTEMPTS) {
        otpAttemptStore.set(key, { attempts: next, lockedUntil: now + OTP_LOCKOUT_MS });
        res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
      } else {
        otpAttemptStore.set(key, { attempts: next });
        res.status(400).json({ error: 'Invalid code' });
      }
      return;
    }

    otpStore.delete(key);
    otpAttemptStore.delete(key);

    await User.findByIdAndDelete(userId);
    res.clearCookie(REFRESH_TOKEN_COOKIE);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('ConfirmDeleteAccount error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}
