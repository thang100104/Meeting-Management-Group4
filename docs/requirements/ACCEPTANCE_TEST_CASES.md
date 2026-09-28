# Kịch bản nghiệm thu Acceptance Criteria — Tạo cuộc họp

Các kịch bản này được suy ra từ `user_story_acceptance_criteria.md` và quyết định Q1–Q10 đã chốt. Đây là **tài liệu kiểm thử**, chưa phải kết quả chạy kiểm thử.

## AC1 — Form tạo cuộc họp

| ID | Điều kiện/thao tác | Kết quả mong đợi |
|---|---|---|
| AC1-01 | Mở form “Tạo lịch họp mới” từ trang Lịch | Form hiển thị tiêu đề, bắt đầu/kết thúc, người tham dự, phòng hoặc link online, mô tả, tệp đính kèm và nhắc lịch. |
| AC1-02 | Mở form mới | Nhắc email được bật mặc định trước 15 phút; V1 không cho đổi/tắt. |
| AC1-03 | Chọn nhiều file hợp lệ | Chấp nhận PDF/DOCX/XLSX/PPTX, tối đa 5 file, tối đa 10 MB mỗi file. |
| AC1-04 | Tải file có định dạng không cho phép, quá 10 MB hoặc file thứ 6 | Từ chối file và hiển thị lỗi gần trường upload; không tạo cuộc họp. Backend kiểm MIME thực tế, không chỉ phần mở rộng. |
| AC1-05 | Chọn phòng/link hoặc để trống cả hai | Phòng và link đều optional theo AC1; có thể nhập riêng hoặc đồng thời cho hybrid. |

## AC2 — Kiểm tra đầu vào

| ID | Điều kiện/thao tác | Kết quả mong đợi |
|---|---|---|
| AC2-01 | Bỏ trống tiêu đề rồi lưu | Không gọi tạo thành công; báo lỗi tiêu đề chính xác theo AC3. |
| AC2-02 | Chọn end_time bằng hoặc trước start_time | Backend trả `400 VALIDATION_ERROR`; lỗi gắn với trường thời gian kết thúc. |
| AC2-03 | Nhập email sai định dạng | Backend/UI báo email không hợp lệ; không ghi meeting. |
| AC2-04 | Email hợp lệ nhưng không thuộc tài khoản Active nội bộ | Backend trả `404 USER_NOT_FOUND`; không tạo cuộc họp thiếu participant. |
| AC2-05 | Không mời người nào ngoài organizer | Báo lỗi participant bắt buộc; organizer tự thêm Accepted không được tính vào số khách mời tối thiểu. |
| AC2-06 | Gửi thời gian bắt đầu trong quá khứ | Từ chối; giao diện dùng Asia/Ho_Chi_Minh, API nhận ISO 8601 có offset, dữ liệu lưu UTC. |

## AC3 — Hiển thị lỗi validation

| ID | Điều kiện/thao tác | Kết quả mong đợi |
|---|---|---|
| AC3-01 | Lưu khi thiếu tiêu đề | Hiển thị đúng: **“Vui lòng nhập tên cuộc họp”** dưới trường tiêu đề; trường được đánh dấu lỗi. |
| AC3-02 | Lưu khi end_time không sau start_time | Hiển thị đúng: **“Thời gian kết thúc phải sau thời gian bắt đầu”** dưới trường kết thúc. |
| AC3-03 | Lưu khi chưa chọn participant ngoài organizer | Hiển thị đúng: **“Vui lòng chọn ít nhất 1 người tham gia”** dưới trường participant. |
| AC3-04 | Backend trả lỗi validation | Response có `details[]` với `field`, `code`, `message`; form giữ nguyên các dữ liệu hợp lệ đã nhập. |

## AC4 — Xung đột và đề xuất thời gian

| ID | Điều kiện/thao tác | Kết quả mong đợi |
|---|---|---|
| AC4-01 | Phòng đã có cuộc họp giao nhau | `409 SCHEDULE_CONFLICT`, hiển thị tên phòng/cuộc họp và tối đa 3 khung giờ đề xuất. Không tạo ngay. |
| AC4-02 | Một participant đã có cuộc họp giao nhau | `409 SCHEDULE_CONFLICT`, hiển thị tên người/cuộc họp và tối đa 3 khung giờ đề xuất. Không tạo ngay. |
| AC4-03 | Có nhiều loại xung đột cùng lúc | Liệt kê đủ xung đột phòng và participant; slot đề xuất phải rảnh cho phòng và toàn bộ participant. |
| AC4-04 | Kiểm tra thuật toán gợi ý | Giữ nguyên thời lượng; cùng ngày; sau giờ đã chọn; 08:00–18:00 Asia/Ho_Chi_Minh; thử theo bước 15 phút; tối đa 3 kết quả. |
| AC4-05 | Người dùng chọn giờ gợi ý | Form cập nhật giờ theo lựa chọn; khi lưu, backend kiểm tra xung đột lại. |
| AC4-06 | Người dùng xác nhận “Tạo dù trùng” | Client gửi lại cùng request với `allow_conflicts=true`; backend kiểm tra lại rồi tạo nếu hợp lệ, response có warning liệt kê xung đột. |
| AC4-07 | Hủy cảnh báo hoặc không xác nhận tạo dù trùng | Không tạo meeting; dữ liệu form vẫn giữ để người dùng chỉnh sửa. |

## AC5 — Tạo thành công, lịch và thông báo

| ID | Điều kiện/thao tác | Kết quả mong đợi |
|---|---|---|
| AC5-01 | Tạo cuộc họp hợp lệ | Lưu meeting và toàn bộ participant trong transaction; organizer tự thêm Accepted, người được mời Pending; API trả `201`. |
| AC5-02 | Tạo thành công trên giao diện | Hiển thị **“Tạo lịch họp thành công!”** và sự kiện xuất hiện trên lịch organizer và từng participant. |
| AC5-03 | Kiểm tra email mời | Mỗi participant nội bộ nhận email mời có tệp `.ics` và link RSVP token riêng. |
| AC5-04 | RSVP bằng link token | Không cần đăng nhập; token chỉ đổi phản hồi của participant tương ứng; hỗ trợ Accepted/Declined/Tentative. Chỉ hash token lưu database. |
| AC5-05 | Dùng token RSVP sau thời điểm kết thúc cuộc họp | Từ chối token hết hạn; không thay đổi participant status. |
| AC5-06 | Đến thời điểm 15 phút trước họp | Reminder worker gửi email cho participant còn nhận nhắc; hủy/sửa giờ meeting cập nhật job, meeting Cancelled không gửi reminder. |
| AC5-07 | Email mời lỗi sau khi meeting đã commit | Meeting vẫn tồn tại, API xác nhận tạo và trả warning `INVITATION_EMAIL_FAILED`; lỗi được ghi log. |
| AC5-08 | Participant truy vấn lịch | Chỉ thấy cuộc họp mình tổ chức/tham gia; Admin thấy toàn hệ thống. |

## AC6 — Đóng hoặc hủy form

| ID | Điều kiện/thao tác | Kết quả mong đợi |
|---|---|---|
| AC6-01 | Đóng/hủy form chưa nhập dữ liệu | Form đóng ngay, không hiện xác nhận, không gọi API. |
| AC6-02 | Đóng/hủy form đã thay đổi dữ liệu | Hiện đúng: **“Bạn có chắc muốn hủy? Dữ liệu vừa nhập sẽ không được lưu.”** |
| AC6-03 | Chọn Đồng ý | Đóng form và bỏ dữ liệu chưa lưu. |
| AC6-04 | Chọn Quay lại | Đóng dialog xác nhận nhưng giữ nguyên toàn bộ dữ liệu form. |

## Quy tắc nghiệm thu chung

- Validation thất bại hoặc người dùng hủy form không được tạo meeting/participant/attachment/reminder trong database.
- Mọi thao tác ghi dữ liệu phải tôn trọng phân quyền; không dùng user ID do client gửi để xác định organizer.
- Lỗi provider email không rollback thao tác meeting đã commit.
- API và giao diện phải cùng dùng thông điệp lỗi, quy tắc thời gian và quyết định tại [`OPEN_DECISIONS.md`](./OPEN_DECISIONS.md).
