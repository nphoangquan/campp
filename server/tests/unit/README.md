# Unit Test — Tổng hợp

**Tổng: 80 test cases | 5 file | Tất cả passed**

Map khoảng 30 testcase từ `Camp_Test_Report.xlsx`, mỗi TC được tách thành nhiều scenario con.

---

## 1. auth.validator.test.ts — 19 tests

Validate input: đăng ký, đăng nhập, quên mật khẩu, OTP, reset mật khẩu.

| TC Excel | Nội dung |
|----------|----------|
| TC_001 | Đăng ký hợp lệ |
| TC_004 | Username < 2 ký tự |
| TC_005 | Username ký tự không hợp lệ |
| TC_006 | Email sai định dạng |
| TC_007 | Mật khẩu < 8 ký tự |
| TC_010 | Đăng nhập hợp lệ |
| TC_012 | Email sai khi đăng nhập |
| TC_024 | Quên mật khẩu |
| TC_028 | Reset mật khẩu |

Bổ sung: username > 32, password > 128, displayName trống, password trống, OTP sai độ dài, OTP chứa chữ.

---

## 2. server.validator.test.ts — 26 tests

Validate input: server, category, channel, message, profile, password.

| TC Excel | Nội dung |
|----------|----------|
| TC_046 | Tạo server |
| TC_068 | Tạo category |
| TC_073 | Tạo channel |
| TC_085 | Gửi tin nhắn |
| TC_031 | Cập nhật profile |
| TC_035 | Đổi mật khẩu |

Bổ sung: tên trống, vượt ký tự, type channel sai, attachment > 5, topic > 1024, banner hex, avatar URL sai, mô tả > 500.

---

## 3. permissions.test.ts — 14 tests

Permission bitfield, role-based access, channel override.

| TC Excel | Nội dung |
|----------|----------|
| TC_079–084 | Permission override allow/deny |
| TC_148–160 | Role & phân quyền |

Bao gồm: bitfield unique, ALL_PERMISSIONS, admin full quyền, moderator thiếu ADMINISTRATOR, member thiếu KICK, override deny/allow, roleId không khớp, hasChannelPermission.

---

## 4. jwt.test.ts — 4 tests

Ký và xác minh JWT token.

| TC Excel | Nội dung |
|----------|----------|
| TC_010 | Token hợp lệ sau đăng nhập |
| TC_020–023 | Refresh token |

Bao gồm: sign + verify access, token rác bị reject, sign + verify refresh, sai secret bị reject.

---

## 5. mention-parser.test.ts — 8 tests

Parse @mention trong tin nhắn.

| TC Excel | Nội dung |
|----------|----------|
| TC_108–110 | Mention trong message/notification |

Bao gồm: @user đơn, nhiều @user, deduplicate, @everyone, @here, plain text, dấu chấm boundary, underscore hợp lệ.

---
