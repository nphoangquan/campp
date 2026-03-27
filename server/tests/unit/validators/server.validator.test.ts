/**
 * @file server.validator.test.ts
 * @description Unit test cho các Zod schema xác thực Server, Category, Channel,
 *              Message, và User profile.
 *
 * Bao gồm:
 * - createServerSchema, updateServerSchema
 * - createCategorySchema, updateCategorySchema
 * - createChannelSchema, updateChannelSchema
 * - sendMessageSchema, editMessageSchema
 * - updateProfileSchema, updatePasswordSchema
 *
 * Map với Excel: TC_046–TC_050 (server), TC_068–TC_071 (category),
 * TC_073–TC_078 (channel), TC_085–TC_100 (message), TC_031–TC_035 (profile).
 */

import {
  createServerSchema,
  updateServerSchema,
  createCategorySchema,
  updateCategorySchema,
  createChannelSchema,
  updateChannelSchema,
  sendMessageSchema,
  editMessageSchema,
} from '../../../src/validators/server.validator';

import {
  updateProfileSchema,
  updatePasswordSchema,
} from '../../../src/validators/user.validator';

/* ========================================================================== */
/*  SERVER                                                                     */
/* ========================================================================== */

describe('createServerSchema', () => {
  /** TC_046 — Tạo server thành công với tên hợp lệ */
  it('should accept a valid server name', () => {
    const result = createServerSchema.safeParse({ name: 'My Server' });
    expect(result.success).toBe(true);
  });

  /** Tên server để trống */
  it('should reject empty server name', () => {
    const result = createServerSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  /** Tên server vượt quá 100 ký tự */
  it('should reject server name longer than 100 characters', () => {
    const result = createServerSchema.safeParse({ name: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  /** Tạo server với templateId tuỳ chọn */
  it('should accept optional templateId', () => {
    const result = createServerSchema.safeParse({ name: 'Templated', templateId: 'tmpl_01' });
    expect(result.success).toBe(true);
  });
});

describe('updateServerSchema', () => {
  /** Cập nhật tên server hợp lệ */
  it('should accept valid partial update', () => {
    const result = updateServerSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  /** Mô tả server vượt quá 500 ký tự */
  it('should reject description longer than 500 characters', () => {
    const result = updateServerSchema.safeParse({ description: 'd'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

/* ========================================================================== */
/*  CATEGORY                                                                   */
/* ========================================================================== */

describe('createCategorySchema', () => {
  /** TC_068 — Tạo category thành công */
  it('should accept a valid category name', () => {
    const result = createCategorySchema.safeParse({ name: 'General' });
    expect(result.success).toBe(true);
  });

  /** Tên category để trống */
  it('should reject empty category name', () => {
    const result = createCategorySchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  /** Tên category vượt quá 100 ký tự */
  it('should reject category name longer than 100 characters', () => {
    const result = createCategorySchema.safeParse({ name: 'c'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('updateCategorySchema', () => {
  /** Cập nhật tên category hợp lệ */
  it('should accept a valid category name', () => {
    const result = updateCategorySchema.safeParse({ name: 'Updated' });
    expect(result.success).toBe(true);
  });
});

/* ========================================================================== */
/*  CHANNEL                                                                    */
/* ========================================================================== */

describe('createChannelSchema', () => {
  /** TC_073 — Tạo channel text mặc định */
  it('should accept valid channel with default type "text"', () => {
    const result = createChannelSchema.safeParse({ name: 'general' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('text');
    }
  });

  /** Tạo channel voice */
  it('should accept channel type "voice"', () => {
    const result = createChannelSchema.safeParse({ name: 'Voice Room', type: 'voice' });
    expect(result.success).toBe(true);
  });

  /** Tên channel để trống */
  it('should reject empty channel name', () => {
    const result = createChannelSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  /** Loại channel không hợp lệ */
  it('should reject invalid channel type', () => {
    const result = createChannelSchema.safeParse({ name: 'test', type: 'video' });
    expect(result.success).toBe(false);
  });
});

describe('updateChannelSchema', () => {
  /** Cập nhật topic channel hợp lệ */
  it('should accept valid topic update', () => {
    const result = updateChannelSchema.safeParse({ topic: 'Welcome to general!' });
    expect(result.success).toBe(true);
  });

  /** Topic vượt quá 1024 ký tự */
  it('should reject topic longer than 1024 characters', () => {
    const result = updateChannelSchema.safeParse({ topic: 't'.repeat(1025) });
    expect(result.success).toBe(false);
  });
});

/* ========================================================================== */
/*  MESSAGE                                                                    */
/* ========================================================================== */

describe('sendMessageSchema', () => {
  /** TC_085 — Gửi tin nhắn text thành công */
  it('should accept valid message content', () => {
    const result = sendMessageSchema.safeParse({ content: 'Hello world!' });
    expect(result.success).toBe(true);
  });

  /** Tin nhắn để trống */
  it('should reject empty message content', () => {
    const result = sendMessageSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  /** Tin nhắn vượt quá 2000 ký tự */
  it('should reject message longer than 2000 characters', () => {
    const result = sendMessageSchema.safeParse({ content: 'm'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  /** Gửi tin nhắn kèm attachment hợp lệ */
  it('should accept message with valid attachments', () => {
    const result = sendMessageSchema.safeParse({
      content: 'Check this out',
      attachments: [{ url: 'https://cdn.camp.io/img.png', type: 'image', name: 'img.png', size: 1024 }],
    });
    expect(result.success).toBe(true);
  });

  /** Số lượng attachment vượt quá 5 */
  it('should reject more than 5 attachments', () => {
    const attachments = Array.from({ length: 6 }, (_, i) => ({
      url: `https://cdn.camp.io/${i}.png`,
      type: 'image' as const,
      name: `${i}.png`,
      size: 100,
    }));
    const result = sendMessageSchema.safeParse({ content: 'too many', attachments });
    expect(result.success).toBe(false);
  });

  /** Gửi tin nhắn reply hợp lệ */
  it('should accept message with replyTo', () => {
    const result = sendMessageSchema.safeParse({ content: 'replying', replyTo: '507f1f77bcf86cd799439011' });
    expect(result.success).toBe(true);
  });
});

describe('editMessageSchema', () => {
  /** Sửa tin nhắn thành công */
  it('should accept valid edited content', () => {
    const result = editMessageSchema.safeParse({ content: 'Updated message' });
    expect(result.success).toBe(true);
  });

  /** Nội dung sửa để trống */
  it('should reject empty edited content', () => {
    const result = editMessageSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });
});

/* ========================================================================== */
/*  USER PROFILE                                                               */
/* ========================================================================== */

describe('updateProfileSchema', () => {
  /** TC_031 — Cập nhật display name thành công */
  it('should accept valid profile update', () => {
    const result = updateProfileSchema.safeParse({ displayName: 'New Name' });
    expect(result.success).toBe(true);
  });

  /** Username chứa ký tự không hợp lệ */
  it('should reject username with special characters', () => {
    const result = updateProfileSchema.safeParse({ username: 'bad user@!' });
    expect(result.success).toBe(false);
  });

  /** Avatar URL không hợp lệ */
  it('should reject invalid avatar URL', () => {
    const result = updateProfileSchema.safeParse({ avatar: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  /** Banner hex color hợp lệ */
  it('should accept valid hex color as banner', () => {
    const result = updateProfileSchema.safeParse({ banner: '#FF5733' });
    expect(result.success).toBe(true);
  });

  /** Activity status vượt quá 128 ký tự */
  it('should reject activity status longer than 128 characters', () => {
    const result = updateProfileSchema.safeParse({ activityStatus: 'a'.repeat(129) });
    expect(result.success).toBe(false);
  });
});

describe('updatePasswordSchema', () => {
  /** TC_035 — Đổi mật khẩu thành công */
  it('should accept valid password change', () => {
    const result = updatePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass456',
    });
    expect(result.success).toBe(true);
  });

  /** Mật khẩu hiện tại để trống */
  it('should reject empty current password', () => {
    const result = updatePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'NewPass456',
    });
    expect(result.success).toBe(false);
  });

  /** Mật khẩu mới quá ngắn */
  it('should reject new password shorter than 8 characters', () => {
    const result = updatePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});
