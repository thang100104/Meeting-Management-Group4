# Bảng truy vết Acceptance Criteria

Trạng thái hiện tại được đối chiếu với `user_story_acceptance_criteria.md`, tài liệu thiết kế MVP, ERD V2 và OpenAPI. “Có thiết kế” chưa có nghĩa là đã lập trình hoặc nghiệm thu.

| AC | Yêu cầu | Giao diện | Backend/API | Dữ liệu/tích hợp | Trạng thái và khoảng trống |
|---|---|---|---|---|---|
| AC1 | Form tạo họp: tiêu đề, giờ bắt đầu/kết thúc, người dự, phòng/link optional, mô tả, file, nhắc mặc định 15 phút | Form/modal, upload giới hạn 5 file, nhắc email cố định 15 phút | `POST /meetings` multipart; API người dùng/phòng | `MEETING`, `MEETING_PARTICIPANT`, `MEETING_ATTACHMENT`, `MEETING_REMINDER` | **Đã có quyết định/thiết kế.** Phòng và link đều optional; cần triển khai UI/backend theo giới hạn đã chốt. |
| AC2 | Validate tiêu đề, giờ kết thúc sau giờ bắt đầu, email đúng và tồn tại | Lỗi theo từng trường | `POST /meetings` validation; chỉ user nội bộ Active; lỗi `400`/`404` | Email user unique | **Đã có quyết định/thiết kế.** Chuẩn lỗi field-level được chốt. |
| AC3 | Giữ form khi lỗi, đánh dấu trường và hiển thị thông điệp AC | Giữ dữ liệu form; lỗi bên dưới trường | `400 VALIDATION_ERROR` có `details[]` với `field/code/message` | Không ghi DB khi validation fail | **Đã đặc tả.** Cần triển khai và nghiệm thu thông điệp nguyên văn. |
| AC4 | Cảnh báo người/phòng trùng và gợi ý giờ gần nhất | Cảnh báo, tối đa 3 giờ đề xuất; xác nhận rõ trước khi lưu dù trùng | `409` trả conflict/suggestions; retry cùng request với `allow_conflicts=true` sau xác nhận; `201` có warning nếu tạo trùng | Query conflict theo room/participant; gợi ý cùng ngày, 08:00–18:00, bước 15 phút, giữ thời lượng | **Đã chốt.** Cho override xung đột cả phòng và participant chỉ sau xác nhận. |
| AC5 | Lưu họp; cập nhật lịch; email với `.ics` và link RSVP | Hiển thị thành công và event cho organizer/participants | Create/list/detail; RSVP bằng token, không cần login | `MEETING`, participant token hash, notification log/reminder worker | **Đã có thiết kế.** Chỉ email user nội bộ; invitation và reminder gửi email; `.ics` + RSVP token riêng. |
| AC6 | Form rỗng đóng ngay; form bẩn hỏi xác nhận; Quay lại giữ dữ liệu | Confirm dialog bắt buộc trong Frontend V1 | Không gọi API khi hủy form chưa lưu | Không phát sinh ghi DB | **Đã chốt.** Cần đưa thành UI acceptance test. |

## Các quyết định đã phản ánh trong tài liệu

| Chủ đề | Tài liệu cần cập nhật |
|---|---|
| Hành vi trùng lịch, cho phép lưu, gợi ý giờ | Đã ghi trong thiết kế MVP, OpenAPI và kịch bản nghiệm thu |
| Nhắc lịch mặc định 15 phút | Có cấu hình trong ERD và worker trong thiết kế/tiến độ |
| File đính kèm | Có giới hạn/storage trong thiết kế, ERD và OpenAPI multipart |
| Email, `.ics`, RSVP | Có endpoint token, quy tắc lưu hash và hết hạn |
| Field-level validation và thông điệp | Có response schema và thông điệp AC |
| Đóng form/hủy thao tác | Có yêu cầu UI trong thiết kế và kịch bản nghiệm thu |

## Điều kiện xem là bao phủ đủ AC

- Mỗi AC có thiết kế UI hoặc API/data tương ứng, bao gồm lỗi và trạng thái biên.
- Quyết định tại `OPEN_DECISIONS.md` đã được chốt; các tài liệu thiết kế cần phản ánh quyết định trước khi code tính năng tương ứng.
- OpenAPI, ERD và thiết kế MVP cùng phản ánh một quy tắc.
- Có tiêu chí kiểm tra cụ thể cho AC1–AC6 trước nghiệm thu.
