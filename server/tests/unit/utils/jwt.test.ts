/**
 * @file jwt.test.ts
 * @description Unit test cho các hàm ký và xác minh JWT token.
 *
 * Bao gồm:
 * - signAccessToken / verifyAccessToken
 * - signRefreshToken / verifyRefreshToken
 * - Trường hợp token sai hoặc hết hạn
 *
 * Map với Excel: TC_020–TC_023 (refresh token), TC_010 (đăng nhập trả token).
 *
 * @note Các biến môi trường JWT đã được thiết lập trong jest.setup.ts,
 *       nên test này chạy được mà không cần file .env thật.
 */

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type TokenPayload,
} from '../../../src/utils/jwt';

const samplePayload: TokenPayload = {
  userId: '507f1f77bcf86cd799439011',
  email: 'test@camp.io',
};

describe('Access Token', () => {
  /** Ký access token và xác minh thành công, payload khớp */
  it('should sign and verify a valid access token', () => {
    const token = signAccessToken(samplePayload);
    const decoded = verifyAccessToken(token);

    expect(decoded.userId).toBe(samplePayload.userId);
    expect(decoded.email).toBe(samplePayload.email);
  });

  /** Token rác phải bị reject */
  it('should throw on invalid access token', () => {
    expect(() => verifyAccessToken('invalid.token.here')).toThrow();
  });
});

describe('Refresh Token', () => {
  /** Ký refresh token kèm tokenVersion và xác minh thành công */
  it('should sign and verify a valid refresh token', () => {
    const payload = { ...samplePayload, tokenVersion: 1 };
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);

    expect(decoded.userId).toBe(samplePayload.userId);
    expect(decoded.email).toBe(samplePayload.email);
  });

  /** Dùng access secret để verify refresh token phải thất bại */
  it('should fail when verifying refresh token with access secret', () => {
    const payload = { ...samplePayload, tokenVersion: 1 };
    const refreshToken = signRefreshToken(payload);

    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });
});
