/**
 * @file auth.validator.test.ts
 * @description Unit test cho các Zod schema xác thực Authentication.
 *
 * Bao gồm:
 * - registerSchema: đăng ký tài khoản
 * - loginSchema: đăng nhập
 * - forgotPasswordSchema: quên mật khẩu
 * - verifyOtpSchema: xác minh OTP
 * - resetPasswordSchema: đặt lại mật khẩu
 *
 * Map với Excel: TC_001–TC_007 (đăng ký), TC_010–TC_012 (đăng nhập),
 * TC_024–TC_029 (quên/reset mật khẩu).
 */

import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} from '../../../src/validators/auth.validator';

describe('registerSchema', () => {
  const validData = {
    username: 'campuser',
    email: 'test@camp.io',
    password: 'Abcd1234',
    displayName: 'Camp User',
  };

  /** TC_001 — Đăng ký thành công với dữ liệu hợp lệ */
  it('should accept valid registration data', () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  /** TC_004 — Username quá ngắn (dưới 2 ký tự) */
  it('should reject username shorter than 2 characters', () => {
    const result = registerSchema.safeParse({ ...validData, username: 'a' });
    expect(result.success).toBe(false);
  });

  /** TC_005 — Username chứa ký tự đặc biệt không hợp lệ */
  it('should reject username with invalid characters', () => {
    const result = registerSchema.safeParse({ ...validData, username: 'camp user!' });
    expect(result.success).toBe(false);
  });

  /** Username vượt quá 32 ký tự */
  it('should reject username longer than 32 characters', () => {
    const result = registerSchema.safeParse({ ...validData, username: 'a'.repeat(33) });
    expect(result.success).toBe(false);
  });

  /** TC_006 — Email sai định dạng */
  it('should reject invalid email format', () => {
    const result = registerSchema.safeParse({ ...validData, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  /** TC_007 — Mật khẩu quá ngắn (dưới 8 ký tự) */
  it('should reject password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'Ab12!' });
    expect(result.success).toBe(false);
  });

  /** Mật khẩu vượt quá 128 ký tự */
  it('should reject password longer than 128 characters', () => {
    const result = registerSchema.safeParse({ ...validData, password: 'A'.repeat(129) });
    expect(result.success).toBe(false);
  });

  /** Display name để trống */
  it('should reject empty display name', () => {
    const result = registerSchema.safeParse({ ...validData, displayName: '' });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  /** TC_010 — Đăng nhập thành công với email và password hợp lệ */
  it('should accept valid login data', () => {
    const result = loginSchema.safeParse({ email: 'user@camp.io', password: 'Abcd1234' });
    expect(result.success).toBe(true);
  });

  /** TC_012 — Email sai định dạng khi đăng nhập */
  it('should reject invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'bad', password: 'Abcd1234' });
    expect(result.success).toBe(false);
  });

  /** Mật khẩu để trống */
  it('should reject empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@camp.io', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  /** TC_024 — Gửi yêu cầu quên mật khẩu với email hợp lệ */
  it('should accept valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@camp.io' });
    expect(result.success).toBe(true);
  });

  /** Email sai định dạng */
  it('should reject invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('verifyOtpSchema', () => {
  /** Xác minh OTP thành công với mã 6 chữ số */
  it('should accept valid email and 6-digit code', () => {
    const result = verifyOtpSchema.safeParse({ email: 'user@camp.io', code: '123456' });
    expect(result.success).toBe(true);
  });

  /** OTP không đúng 6 ký tự */
  it('should reject code that is not exactly 6 digits', () => {
    const result = verifyOtpSchema.safeParse({ email: 'user@camp.io', code: '12345' });
    expect(result.success).toBe(false);
  });

  /** OTP chứa ký tự không phải số */
  it('should reject code containing non-digit characters', () => {
    const result = verifyOtpSchema.safeParse({ email: 'user@camp.io', code: 'abcdef' });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  const validData = { email: 'user@camp.io', code: '654321', newPassword: 'NewPass123' };

  /** TC_028 — Đặt lại mật khẩu thành công */
  it('should accept valid reset data', () => {
    const result = resetPasswordSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  /** Mật khẩu mới quá ngắn */
  it('should reject new password shorter than 8 characters', () => {
    const result = resetPasswordSchema.safeParse({ ...validData, newPassword: 'short' });
    expect(result.success).toBe(false);
  });

  /** OTP sai định dạng khi reset */
  it('should reject invalid OTP code', () => {
    const result = resetPasswordSchema.safeParse({ ...validData, code: 'abc' });
    expect(result.success).toBe(false);
  });
});
