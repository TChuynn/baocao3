# Event Management System with AI - Phân Hệ Đa Vai Trò (Multi-Role Portal)

Dự án Hệ thống Quản lý Sự kiện Thông minh tích hợp Trí tuệ Nhân tạo (AI), được thiết kế chia tách thành **5 giao diện làm việc độc lập chuyên biệt** cho từng vai trò theo đúng yêu cầu:
1. **Quản trị viên (Admin)**
2. **Ban tổ chức (Organizer)**
3. **Nhân viên Check-in (Check-in Staff)**
4. **Kế toán (Accountant)**
5. **Người tham dự (Attendee / Guest)**

Mỗi vai trò sở hữu thanh điều hướng, chức năng và giao diện hoàn toàn riêng biệt, không hiển thị chức năng của các vai trò khác.

---

## 🚀 Công nghệ sử dụng (Tech Stack)

- **Backend**: Node.js + Express 5 (RESTful APIs, JWT Role-based Middleware)
- **Database**: SQLite 3 (Lưu trữ quan hệ, Foreign Keys, Check Constraints)
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 Glassmorphism hiện đại (Google Fonts `Outfit`, `Plus Jakarta Sans`)
- **Tích hợp Camera Scanner**: Quét mã QR thời gian thực bằng `Html5Qrcode`
- **Tính năng AI**: AI sinh thư mời/nhắc lịch tự động, AI tóm tắt phân tích phản hồi, AI Chatbot tư vấn 24/7

---

## 👥 Danh Sách 5 Vai Trò & Giao Diện Riêng Biệt

| Vai trò | Tài khoản mặc định | Mật khẩu | Giao diện & Chức năng độc quyền |
|---|---|---|---|
| 👑 **Quản trị viên** | `admin01` | `123456` | **Admin Portal**: Bảng điều khiển KPI toàn sàn, Quản lý danh sách tài khoản & phân quyền (Admin, BTC, Check-in, Kế toán, Khách), Giám sát và kiểm duyệt toàn bộ sự kiện. |
| 🎪 **Ban tổ chức** | `btc01` | `123456` | **Organizer Studio**: CRUD Sự kiện, Quản lý các phiên hội thảo/lịch trình, Quản lý diễn giả, Thiết lập các hạng vé (VIP, Standard), AI Studio (Sinh thông báo & Tóm tắt phản hồi AI), Xem phản hồi khách mời. |
| 🎫 **Nhân viên Check-in** | `checkin01` | `123456` | **Check-in Desk**: Quét mã QR bằng Camera máy tính/điện thoại, Nhập mã thủ công, Thẻ kết quả check-in âm thanh (Hợp lệ / Đã dùng / Lỗi), Danh sách khách mời thời gian thực (Lọc Đã check-in / Chưa check-in), Nút 1-chạm Check-in và Hoàn tác. |
| 💰 **Kế toán** | `ketoan01` | `123456` | **Finance Portal**: Tổng quan doanh thu bán vé, Tỷ trọng doanh thu theo từng sự kiện và hạng vé, Sổ giao dịch đơn đặt vé chi tiết, Lập báo cáo doanh thu mới, Xuất file CSV & In quyết toán. |
| 👤 **Người tham dự** | `attendee01` | `123456` | **Attendee Hub**: Khám phá sự kiện, Đặt vé tham dự trực tuyến nhận mã QR tức thì, Khu vực "Vé của tôi" (Boarding Pass QR sắc nét), Đánh giá sao & Gửi phản hồi, Trợ lý AI Chatbot hỏi đáp 24/7. |

> 🔒 **Cơ chế Phân Quyền Doanh Nghiệp (Enterprise Role Authentication)**:
> Hệ thống hoạt động theo mô hình phân quyền thực tế: Không có thanh chuyển vai trò tự do. Mỗi tài khoản trong cơ sở dữ liệu (`TaiKhoan.vaiTro`) được gắn cố định với một vai trò nghiệp vụ. Khi người dùng nhập tên đăng nhập và mật khẩu, hệ thống tự động xác thực danh tính qua JWT và chỉ mở duy nhất giao diện thuộc thẩm quyền của tài khoản đó. Muốn chuyển sang vai trò khác, người dùng bắt buộc phải đăng xuất và đăng nhập tài khoản của vai trò tương ứng.

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Thử Nghiệm

### 1. Cài đặt các thư viện phụ thuộc:
```bash
npm install
```

### 2. Thiết lập file môi trường (nếu chưa có):
```bash
cp .env.example .env
```

### 3. Khởi tạo cơ sở dữ liệu mẫu:
```bash
npm run seed
```

### 4. Khởi chạy ứng dụng:
```bash
npm start
# hoặc chạy với nodemon:
npm run dev
```

### 5. Mở trình duyệt web:
Truy cập: [http://localhost:3000](http://localhost:3000)

---

## 📡 Danh Sách API Endpoints Chính

- **Xác thực & Tài khoản**:
  - `POST /api/auth/login`: Đăng nhập hệ thống (trả về JWT token + thông tin vai trò)
  - `POST /api/auth/register`: Đăng ký tài khoản người tham dự
  - `GET /api/accounts`: Quản trị viên xem danh sách tài khoản
  - `PUT /api/accounts/:id/role`: Quản trị viên cập nhật vai trò / khóa tài khoản
- **Sự kiện & Hội thảo**:
  - `GET /api/events`: Lấy danh sách sự kiện công khai
  - `POST /api/events`, `PUT /api/events/:id`, `DELETE /api/events/:id`: Ban tổ chức / Admin quản lý sự kiện
  - `GET /api/sessions`, `POST /api/sessions`: Quản lý các phiên hội thảo
  - `GET /api/speakers`, `POST /api/speakers`: Quản lý diễn giả
  - `GET /api/tickets`, `POST /api/tickets`: Quản lý hạng vé
- **Đăng ký & Check-in**:
  - `POST /api/registrations`: Người tham dự đăng ký mua vé
  - `GET /api/registrations`: Danh sách vé (Admin, BTC, Check-in, Kế toán)
  - `POST /api/checkin`: Quét/nhập mã check-in vé
  - `POST /api/checkin/undo`: Hoàn tác trạng thái check-in
  - `GET /api/checkin/stats`: Thống kê tiến độ đón tiếp khách
  - `GET /api/my-tickets`: Người tham dự lấy danh sách vé cá nhân
- **Tài chính & Kế toán**:
  - `GET /api/financial/overview`: Thống kê tài chính tổng quan theo sự kiện & loại vé
  - `GET /api/reports`: Xem danh sách báo cáo doanh thu
  - `POST /api/reports`: Kế toán lập báo cáo quyết toán mới
- **AI & Phản hồi**:
  - `POST /api/ai/generate-notification`: AI sinh thư mời / nhắc lịch / cảm ơn
  - `POST /api/ai/summarize-feedback`: AI phân tích gom nhóm và tóm tắt phản hồi
  - `POST /api/ai/chatbot`: AI Chatbot hỏi đáp thông tin sự kiện
  - `POST /api/feedback`, `GET /api/feedback`: Gửi và xem đánh giá
