/**
 * @file mention-parser.test.ts
 * @description Unit test cho hàm parseMentions — phân tích @mention trong nội dung tin nhắn.
 *
 * Bao gồm:
 * - Parse @username đơn lẻ và nhiều user
 * - Parse @everyone, @here
 * - Parse @role (tên chứa khoảng trắng)
 * - Loại trùng lặp (deduplicate)
 * - Edge case: tin nhắn không có mention
 *
 * Map với Excel: TC_108–TC_110 (mention trong message/notification).
 */

import { parseMentions } from '../../../src/utils/mentionParser';

describe('parseMentions', () => {
  /** Parse đúng 1 username đơn giản */
  it('should parse a single @username', () => {
    const result = parseMentions('Hello @john');
    expect(result.usernames).toContain('john');
    expect(result.hasEveryone).toBe(false);
    expect(result.hasHere).toBe(false);
  });

  /** Parse nhiều username trong cùng 1 tin nhắn */
  it('should parse multiple @usernames', () => {
    const result = parseMentions('@alice check this with @bob');
    expect(result.usernames).toEqual(expect.arrayContaining(['alice', 'bob']));
    expect(result.usernames).toHaveLength(2);
  });

  /** Loại bỏ username trùng lặp (case-insensitive) */
  it('should deduplicate usernames (case-insensitive)', () => {
    const result = parseMentions('@John and @john again');
    expect(result.usernames).toHaveLength(1);
  });

  /** Nhận diện @everyone */
  it('should detect @everyone', () => {
    const result = parseMentions('Attention @everyone!');
    expect(result.hasEveryone).toBe(true);
    expect(result.usernames).not.toContain('everyone');
  });

  /** Nhận diện @here */
  it('should detect @here', () => {
    const result = parseMentions('Hey @here, meeting now');
    expect(result.hasHere).toBe(true);
    expect(result.usernames).not.toContain('here');
  });

  /** Tin nhắn không chứa mention nào */
  it('should return empty results for plain text', () => {
    const result = parseMentions('Just a normal message');
    expect(result.usernames).toHaveLength(0);
    expect(result.roleNames).toHaveLength(0);
    expect(result.hasEveryone).toBe(false);
    expect(result.hasHere).toBe(false);
  });

  /** Dấu chấm là boundary — @camp_user.01 chỉ parse được "camp_user" */
  it('should treat dot as mention boundary', () => {
    const result = parseMentions('cc @camp_user.01');
    expect(result.usernames).toContain('camp_user');
  });

  /** Username chứa gạch dưới (hợp lệ) */
  it('should parse usernames with underscores', () => {
    const result = parseMentions('hey @camp_user_01');
    expect(result.usernames).toContain('camp_user_01');
  });
});
