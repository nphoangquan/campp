# Postman Tests

Thư mục này chứa collection và environment dùng cho `Postman`.

- `CampApp.postman_collection.json` — collection chính
- `CampApp.local.postman_environment.json` — biến môi trường local

## Cách dùng

1. Mở Postman → Import → chọn **cả 2 file** trên
2. Chọn environment **Camp — Local** ở góc phải trên
3. Chỉnh biến trong tab Environment nếu cần (`baseUrl`, `testEmail`...)
4. Chạy từng request hoặc dùng Collection Runner để chạy tuần tự

## Nội dung — 27 testcase (21 pass, 6 fail)


| Folder             | TC Excel                   | Nội dung                                                           |
| ------------------ | -------------------------- | ------------------------------------------------------------------ |
| 0. Setup           | —                          | Đăng ký + Đăng nhập lấy token                                      |
| 1. OTP & Verify    | TC_008, TC_009 ❌, TC_014 ❌ | Xác minh OTP, cooldown 60s, gửi lại OTP                            |
| 2. Đăng xuất       | TC_016–TC_017              | Logout, truy cập sau logout                                        |
| 3. Refresh Token   | TC_020–TC_023 ❌            | Refresh thành công, thiếu cookie, sai token, tokenVersion mismatch |
| 4. Quên & Reset MK | TC_024–TC_028              | Forgot password, verify OTP, reset password                        |
| 5. Xóa tài khoản   | TC_030                     | Request + confirm delete account                                   |
| 6. Invite          | TC_054 ❌, TC_058 ❌         | Regenerate invite, ban user join lại                               |
| 7. Upload & Media  | TC_240–TC_244 ❌            | Upload file, link preview, rate limit                              |

| Request trong Postman               | TC / ghi chú | Kết quả |
| ----------------------------------- | ------------ | ------------- |
| Đăng ký tài khoản mới               | Tiền đề      | —             |
| Đăng nhập lấy token                 | Tiền đề      | —             |
| TC_008 — Xác minh OTP đăng ký      | TC_008       | **Pass**      |
| TC_009 — Cooldown 60s OTP          | TC_009       | **Fail**      |
| TC_014 — Gửi lại OTP thay thế cũ   | TC_014       | **Fail**      |
| TC_016 — Đăng xuất                 | TC_016       | **Pass**      |
| TC_017 — /me sau đăng xuất         | TC_017       | **Pass**      |
| TC_020 — Refresh thành công        | TC_020       | **Pass**      |
| TC_021 — Refresh thiếu cookie      | TC_021       | **Pass**      |
| TC_022 — Refresh token sai         | TC_022       | **Pass**      |
| TC_023 — tokenVersion không khớp   | TC_023       | **Fail**      |
| TC_024 — Quên mật khẩu             | TC_024       | **Pass**      |
| TC_025 — Email không tồn tại vẫn 200 | (anti-enum)  | **Pass**      |
| TC_026 — Xác minh OTP quên MK      | TC_026       | **Pass**      |
| TC_027 — OTP sai                   | TC_027       | **Pass**      |
| TC_028 — Reset mật khẩu            | TC_028       | **Pass**      |
| TC_030a / b / c — Xóa tài khoản    | TC_030       | **Pass**      |
| TC_054 — Regenerate invite         | TC_054       | **Fail**      |
| TC_054b — Mã invite cũ → 404       | (bước TC_054) | **Fail**     |
| TC_058 — Ban user join invite      | TC_058       | **Fail**      |
| TC_240 — Upload file               | TC_240       | **Pass**      |
| TC_241 — Upload không file        | TC_241       | **Pass**      |
| TC_242 — Link preview hợp lệ       | TC_242       | **Pass**      |
| TC_243 — Link preview URL sai      | TC_243       | **Pass**      |
| TC_244 — Rate limit link preview   | TC_244       | **Fail**      |

Tổng: **21 Pass**, **6 Fail**

## Lưu ý

- Các request cần OTP sẽ có ghi chú `Cần điền otpCode thủ công` — copy mã từ email/server log
- TC_009 (cooldown) cần chờ 60s giữa 2 lần gửi
- TC_244 (rate limit) cần chạy Collection Runner với iterations > 20
- TC_054, TC_058 cần có server + invite code + tài khoản bị ban sẵn

## Kiểm tra (đối chiếu code server)

- **Endpoint**: Khớp `auth`, `upload`, `link-preview`, `invite`, `servers` (`regenerate-invite`, `join/:inviteCode`).
- **TC_054**: API trả `{ server }` — script lấy `server.inviteCode` đúng với controller.
- **TC_009**: Chỉ expect **429** khi còn pending đăng ký (sau register, trước verify). Sau verify xong, resend trả **400**.
- **TC_021**: Postman có thể vẫn gửi cookie từ Cookie Jar — nếu luôn 200, cần tắt cookie cho request đó hoặc xóa domain trong Cookies.
- **TC_240**: Chưa cấu hình Cloudinary → **503**; test chấp nhận 200 hoặc 503.
- **TC_242**: Site ngoài có thể timeout → test chấp nhận thêm 404/502/504.
- **Biến**: Login / verify lưu `accessToken` vào collection và environment khi đã chọn environment.
