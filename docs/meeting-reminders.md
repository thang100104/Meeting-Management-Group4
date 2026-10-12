# Nhắc lịch họp trước 15 phút

Áp dụng cho ứng dụng hiện tại: React/Vite (`frontend`) và FastAPI/SQLAlchemy (`backend`). Backend Node/Prisma ở thư mục gốc là triển khai cũ, không phục vụ frontend đang dùng.

- Worker chạy ngay khi FastAPI khởi động và mỗi 60 giây, tạo thông báo khi còn từ hơn 0 đến 15 phút trước giờ bắt đầu. Frontend tải thông báo mỗi 30 giây và khi quay lại cửa sổ. Độ trễ thông thường tối đa khoảng 90 giây.
- Chỉ nhắc cuộc họp `SCHEDULED`/`APPROVED`; gửi cho người tổ chức và người được mời có tài khoản `ACTIVE`, chưa từ chối. Không tự gửi cho admin ngoài cuộc họp.
- Chuông và số chưa đọc dùng cùng dữ liệu; popup cho phép xem chi tiết hiện tại và mở link họp trực tuyến. Trạng thái đã đọc lưu riêng từng tài khoản trong DB.
- Bảng mới `meeting_notifications` được tạo tự động bằng `Base.metadata.create_all` khi backend khởi động. Không cần reset hay seed lại database hiện có.
- Khóa duy nhất `(meeting_id, recipient_user_id, meeting_start_time)` tránh lặp thông báo sau reload, restart và giữa các worker. Hủy, đổi giờ, từ chối RSVP hoặc xóa cuộc họp sẽ loại nhắc cũ khỏi danh sách; giờ mới được nhắc khi tới hạn.
- Với dữ liệu hiện tại, `meetings.start_time/end_time` là giờ Việt Nam không kèm offset. API input có offset được chuyển sang giờ Việt Nam trước khi lưu; API thông báo trả `startTime` với `+07:00`, `createdAt` UTC với `Z`. Không chuyển đổi dữ liệu cũ sang UTC trong thay đổi này.

## Chạy và sử dụng

1. Khởi động lại backend bằng `backend/run.bat`; chạy frontend bằng `frontend/run.bat`.
2. Đăng nhập tài khoản backend thật; tạo lịch bắt đầu sau 10–15 phút, mời tài khoản khác. Nếu cần, admin phê duyệt để lịch có trạng thái `SCHEDULED`.
3. Người tổ chức/người được mời nhận nhắc ở chuông và popup; bấm thông báo để xem giờ, phòng, người tổ chức và link tham gia.

Backend phải đang chạy để tạo nhắc đúng giờ. Nếu backend khởi động lại khi còn dưới 15 phút nhưng cuộc họp chưa bắt đầu, worker vẫn tạo nhắc. Thông báo trong web xuất hiện khi người dùng mở ứng dụng; không có Web Push khi đóng trình duyệt. Lịch mock chỉ lưu localStorage và tài khoản mock không có JWT backend không thuộc luồng này.

## Email (tùy chọn)

Mặc định dùng chuông trong ứng dụng. Để nhận email khi đóng web, cấu hình trong `backend/.env` theo `backend/.env.example`:

```dotenv
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="MeetingHub <noreply@meetinghub.local>"
SMTP_USER=
SMTP_PASSWORD=
SMTP_STARTTLS=false
SMTP_SSL=false
```

Ví dụ trên dành cho Mailpit local. Với SMTP thật, dùng host/port/tài khoản nhà cung cấp; bật STARTTLS hoặc SSL theo cấu hình của nhà cung cấp. Khởi động lại backend sau khi đổi biến môi trường.

Trạng thái email lưu trong `email_status`: `DISABLED`, `PENDING`, `SENDING`, `SENT`, `FAILED`, `CANCELLED`; lỗi lưu ở `email_error`. Worker claim email bằng cập nhật có điều kiện trước khi gửi. Lỗi email không làm mất thông báo trong web hoặc rollback cuộc họp; không tự retry. Email đang `SENDING` khi tiến trình dừng cũng không tự retry để tránh gửi trùng. Bật SMTP sau khi nhắc đã tạo không gửi lại các bản ghi `DISABLED`.

## API và kiểm thử

- `GET /api/v1/notifications`: tối đa 100 thông báo gần nhất của tài khoản JWT hiện tại.
- `PATCH /api/v1/notifications/{id}/read`: đánh dấu một thông báo đã đọc; ID thuộc người khác trả 404.
- `PATCH /api/v1/notifications/read-all`: đánh dấu thông báo của chính tài khoản đã đọc.

Chạy từ `backend`: `.\.venv\Scripts\python.exe -m unittest test_reminders -v` (Windows), hoặc `python -m unittest test_reminders -v` trong môi trường CI. Test dùng SQLite trong bộ nhớ, SMTP giả lập; không sửa database thật hay gửi email thật.

Kết quả xác minh ngày 2026-10-12: 10 kiểm thử nhắc lịch trên SQLite trong bộ nhớ; bộ kiểm thử phê duyệt hiện có trên DB riêng; kiểm tra lifecycle khởi tạo bảng/tạo họp có người mời/worker tự nhắc sau restart; kiểm tra trình duyệt headless ở cả admin và giảng viên (chuông, chi tiết, link họp, đã đọc sau reload, Escape); build frontend thành công. SMTP được giả lập trong test, chưa xác minh gửi email qua nhà cung cấp thật.

## Sửa luồng tài khoản và lỗi 401 — 2026-10-12

- Form đăng ký cũ chỉ lưu dữ liệu trong localStorage; đăng nhập cũ có fallback token giả. Email thật cần được đăng ký lại qua form mới để có bản ghi backend và JWT hợp lệ. Form mới gọi `POST /api/v1/auth/register`, backend băm mật khẩu và chỉ cho tự đăng ký vai trò `PARTICIPANT`; vai trò quản trị/người tổ chức do admin cấp.
- Không còn fallback đăng nhập giả. Login lấy JWT thật và xác nhận `/auth/me`; sinh viên/người tổ chức vào giao diện người dùng, admin vào giao diện quản trị.
- Lỗi 401 xóa phiên ở cả sessionStorage/localStorage, phát sự kiện `session-expired` riêng và chuyển về đăng nhập. Không phát `storage` từ interceptor nên không kích hoạt vòng lặp 401 → storage → GET rooms → 401. Luồng lấy phòng cũng chặn request đồng thời và dừng polling khi lỗi xác thực.
- Theo yêu cầu sử dụng hiện tại, sinh viên được gửi yêu cầu đặt phòng `PENDING`; chỉ admin được duyệt. Giới hạn quyền theo phòng và kiểm tra trùng phòng vẫn được áp dụng. Nhắc lịch chỉ được tạo khi lịch đã duyệt.
- Có 5 kiểm thử hồi quy mới cho đăng ký/JWT/đặt phòng/phân quyền/nhắc sau duyệt; tổng cộng 15 test cùng `test_reminders`. Browser QA xác nhận 401 dừng lặp, token bị xóa ở cả hai storage, đăng nhập sai không tạo token giả và đăng ký gửi API thay vì lưu mật khẩu trong localStorage.
