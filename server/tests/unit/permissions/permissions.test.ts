/**
 * @file permissions.test.ts
 * @description Unit test cho hệ thống phân quyền bitfield.
 *
 * Bao gồm:
 * - Permissions constants (giá trị bitfield)
 * - getRolePermissions: lấy permission theo role
 * - hasPermission: kiểm tra quyền đơn lẻ
 * - computeMemberPermissions: tính quyền thực tế có channel override
 * - hasChannelPermission: kiểm tra quyền trong channel
 *
 * Map với Excel: TC_079–TC_084 (permission override/effect),
 * TC_148–TC_160 (role & phân quyền).
 */

import {
  Permissions,
  ALL_PERMISSIONS,
  ADMIN_PERMISSIONS,
  MODERATOR_PERMISSIONS,
  MEMBER_PERMISSIONS,
  getRolePermissions,
  hasPermission,
  computeMemberPermissions,
} from '../../../src/utils/permissions';

import { hasChannelPermission } from '../../../src/utils/channelPermission';

describe('Permissions constants', () => {
  /** Mỗi permission phải là lũy thừa của 2 (1 bit duy nhất) */
  it('should have unique power-of-2 values', () => {
    const values = Object.values(Permissions);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);

    for (const v of values) {
      expect(v & (v - 1)).toBe(0); // power of 2 check
    }
  });

  /** ALL_PERMISSIONS phải bao gồm tất cả bit */
  it('should combine all individual permissions into ALL_PERMISSIONS', () => {
    const combined = Object.values(Permissions).reduce((a, b) => a | b, 0);
    expect(ALL_PERMISSIONS).toBe(combined);
  });
});

describe('getRolePermissions', () => {
  /** Admin nhận full quyền */
  it('should return ALL_PERMISSIONS for admin role', () => {
    expect(getRolePermissions('admin')).toBe(ADMIN_PERMISSIONS);
    expect(getRolePermissions('admin')).toBe(ALL_PERMISSIONS);
  });

  /** Moderator có MANAGE_MESSAGES nhưng không có ADMINISTRATOR */
  it('should return MODERATOR_PERMISSIONS for moderator role', () => {
    const perms = getRolePermissions('moderator');
    expect(perms).toBe(MODERATOR_PERMISSIONS);
    expect(perms & Permissions.MANAGE_MESSAGES).toBeTruthy();
    expect(perms & Permissions.ADMINISTRATOR).toBeFalsy();
  });

  /** Member có SEND_MESSAGES nhưng không có KICK_MEMBERS */
  it('should return MEMBER_PERMISSIONS for member role', () => {
    const perms = getRolePermissions('member');
    expect(perms).toBe(MEMBER_PERMISSIONS);
    expect(perms & Permissions.SEND_MESSAGES).toBeTruthy();
    expect(perms & Permissions.KICK_MEMBERS).toBeFalsy();
  });
});

describe('hasPermission', () => {
  /** Admin bypass mọi kiểm tra quyền */
  it('should always return true for ADMINISTRATOR', () => {
    expect(hasPermission(Permissions.ADMINISTRATOR, Permissions.BAN_MEMBERS)).toBe(true);
    expect(hasPermission(Permissions.ADMINISTRATOR, Permissions.MANAGE_SERVER)).toBe(true);
  });

  /** Member có quyền SEND_MESSAGES */
  it('should return true when user has the specific permission', () => {
    expect(hasPermission(MEMBER_PERMISSIONS, Permissions.SEND_MESSAGES)).toBe(true);
  });

  /** Member không có quyền KICK_MEMBERS */
  it('should return false when user lacks the permission', () => {
    expect(hasPermission(MEMBER_PERMISSIONS, Permissions.KICK_MEMBERS)).toBe(false);
  });

  /** Kiểm tra tổ hợp nhiều quyền cùng lúc */
  it('should check combined permissions correctly', () => {
    const combined = Permissions.SEND_MESSAGES | Permissions.ATTACH_FILES;
    expect(hasPermission(MEMBER_PERMISSIONS, combined)).toBe(true);

    const tooMuch = Permissions.SEND_MESSAGES | Permissions.BAN_MEMBERS;
    expect(hasPermission(MEMBER_PERMISSIONS, tooMuch)).toBe(false);
  });
});

describe('computeMemberPermissions', () => {
  /** Không có override → trả về quyền gốc của role */
  it('should return base role permissions when no overrides', () => {
    expect(computeMemberPermissions('member')).toBe(MEMBER_PERMISSIONS);
  });

  /** Admin luôn nhận ALL_PERMISSIONS bất kể override */
  it('should return ALL_PERMISSIONS for admin regardless of overrides', () => {
    const overrides = [{ roleId: 'role1', allow: 0, deny: ALL_PERMISSIONS }];
    expect(computeMemberPermissions('admin', overrides, ['role1'])).toBe(ALL_PERMISSIONS);
  });

  /** Override deny tắt quyền SEND_MESSAGES của member */
  it('should deny permissions via channel override', () => {
    const overrides = [{ roleId: 'role1', allow: 0, deny: Permissions.SEND_MESSAGES }];
    const result = computeMemberPermissions('member', overrides, ['role1']);
    expect(result & Permissions.SEND_MESSAGES).toBeFalsy();
  });

  /** Override allow bật thêm quyền MANAGE_MESSAGES cho member */
  it('should allow additional permissions via channel override', () => {
    const overrides = [{ roleId: 'role1', allow: Permissions.MANAGE_MESSAGES, deny: 0 }];
    const result = computeMemberPermissions('member', overrides, ['role1']);
    expect(result & Permissions.MANAGE_MESSAGES).toBeTruthy();
  });

  /** Override không ảnh hưởng nếu roleId không khớp */
  it('should ignore overrides for non-matching roleIds', () => {
    const overrides = [{ roleId: 'other-role', allow: 0, deny: Permissions.SEND_MESSAGES }];
    const result = computeMemberPermissions('member', overrides, ['my-role']);
    expect(result & Permissions.SEND_MESSAGES).toBeTruthy();
  });
});

describe('hasChannelPermission', () => {
  /** Admin bypass kiểm tra quyền channel */
  it('should return true for ADMINISTRATOR permission', () => {
    expect(hasChannelPermission(Permissions.ADMINISTRATOR, Permissions.MANAGE_CHANNELS)).toBe(true);
  });

  /** Quyền cụ thể có trong bitfield */
  it('should return true when permission bit is set', () => {
    expect(hasChannelPermission(MEMBER_PERMISSIONS, Permissions.READ_MESSAGES)).toBe(true);
  });

  /** Quyền không có trong bitfield */
  it('should return false when permission bit is not set', () => {
    expect(hasChannelPermission(MEMBER_PERMISSIONS, Permissions.MANAGE_CHANNELS)).toBe(false);
  });
});
