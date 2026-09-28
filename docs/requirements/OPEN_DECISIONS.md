# Câu hỏi cần chốt để hoàn thiện đặc tả

Chọn một phương án mỗi câu hoặc ghi phương án riêng. Các mục **Đề xuất** là lựa chọn phù hợp để bao phủ AC ban đầu mà vẫn giữ MVP gọn.

## Q1 — Trùng lịch thì xử lý thế nào?

- **A. Đề xuất:** Báo xung đột và gợi ý giờ trống gần nhất; mặc định không lưu. Người tạo có thể xác nhận “Tạo dù trùng” nếu chính sách cho phép.
- B. Chỉ cảnh báo, vẫn tạo ngay không cần xác nhận.
- C. Chặn tạo hoàn toàn; chỉ trả lỗi xung đột, không gợi ý giờ.

Nếu chọn A/B: người dùng có được bỏ qua xung đột phòng, xung đột người tham dự hay cả hai không?

## Q2 — Nhắc lịch 15 phút

- **A. Đề xuất:** Bắt buộc có nhắc email trước 15 phút; mỗi cuộc họp có cấu hình `reminder_minutes_before`, mặc định 15; V1 chưa cho đổi cấu hình.
- B. Mặc định 15 phút nhưng cho organizer chọn/tắt nhắc.
- C. Đưa nhắc lịch sang phiên bản sau (khi đó MVP chưa đáp ứng đầy đủ AC1).

Kênh nhắc: email, thông báo trong ứng dụng, hay cả hai?

## Q3 — Tệp đính kèm

- **A. Đề xuất:** Có upload trong V1; chỉ cho PDF/DOCX/XLSX/PPTX, tối đa 10 MB mỗi file và tối đa 5 file/cuộc họp; lưu trên local trong dev, thiết kế storage interface để chuyển sang object storage khi deploy.
- B. Có upload nhưng giới hạn/loại file khác (ghi rõ).
- C. Không làm trong MVP (khi đó AC1 chỉ được bao phủ một phần).

## Q4 — Email mời và phản hồi RSVP

- **A. Đề xuất:** Email có file `.ics` và link RSVP dùng token ngẫu nhiên, hết hạn theo thời điểm họp; link chỉ cho phép người nhận phản hồi đúng cuộc họp của mình.
- B. Email có `.ics`; RSVP chỉ thực hiện sau khi đăng nhập.
- C. Email có link tới ứng dụng; người nhận đăng nhập để xem `.ics`/phản hồi.

Người nhận chỉ là user nội bộ đã có tài khoản (đề xuất), hay được mời email ngoài hệ thống?

## Q5 — Xác thực link RSVP

- **A. Đề xuất:** Token riêng cho từng participant, lưu hash trong database, hết hạn khi họp kết thúc; không yêu cầu đăng nhập.
- B. Bắt buộc đăng nhập; không phát hành token RSVP.
- C. Chọn A nhưng token hết hạn sau khoảng thời gian khác (ghi rõ).

## Q6 — Thời gian “gần nhất” để gợi ý

- **A. Đề xuất:** Cùng ngày, sau thời điểm người dùng chọn, trong giờ làm việc 08:00–18:00 theo múi giờ Asia/Ho_Chi_Minh; thời lượng giữ nguyên; bước thử 15 phút; đề xuất tối đa 3 khung giờ.
- B. Dùng giờ làm việc/khoảng ngày/bước thời gian khác (ghi rõ).
- C. Chỉ cảnh báo xung đột, không gợi ý giờ trống.

## Q7 — Thông điệp lỗi và lỗi theo trường

- **A. Đề xuất:** Dùng nguyên văn thông điệp trong AC: “Vui lòng nhập tên cuộc họp”, “Thời gian kết thúc phải sau thời gian bắt đầu”, “Vui lòng chọn ít nhất 1 người tham gia”; các lỗi khác có message tiếng Việt tương ứng và `details` chứa `field`, `code`, `message`.
- B. Giữ message theo thiết kế hiện tại, chỉ bảo đảm mã lỗi nhất quán.
- C. Bạn sẽ cung cấp bộ thông điệp tiếng Việt riêng.

## Q8 — Múi giờ và cuộc họp quá khứ

- **A. Đề xuất:** UI hiển thị Asia/Ho_Chi_Minh; API nhận ISO 8601 có offset; database lưu UTC; không cho tạo lịch bắt đầu trong quá khứ.
- B. Múi giờ hiển thị khác hoặc cho phép tạo lịch quá khứ (ghi rõ).

## Q9 — Organizer trong danh sách người tham gia

- **A. Đề xuất:** Organizer tự động được thêm Accepted; request phải có ít nhất một participant khác; nếu organizer bị gửi lại trong participants thì bỏ trùng.
- B. Organizer được tính là participant duy nhất, không bắt buộc mời thêm người khác.

## Q10 — Phạm vi AC6 và tài liệu giao diện

- **A. Đề xuất:** Đưa modal xác nhận đóng form bẩn vào phạm vi Frontend V1; “Quay lại” giữ nguyên toàn bộ dữ liệu đang nhập.
- B. Để UI tự xử lý, chỉ ghi trong Acceptance Test.
- C. Hủy form luôn đóng, không hỏi lại.

## Câu trả lời

Người dùng đã chọn phương án A cho toàn bộ câu hỏi. Các quyết định được xem là đã chốt:

| Câu | Quyết định |
|---|---|
| Q1 | Cảnh báo + gợi ý; mặc định không lưu. Sau xác nhận rõ ràng, cho phép tạo dù trùng cả phòng và người tham dự; backend vẫn ghi warning. |
| Q2 | Bắt buộc nhắc email trước 15 phút; cấu hình `reminder_minutes_before` mặc định 15, V1 không cho đổi/tắt. |
| Q3 | Cho phép PDF/DOCX/XLSX/PPTX; tối đa 10 MB/file, 5 file/cuộc họp; local storage ở dev, storage interface để chuyển object storage khi deploy. |
| Q4 | Email có `.ics` và link RSVP bằng token riêng; chỉ user nội bộ đã có tài khoản được mời. |
| Q5 | Token RSVP riêng từng người được mời (organizer không cần RSVP token); chỉ lưu hash; hết hạn khi cuộc họp kết thúc; không yêu cầu đăng nhập. |
| Q6 | Gợi ý tối đa 3 khung cùng ngày, sau giờ đã chọn, trong 08:00–18:00 Asia/Ho_Chi_Minh; giữ nguyên thời lượng, thử bước 15 phút. |
| Q7 | Dùng đúng thông điệp AC; lỗi có `details` field-level gồm `field`, `code`, `message`. |
| Q8 | UI dùng Asia/Ho_Chi_Minh; API ISO 8601 có offset; DB UTC; không cho tạo cuộc họp bắt đầu trong quá khứ. |
| Q9 | Organizer tự thêm Accepted; cần ít nhất một participant khác; organizer bị lặp trong request thì loại trùng. |
| Q10 | Frontend V1 có xác nhận đóng form bẩn; Quay lại giữ toàn bộ dữ liệu đã nhập. |

## Quyết định đã đồng bộ

- [x] Q1–Q10 đã được chốt theo phương án A.
- [x] Đã đồng bộ ERD, OpenAPI, thiết kế MVP, kế hoạch tiến độ và kịch bản nghiệm thu.
- [x] Có thể bắt đầu code theo phạm vi đã chốt; trạng thái “đã chốt” không đồng nghĩa tính năng đã lập trình/nghiệm thu.
