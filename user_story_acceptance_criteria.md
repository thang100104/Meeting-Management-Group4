# I. Phân tích yêu cầu & Tiêu chí nghiệm thu Acceptance Criteria cho tính năng tạo cuộc họp

## 1. Yêu cầu người dùng (User Story)

* **Ai cần:** Nhân viên / Quản lý sử dụng phần mềm
* **Muốn làm gì:** Muốn tạo cuộc họp mới bằng cách điền các thông tin cần thiết và mời những người tham gia
* **Để làm gì:** Để lên lịch, mời nhân viên tham gia cuộc họp, chia sẻ tài liệu và nhận thông báo nhắc lịch tự động.

---

## 2. Tiêu chí nghiệm thu (Acceptance Criteria)

### AC 1: Hiển thị form tạo lịch họp
* **Given:** Người dùng đang ở giao diện Lịch (Calendar).
* **When:** Người dùng nhấp vào nút "Tạo lịch họp mới" (hoặc chọn một khung giờ trên lịch).
* **Then:** Hệ thống hiển thị form/popup tạo lịch họp với các trường thông tin:
  * Tiêu đề cuộc họp (Bắt buộc)
  * Thời gian bắt đầu & Thời gian kết thúc (Bắt buộc)
  * Danh sách người tham gia (Bắt buộc)
  * Phòng họp / Link họp trực tuyến (Không bắt buộc)
  * Mô tả / Nội dung họp (Không bắt buộc)
  * Đính kèm tài liệu (Không bắt buộc)
  * Cài đặt nhắc nhở (Mặc định: Trước 15 phút)

### AC 2: Kiểm tra dữ liệu đầu vào
* **Given:** Người dùng đang điền thông tin vào form tạo lịch họp.
* **When:** Người dùng thực hiện một trong các hành động sau:
  * Bỏ trống trường Tiêu đề
  * Chọn Thời gian kết thúc nhỏ hơn hoặc bằng Thời gian bắt đầu.
  * Nhập email người tham gia không hợp lệ/không tồn tại trong hệ thống.
* **Then:** Hệ thống ngăn chặn việc tạo cuộc họp và hiển thị thông báo lỗi tương ứng bên dưới từng trường thông tin.

### AC 3: Báo lỗi khi dữ liệu
* **Given:** Người dùng bấm "Lưu" nhưng gặp các trường hợp sau:
  * Để trống tên cuộc họp → Báo lỗi: "Vui lòng nhập tên cuộc họp".
  * Chọn giờ kết thúc trước giờ bắt đầu → Báo lỗi: "Thời gian kết thúc phải sau thời gian bắt đầu".
  * Chưa thêm người tham gia → Báo lỗi: "Vui lòng chọn ít nhất 1 người tham gia".
* **Then:** Hệ thống giữ nguyên màn hình, tô đỏ ô bị lỗi và hiển thị dòng chữ hướng dẫn.

### AC 4: Cảnh báo khi bị trùng lịch
* **Given:** Người dùng chọn thời gian họp và danh sách người tham gia.
* **When:** Có ít nhất một người tham gia (hoặc phòng họp) đã có lịch trùng trong khung giờ đó.
* **Then:** Hệ thống hiển thị cảnh báo trùng lịch: *"Người dùng [Tên] / Phòng họp [Tên phòng] đã có lịch họp khác trong khoảng thời gian này"* và gợi ý khung giờ trống gần nhất.

### AC 5: Tạo lịch họp thành công & Gửi thông báo
* **Given:** Người dùng đã điền đầy đủ và hợp lệ tất cả các thông tin bắt buộc.
* **When:** Người dùng nhấp vào nút "Lưu" hoặc "Tạo cuộc họp".
* **Then:** Hệ thống thực hiện:
  * Lưu cuộc họp vào cơ sở dữ liệu.
  * Hiển thị thông báo thành công: "Tạo lịch họp thành công!".
  * Hiển thị sự kiện cuộc họp mới trên giao diện Lịch của người tạo và những người được mời.
  * Gửi email/thông báo (Notification) tự động đến tất cả người tham gia kèm tệp đính kèm lịch (.ics hoặc link xác nhận tham gia: Đồng ý / Từ chối / Phân vân).

### AC 6: Hủy thao tác lịch họp
* **Given:** Người dùng đang ở form tạo lịch họp.
* **When:** Người dùng bấm nút "Đóng" hoặc "Hủy" khi đang điền dở thông tin.
* **Then:**
  * Nếu chưa nhập gì: Khung tự đóng ngay.
  * Nếu đã nhập chữ/chọn thông tin: Hệ thống hỏi lại "Bạn có chắc muốn hủy? Dữ liệu vừa nhập sẽ không được lưu."
    * Chọn **Đồng ý** → Hủy và đóng khung.
    * Chọn **Quay lại** → Tiếp tục chỉnh sửa.