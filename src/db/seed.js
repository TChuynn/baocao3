const bcrypt = require('bcryptjs');
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function initSeed() {
  try {
    await new Promise((resolve, reject) => {
      db.exec(schema, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const adminPassword = await bcrypt.hash('123456', 10);
    const organizerPassword = await bcrypt.hash('123456', 10);
    const staffPassword = await bcrypt.hash('123456', 10);
    const ketoanPassword = await bcrypt.hash('123456', 10);
    const attendeePassword = await bcrypt.hash('123456', 10);

    const accounts = [
      ['admin01', 'admin@eventdemo.vn', adminPassword, 'QuanTriVien', 'Nguyễn Văn Admin', 'HoatDong'],
      ['btc01', 'organizer@eventdemo.vn', organizerPassword, 'BanToChuc', 'Trần Thị Ban Tổ Chức', 'HoatDong'],
      ['checkin01', 'staff@eventdemo.vn', staffPassword, 'NhanVienCheckIn', 'Lê Văn Check-in', 'HoatDong'],
      ['ketoan01', 'ketoan@eventdemo.vn', ketoanPassword, 'KeToan', 'Phạm Minh Kế Toán', 'HoatDong'],
      ['attendee01', 'long@gmail.com', attendeePassword, 'NguoiThamDu', 'Nguyễn Hoàng Long', 'HoatDong'],
    ];

    for (const account of accounts) {
      await runQuery(
        `INSERT OR IGNORE INTO TaiKhoan (tenDangNhap, email, matKhauHash, vaiTro, hoTen, trangThai) VALUES (?, ?, ?, ?, ?, ?)`,
        account
      );
    }

    const events = [
      {
        maSuKien: 'EVT-2025-001',
        tenSuKien: 'AI Summit 2025',
        moTa: 'Hội nghị quốc tế về trí tuệ nhân tạo, công nghệ và đổi mới sáng tạo.',
        loaiSuKien: 'CongNghe',
        ngayBatDau: '2026-10-15T09:00:00',
        ngayKetThuc: '2026-10-17T18:00:00',
        diaDiem: 'Riverside Convention Center, Hà Nội',
        trangThai: 'DangDienRa',
        bannerUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30'
      },
      {
        maSuKien: 'EVT-2025-002',
        tenSuKien: 'Tech & Startup Festival',
        moTa: 'Lễ hội khởi nghiệp, giao dịch và học hỏi với các nhà sáng lập và startup.',
        loaiSuKien: 'DoanhNghiep',
        ngayBatDau: '2025-09-10T09:00:00',
        ngayKetThuc: '2025-09-12T18:00:00',
        diaDiem: 'Skyline Hall, TP.HCM',
        trangThai: 'DaKetThuc',
        bannerUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865'
      },
      {
        maSuKien: 'EVT-2025-003',
        tenSuKien: 'Cloud & DevOps Expo 2026',
        moTa: 'Triển lãm chuyên đề hạ tầng điện toán đám mây, kiến trúc Microservices và CI/CD tự động.',
        loaiSuKien: 'CongNghe',
        ngayBatDau: '2026-11-20T08:30:00',
        ngayKetThuc: '2026-11-21T17:30:00',
        diaDiem: 'Trung tâm Hội nghị Quốc gia, Hà Nội',
        trangThai: 'SapDienRa',
        bannerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87'
      }
    ];

    for (const event of events) {
      await runQuery(
        `INSERT OR IGNORE INTO SuKien (maSuKien, tenSuKien, moTa, loaiSuKien, ngayBatDau, ngayKetThuc, diaDiem, trangThai, bannerUrl)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [event.maSuKien, event.tenSuKien, event.moTa, event.loaiSuKien, event.ngayBatDau, event.ngayKetThuc, event.diaDiem, event.trangThai, event.bannerUrl]
      );
    }

    const speakers = [
      ['SPK-001', 'Dr. Minh Anh', 'AI Research', 'Chuyên gia về machine learning và tự động hóa quyết định.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2'],
      ['SPK-002', 'Ms. Lan Hương', 'Product Strategy', 'Giám đốc sản phẩm công nghệ tại startup Việt.', 'https://images.unsplash.com/photo-1556157382-97eda2d62296'],
      ['SPK-003', 'GS. Hoàng Hải', 'Cloud & Architecture', 'Kiến trúc sư trưởng giải pháp phân tán.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d'],
    ];

    for (const speaker of speakers) {
      await runQuery(
        `INSERT OR IGNORE INTO DienGia (maDienGia, tenDienGia, chuyenNganh, gioiThieu, avatarUrl) VALUES (?, ?, ?, ?, ?)`,
        speaker
      );
    }

    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung (maPhien, tenPhien, moTa, ngayGio, diaDiem, suKienId, phong) VALUES ('P-001', 'Keynote: AI in Action', 'Khởi động với góc nhìn thực tế về AI và sản phẩm.', '2026-10-15T09:30:00', 'Main Hall', 1, 'A1')`);
    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung (maPhien, tenPhien, moTa, ngayGio, diaDiem, suKienId, phong) VALUES ('P-002', 'Workshop: Deploy AI Agents', 'Workshop thực hành triển khai AI agents trong doanh nghiệp.', '2026-10-15T14:00:00', 'Innovation Lab', 1, 'B2')`);
    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung (maPhien, tenPhien, moTa, ngayGio, diaDiem, suKienId, phong) VALUES ('P-003', 'Panel: Future of Autonomous Tech', 'Tọa đàm chuyên sâu về tương lai trí tuệ nhân tạo.', '2026-10-16T10:00:00', 'Grand Stage', 1, 'C1')`);
    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung_DienGia (phienNoiDungId, dienGiaId) VALUES (1, 1)`);
    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung_DienGia (phienNoiDungId, dienGiaId) VALUES (2, 2)`);
    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung_DienGia (phienNoiDungId, dienGiaId) VALUES (3, 3)`);

    await runQuery(`INSERT OR IGNORE INTO HangVe (maHangVe, tenHangVe, gia, soLuong, suKienId, moTa, trangThai) VALUES ('TICKET-VIP', 'VIP', 2390000, 120, 1, 'Có chỗ ngồi ưu tiên, quà tặng và networking lounge.', 'ConVe')`);
    await runQuery(`INSERT OR IGNORE INTO HangVe (maHangVe, tenHangVe, gia, soLuong, suKienId, moTa, trangThai) VALUES ('TICKET-PRO', 'Professional', 1490000, 200, 1, 'Truy cập toàn bộ hội nghị và khu workshop.', 'ConVe')`);
    await runQuery(`INSERT OR IGNORE INTO HangVe (maHangVe, tenHangVe, gia, soLuong, suKienId, moTa, trangThai) VALUES ('TICKET-STD', 'Standard', 790000, 300, 1, 'Vé tiêu chuẩn tham dự phiên họp toàn thể.', 'ConVe')`);

    await runQuery(`INSERT OR IGNORE INTO NguoiThamDu (maNguoiThamDu, hoTen, email, soDienThoai, trangThai) VALUES ('USER-001', 'Nguyễn Hoàng Long', 'long@gmail.com', '0901234567', 'HoatDong')`);
    await runQuery(`INSERT OR IGNORE INTO NguoiThamDu (maNguoiThamDu, hoTen, email, soDienThoai, trangThai) VALUES ('USER-002', 'Phạm Thị Hạnh', 'hanh@gmail.com', '0912345678', 'HoatDong')`);
    await runQuery(`INSERT OR IGNORE INTO NguoiThamDu (maNguoiThamDu, hoTen, email, soDienThoai, trangThai) VALUES ('USER-003', 'Trần Văn An', 'an.tran@gmail.com', '0988776655', 'HoatDong')`);
    await runQuery(`INSERT OR IGNORE INTO NguoiThamDu (maNguoiThamDu, hoTen, email, soDienThoai, trangThai) VALUES ('USER-004', 'Lê Quỳnh Mai', 'mai.le@gmail.com', '0933221100', 'HoatDong')`);

    await runQuery(`INSERT OR IGNORE INTO DangKy (maDangKy, nguoiThamDuId, suKienId, hangVeId, soLuong, tongTien, trangThai, qrCode, thoiGianCheckIn) VALUES ('REG-001', 1, 1, 1, 1, 2390000, 'DaXacNhan', 'QR-REG-001', NULL)`);
    await runQuery(`INSERT OR IGNORE INTO DangKy (maDangKy, nguoiThamDuId, suKienId, hangVeId, soLuong, tongTien, trangThai, qrCode, thoiGianCheckIn) VALUES ('REG-002', 2, 1, 2, 1, 1490000, 'DaCheckIn', 'QR-REG-002', '2026-10-15 09:15:30')`);
    await runQuery(`INSERT OR IGNORE INTO DangKy (maDangKy, nguoiThamDuId, suKienId, hangVeId, soLuong, tongTien, trangThai, qrCode, thoiGianCheckIn) VALUES ('REG-003', 3, 1, 1, 1, 2390000, 'DaXacNhan', 'QR-REG-003', NULL)`);
    await runQuery(`INSERT OR IGNORE INTO DangKy (maDangKy, nguoiThamDuId, suKienId, hangVeId, soLuong, tongTien, trangThai, qrCode, thoiGianCheckIn) VALUES ('REG-004', 4, 1, 3, 1, 790000, 'DaCheckIn', 'QR-REG-004', '2026-10-15 09:35:12')`);

    await runQuery(`INSERT OR IGNORE INTO ThongBao (maThongBao, suKienId, tieuDe, noiDung, loaiThongBao, nguoiGuiId) VALUES ('NOTI-001', 1, 'Mời tham dự AI Summit 2025', 'Chào bạn, chúng tôi rất vui mời bạn tham gia AI Summit 2025 với nhiều chủ đề AI và ứng dụng thực tiễn.', 'MoiThamDu', 2)`);
    await runQuery(`INSERT OR IGNORE INTO PhanHoi (maPhanHoi, suKienId, nguoiThamDuId, danhGia, phanHoi, nhomYKien) VALUES ('FB-001', 2, 1, 5, 'Không gian tổ chức rất chuyên nghiệp, phiên keynote hay và dễ hiểu.', 'Chatbot hữu ích')`);
    await runQuery(`INSERT OR IGNORE INTO PhanHoi (maPhanHoi, suKienId, nguoiThamDuId, danhGia, phanHoi, nhomYKien) VALUES ('FB-002', 2, 2, 4, 'Workshop rất đáng tham gia nhưng cần thêm thời gian cho Q&A.', 'Nội dung cần nhiều tương tác')`);
    await runQuery(`INSERT OR IGNORE INTO PhanHoi (maPhanHoi, suKienId, nguoiThamDuId, danhGia, phanHoi, nhomYKien) VALUES ('FB-003', 1, 3, 5, 'Diễn giả chia sẻ thực chiến, tổ chức check-in QR rất nhanh gọn.', 'Trải nghiệm mượt mà')`);

    await runQuery(`INSERT OR IGNORE INTO CauHoiChatbot (maCauHoi, cauHoi, cauTraLoi, suKienId, phienNoiDungId) VALUES ('FAQ-001', 'Sự kiện bắt đầu lúc mấy giờ?', 'Sự kiện bắt đầu lúc 09:00 ngày 15/10/2026 tại Main Hall.', 1, 1)`);
    await runQuery(`INSERT OR IGNORE INTO CauHoiChatbot (maCauHoi, cauHoi, cauTraLoi, suKienId, phienNoiDungId) VALUES ('FAQ-002', 'Có cần mang theo máy tính không?', 'Bạn không bắt buộc mang máy tính, nhưng nên mang theo nếu muốn tham gia workshop thực hành.', 1, 2)`);
    await runQuery(`INSERT OR IGNORE INTO CauHoiChatbot (maCauHoi, cauHoi, cauTraLoi, suKienId, phienNoiDungId) VALUES ('FAQ-003', 'Quy định check-in vé thế nào?', 'Bạn chỉ cần xuất trình mã QR trên điện thoại hoặc đọc mã vé tại bàn đón tiếp.', 1, 1)`);

    await runQuery(`INSERT OR IGNORE INTO BaoCaoDoanhThu (maBaoCao, suKienId, tongDoanhThu, soVeBan, doanhThuTheoHang, ghiChu) VALUES ('REPORT-001', 1, 842500000, 320, '{"VIP": 1800000000, "Professional": 662500000}', 'Báo cáo doanh thu sự kiện AI Summit đợt 1')`);
    await runQuery(`INSERT OR IGNORE INTO BaoCaoDoanhThu (maBaoCao, suKienId, tongDoanhThu, soVeBan, doanhThuTheoHang, ghiChu) VALUES ('REPORT-002', 2, 520000000, 210, '{"VIP": 320000000, "Professional": 200000000}', 'Đã đối soát hoàn tất với cổng thanh toán')`);

    console.log('Database initialized with seed data.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

initSeed();
