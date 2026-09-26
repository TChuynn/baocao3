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

    const accounts = [
      ['admin01', 'admin@eventdemo.vn', adminPassword, 'QuanTriVien', 'Nguyễn Văn Admin', 'HoatDong'],
      ['btc01', 'organizer@eventdemo.vn', organizerPassword, 'BanToChuc', 'Trần Thị BTC', 'HoatDong'],
      ['checkin01', 'staff@eventdemo.vn', staffPassword, 'NhanVienCheckIn', 'Lê Văn Checkin', 'HoatDong'],
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
        trangThai: 'SapDienRa',
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
    ];

    for (const speaker of speakers) {
      await runQuery(
        `INSERT OR IGNORE INTO DienGia (maDienGia, tenDienGia, chuyenNganh, gioiThieu, avatarUrl) VALUES (?, ?, ?, ?, ?)`,
        speaker
      );
    }

    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung (maPhien, tenPhien, moTa, ngayGio, diaDiem, suKienId, phong) VALUES ('P-001', 'Keynote: AI in Action', 'Khởi động với góc nhìn thực tế về AI và sản phẩm.', '2026-10-15T09:30:00', 'Main Hall', 1, 'A1')`);
    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung (maPhien, tenPhien, moTa, ngayGio, diaDiem, suKienId, phong) VALUES ('P-002', 'Workshop: Deploy AI Agents', 'Workshop thực hành triển khai AI agents trong doanh nghiệp.', '2026-10-15T14:00:00', 'Innovation Lab', 1, 'B2')`);
    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung_DienGia (phienNoiDungId, dienGiaId) VALUES (1, 1)`);
    await runQuery(`INSERT OR IGNORE INTO PhienNoiDung_DienGia (phienNoiDungId, dienGiaId) VALUES (2, 2)`);
    await runQuery(`INSERT OR IGNORE INTO HangVe (maHangVe, tenHangVe, gia, soLuong, suKienId, moTa, trangThai) VALUES ('TICKET-VIP', 'VIP', 2390000, 120, 1, 'Có chỗ ngồi ưu tiên, quà tặng và networking lounge.', 'ConVe')`);
    await runQuery(`INSERT OR IGNORE INTO HangVe (maHangVe, tenHangVe, gia, soLuong, suKienId, moTa, trangThai) VALUES ('TICKET-PRO', 'Professional', 1490000, 200, 1, 'Truy cập toàn bộ hội nghị và khu workshop.', 'ConVe')`);
    await runQuery(`INSERT OR IGNORE INTO NguoiThamDu (maNguoiThamDu, hoTen, email, soDienThoai, trangThai) VALUES ('USER-001', 'Nguyễn Hoàng Long', 'long@gmail.com', '0901234567', 'HoatDong')`);
    await runQuery(`INSERT OR IGNORE INTO NguoiThamDu (maNguoiThamDu, hoTen, email, soDienThoai, trangThai) VALUES ('USER-002', 'Phạm Thị Hạnh', 'hanh@gmail.com', '0912345678', 'HoatDong')`);
    await runQuery(`INSERT OR IGNORE INTO DangKy (maDangKy, nguoiThamDuId, suKienId, hangVeId, soLuong, tongTien, trangThai, qrCode) VALUES ('REG-001', 1, 1, 1, 1, 2390000, 'DaXacNhan', 'QR-REG-001')`);
    await runQuery(`INSERT OR IGNORE INTO DangKy (maDangKy, nguoiThamDuId, suKienId, hangVeId, soLuong, tongTien, trangThai, qrCode) VALUES ('REG-002', 2, 1, 2, 1, 1490000, 'DaXacNhan', 'QR-REG-002')`);
    await runQuery(`INSERT OR IGNORE INTO ThongBao (maThongBao, suKienId, tieuDe, noiDung, loaiThongBao, nguoiGuiId) VALUES ('NOTI-001', 1, 'Mời tham dự AI Summit 2025', 'Chào bạn, chúng tôi rất vui mời bạn tham gia AI Summit 2025 với nhiều chủ đề AI và ứng dụng thực tiễn.', 'MoiThamDu', 2)`);
    await runQuery(`INSERT OR IGNORE INTO PhanHoi (maPhanHoi, suKienId, nguoiThamDuId, danhGia, phanHoi, nhomYKien) VALUES ('FB-001', 2, 1, 5, 'Không gian tổ chức rất chuyên nghiệp, phiên keynote hay và dễ hiểu.', 'Chatbot hữu ích')`);
    await runQuery(`INSERT OR IGNORE INTO PhanHoi (maPhanHoi, suKienId, nguoiThamDuId, danhGia, phanHoi, nhomYKien) VALUES ('FB-002', 2, 2, 4, 'Workshop rất đáng tham gia nhưng cần thêm thời gian cho Q&A.', 'Nội dung cần nhiều tương tác')`);
    await runQuery(`INSERT OR IGNORE INTO CauHoiChatbot (maCauHoi, cauHoi, cauTraLoi, suKienId, phienNoiDungId) VALUES ('FAQ-001', 'Sự kiện bắt đầu lúc mấy giờ?', 'Sự kiện bắt đầu lúc 09:00 ngày 15/10/2026 tại Main Hall.', 1, 1)`);
    await runQuery(`INSERT OR IGNORE INTO CauHoiChatbot (maCauHoi, cauHoi, cauTraLoi, suKienId, phienNoiDungId) VALUES ('FAQ-002', 'Có cần mang theo máy tính không?', 'Bạn không bắt buộc mang máy tính, nhưng nên mang theo nếu muốn tham gia workshop thực hành.', 1, 2)`);
    await runQuery(`INSERT OR IGNORE INTO BaoCaoDoanhThu (maBaoCao, suKienId, tongDoanhThu, soVeBan, doanhThuTheoHang) VALUES ('REPORT-001', 1, 842500000, 320, '{"VIP": 1800000000, "Professional": 662500000}')`);

    console.log('Database initialized with seed data.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

initSeed();
