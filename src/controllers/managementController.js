const db = require('../config/db');

exports.getDashboardSummary = (req, res) => {
  db.get('SELECT COUNT(*) AS totalEvents FROM SuKien', (err, eventCount) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    db.get('SELECT COUNT(*) AS totalGuests FROM NguoiThamDu', (guestErr, guestCount) => {
      if (guestErr) return res.status(500).json({ message: 'Database error' });

      db.get('SELECT SUM(tongTien) AS revenue FROM DangKy', (revenueErr, revenueRow) => {
        if (revenueErr) return res.status(500).json({ message: 'Database error' });

        return res.json({
          totalEvents: Number(eventCount.totalEvents || 0),
          totalGuests: Number(guestCount.totalGuests || 0),
          revenue: Number(revenueRow.revenue || 0),
          aiScore: 92
        });
      });
    });
  });
};

exports.listSessions = (req, res) => {
  const { eventId } = req.query;
  const sql = eventId ? 'SELECT * FROM PhienNoiDung WHERE suKienId = ? ORDER BY ngayGio ASC' : 'SELECT * FROM PhienNoiDung ORDER BY ngayGio ASC';
  const params = eventId ? [eventId] : [];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    return res.json(rows);
  });
};

exports.createSession = (req, res) => {
  const { maPhien, tenPhien, moTa, ngayGio, diaDiem, suKienId, phong } = req.body;

  if (!maPhien || !tenPhien || !suKienId) {
    return res.status(400).json({ message: 'Thiếu thông tin phiên nội dung' });
  }

  db.run(
    `INSERT INTO PhienNoiDung (maPhien, tenPhien, moTa, ngayGio, diaDiem, suKienId, phong)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [maPhien, tenPhien, moTa || '', ngayGio, diaDiem || '', suKienId, phong || ''],
    function (err) {
      if (err) return res.status(400).json({ message: 'Không thể tạo phiên nội dung', error: err.message });
      return res.status(201).json({ id: this.lastID, message: 'Tạo phiên thành công' });
    }
  );
};

exports.listSpeakers = (req, res) => {
  db.all('SELECT * FROM DienGia ORDER BY tenDienGia ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    return res.json(rows);
  });
};

exports.createSpeaker = (req, res) => {
  const { maDienGia, tenDienGia, chuyenNganh, gioiThieu, avatarUrl } = req.body;

  db.run(
    `INSERT INTO DienGia (maDienGia, tenDienGia, chuyenNganh, gioiThieu, avatarUrl)
     VALUES (?, ?, ?, ?, ?)`,
    [maDienGia, tenDienGia, chuyenNganh || '', gioiThieu || '', avatarUrl || ''],
    function (err) {
      if (err) return res.status(400).json({ message: 'Không thể tạo diễn giả', error: err.message });
      return res.status(201).json({ id: this.lastID, message: 'Tạo diễn giả thành công' });
    }
  );
};

exports.listTickets = (req, res) => {
  const { eventId } = req.query;
  const sql = eventId ? 'SELECT * FROM HangVe WHERE suKienId = ? ORDER BY gia ASC' : 'SELECT * FROM HangVe ORDER BY gia ASC';
  const params = eventId ? [eventId] : [];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    return res.json(rows);
  });
};

exports.createTicket = (req, res) => {
  const { maHangVe, tenHangVe, gia, soLuong, suKienId, moTa, trangThai } = req.body;

  db.run(
    `INSERT INTO HangVe (maHangVe, tenHangVe, gia, soLuong, suKienId, moTa, trangThai)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [maHangVe, tenHangVe, Number(gia), Number(soLuong), Number(suKienId), moTa || '', trangThai || 'ConVe'],
    function (err) {
      if (err) return res.status(400).json({ message: 'Không thể tạo hạng vé', error: err.message });
      return res.status(201).json({ id: this.lastID, message: 'Tạo hạng vé thành công' });
    }
  );
};

exports.registerGuest = (req, res) => {
  const { fullName, email, phone, eventId, ticketType } = req.body;

  if (!fullName || !email || !eventId) {
    return res.status(400).json({ message: 'Thiếu thông tin đăng ký' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Định dạng email không hợp lệ' });
  }

  db.get('SELECT id FROM SuKien WHERE id = ?', [eventId], (eventErr, event) => {
    if (eventErr) return res.status(500).json({ message: 'Database error' });
    if (!event) return res.status(400).json({ message: 'Sự kiện không tồn tại' });

    db.get('SELECT id FROM NguoiThamDu WHERE email = ?', [email], (userErr, existingUser) => {
    if (userErr) return res.status(500).json({ message: 'Database error' });

    const createUser = () => {
      db.run(
        `INSERT INTO NguoiThamDu (maNguoiThamDu, hoTen, email, soDienThoai, trangThai)
         VALUES (?, ?, ?, ?, 'HoatDong')`,
        [`USER-${Date.now()}`, fullName, email, phone || ''],
        function (err) {
          if (err) return res.status(400).json({ message: 'Không thể tạo người tham dự', error: err.message });
          const guestId = this.lastID;
          const qrCode = `QR-${eventId}-${guestId}`;
          const ticketPrice = ticketType === 'VIP' ? 2390000 : 1490000;

          db.run(
            `INSERT INTO DangKy (maDangKy, nguoiThamDuId, suKienId, hangVeId, soLuong, tongTien, trangThai, qrCode)
             VALUES (?, ?, ?, (SELECT id FROM HangVe WHERE suKienId = ? AND tenHangVe = ? LIMIT 1), 1, ?, 'DaXacNhan', ?)`,
            [`REG-${Date.now()}`, guestId, Number(eventId), Number(eventId), ticketType, ticketPrice, qrCode],
            function (regErr) {
              if (regErr) return res.status(400).json({ message: 'Không thể lưu đăng ký', error: regErr.message });
              return res.status(201).json({ message: 'Đăng ký thành công', qrCode, ticketType, guestId });
            }
          );
        }
      );
    };

    if (existingUser) {
      const qrCode = `QR-${eventId}-${existingUser.id}`;
      return res.status(200).json({ message: 'Bạn đã đăng ký trước đó', qrCode, ticketType: ticketType || 'Professional' });
    }

    createUser();
    });
  });
};

exports.listRegistrations = (req, res) => {
  const { eventId, status, search } = req.query;
  let sql = `
    SELECT d.id, d.maDangKy, d.qrCode, d.tongTien, d.trangThai, d.thoiGianCheckIn, d.createdAt,
           n.hoTen, n.email, n.soDienThoai,
           s.tenSuKien, s.id as suKienId,
           h.tenHangVe
    FROM DangKy d
    JOIN NguoiThamDu n ON n.id = d.nguoiThamDuId
    JOIN SuKien s ON s.id = d.suKienId
    JOIN HangVe h ON h.id = d.hangVeId
    WHERE 1=1
  `;
  const params = [];

  if (eventId) {
    sql += ` AND d.suKienId = ?`;
    params.push(eventId);
  }
  if (status) {
    sql += ` AND d.trangThai = ?`;
    params.push(status);
  }
  if (search) {
    sql += ` AND (n.hoTen LIKE ? OR n.email LIKE ? OR n.soDienThoai LIKE ? OR d.maDangKy LIKE ? OR d.qrCode LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  sql += ` ORDER BY d.createdAt DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    return res.json(rows);
  });
};

exports.checkinTicket = (req, res) => {
  const { maVe } = req.body;

  if (!maVe) {
    return res.status(400).json({ message: 'Vui lòng nhập mã QR hoặc mã vé' });
  }

  const cleanCode = maVe.trim();

  db.get(`
    SELECT d.*, n.hoTen, n.email, n.soDienThoai, s.tenSuKien, h.tenHangVe
    FROM DangKy d
    JOIN NguoiThamDu n ON n.id = d.nguoiThamDuId
    JOIN SuKien s ON s.id = d.suKienId
    JOIN HangVe h ON h.id = d.hangVeId
    WHERE d.qrCode = ? OR d.maDangKy = ?
  `, [cleanCode, cleanCode], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!row) return res.status(404).json({ message: `Không tìm thấy vé với mã "${cleanCode}"` });
    
    if (row.trangThai === 'DaCheckIn') {
      return res.status(400).json({ 
        message: `Vé này đã được check-in lúc ${row.thoiGianCheckIn || 'trước đó'}!`,
        ticket: row,
        alreadyCheckedIn: true
      });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.run('UPDATE DangKy SET trangThai = "DaCheckIn", thoiGianCheckIn = ? WHERE id = ?', [nowStr, row.id], function(updateErr) {
      if (updateErr) return res.status(500).json({ message: 'Lỗi cập nhật check-in', error: updateErr.message });
      return res.json({
        message: 'Check-in thành công!',
        ticket: { ...row, trangThai: 'DaCheckIn', thoiGianCheckIn: nowStr }
      });
    });
  });
};

exports.undoCheckinTicket = (req, res) => {
  const { ticketId } = req.body;
  if (!ticketId) return res.status(400).json({ message: 'Thiếu mã vé ID' });

  db.run('UPDATE DangKy SET trangThai = "DaXacNhan", thoiGianCheckIn = NULL WHERE id = ?', [ticketId], function (err) {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ message: 'Không tìm thấy vé' });
    return res.json({ message: 'Đã hoàn tác trạng thái check-in của vé' });
  });
};

exports.getCheckinStats = (req, res) => {
  const { eventId } = req.query;
  const whereEvent = eventId ? 'WHERE suKienId = ?' : '';
  const params = eventId ? [eventId] : [];

  db.get(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN trangThai = 'DaCheckIn' THEN 1 ELSE 0 END) AS checkedIn,
      SUM(CASE WHEN trangThai != 'DaCheckIn' THEN 1 ELSE 0 END) AS notCheckedIn
    FROM DangKy ${whereEvent}
  `, params, (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    const total = row ? Number(row.total || 0) : 0;
    const checkedIn = row ? Number(row.checkedIn || 0) : 0;
    const notCheckedIn = row ? Number(row.notCheckedIn || 0) : 0;
    const rate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    return res.json({ total, checkedIn, notCheckedIn, rate });
  });
};

exports.listReports = (req, res) => {
  db.all(`
    SELECT b.*, s.tenSuKien, s.maSuKien
    FROM BaoCaoDoanhThu b
    JOIN SuKien s ON s.id = b.suKienId
    ORDER BY b.createdAt DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    return res.json(rows);
  });
};

exports.createReport = (req, res) => {
  const { suKienId, tongDoanhThu, soVeBan, doanhThuTheoHang, ghiChu } = req.body;
  if (!suKienId) {
    return res.status(400).json({ message: 'Thiếu thông tin sự kiện' });
  }

  const maBaoCao = `REPORT-${Date.now().toString().slice(-6)}`;
  db.run(`
    INSERT INTO BaoCaoDoanhThu (maBaoCao, suKienId, tongDoanhThu, soVeBan, doanhThuTheoHang, ghiChu)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    maBaoCao,
    Number(suKienId),
    Number(tongDoanhThu || 0),
    Number(soVeBan || 0),
    typeof doanhThuTheoHang === 'object' ? JSON.stringify(doanhThuTheoHang) : (doanhThuTheoHang || '{}'),
    ghiChu || ''
  ], function (err) {
    if (err) return res.status(400).json({ message: 'Không thể tạo báo cáo', error: err.message });
    return res.status(201).json({ id: this.lastID, maBaoCao, message: 'Lập báo cáo doanh thu thành công' });
  });
};

exports.getFinancialOverview = (req, res) => {
  db.get('SELECT COUNT(*) AS totalTickets, SUM(tongTien) AS totalRevenue FROM DangKy', (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    db.all(`
      SELECT s.id, s.tenSuKien, s.maSuKien,
             COUNT(d.id) AS ticketCount,
             COALESCE(SUM(d.tongTien), 0) AS eventRevenue
      FROM SuKien s
      LEFT JOIN DangKy d ON d.suKienId = s.id
      GROUP BY s.id
      ORDER BY eventRevenue DESC
    `, [], (eventErr, eventRevenues) => {
      if (eventErr) return res.status(500).json({ message: 'Database error' });

      db.all(`
        SELECT h.tenHangVe, COUNT(d.id) as count, COALESCE(SUM(d.tongTien), 0) as subtotal
        FROM DangKy d
        JOIN HangVe h ON h.id = d.hangVeId
        GROUP BY h.tenHangVe
      `, [], (tierErr, tierStats) => {
        if (tierErr) return res.status(500).json({ message: 'Database error' });

        return res.json({
          totalRevenue: Number(row.totalRevenue || 0),
          totalTickets: Number(row.totalTickets || 0),
          byEvent: eventRevenues,
          byTier: tierStats
        });
      });
    });
  });
};

exports.getMyTickets = (req, res) => {
  const email = req.query.email || (req.user ? req.user.email : null);
  if (!email) {
    return res.status(400).json({ message: 'Vui lòng cung cấp email người tham dự' });
  }

  db.all(`
    SELECT d.id, d.maDangKy, d.qrCode, d.tongTien, d.trangThai, d.thoiGianCheckIn, d.createdAt,
           s.tenSuKien, s.ngayBatDau, s.ngayKetThuc, s.diaDiem, s.bannerUrl,
           h.tenHangVe, h.gia
    FROM DangKy d
    JOIN NguoiThamDu n ON n.id = d.nguoiThamDuId
    JOIN SuKien s ON s.id = d.suKienId
    JOIN HangVe h ON h.id = d.hangVeId
    WHERE n.email = ?
    ORDER BY d.createdAt DESC
  `, [email], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    return res.json(rows);
  });
};

exports.createFeedback = (req, res) => {
  const { suKienId, email, danhGia, phanHoi, nhomYKien } = req.body;
  if (!suKienId || !danhGia) {
    return res.status(400).json({ message: 'Vui lòng chọn số sao đánh giá' });
  }

  const maPhanHoi = `FB-${Date.now().toString().slice(-6)}`;
  const attendeeEmail = email || (req.user ? req.user.email : '');

  db.get('SELECT id FROM NguoiThamDu WHERE email = ?', [attendeeEmail], (userErr, user) => {
    const attendeeId = user ? user.id : null;

    db.run(`
      INSERT INTO PhanHoi (maPhanHoi, suKienId, nguoiThamDuId, danhGia, phanHoi, nhomYKien)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [maPhanHoi, suKienId, attendeeId, Number(danhGia), phanHoi || '', nhomYKien || 'Ý kiến tham dự'], function (err) {
      if (err) return res.status(400).json({ message: 'Lỗi gửi phản hồi', error: err.message });
      return res.status(201).json({ message: 'Cảm ơn bạn đã gửi đánh giá phản hồi!', maPhanHoi });
    });
  });
};

exports.listFeedbacks = (req, res) => {
  const { eventId } = req.query;
  const whereEvent = eventId ? 'WHERE p.suKienId = ?' : '';
  const params = eventId ? [eventId] : [];

  db.all(`
    SELECT p.*, s.tenSuKien, COALESCE(n.hoTen, 'Khách ẩn danh') as hoTen
    FROM PhanHoi p
    JOIN SuKien s ON s.id = p.suKienId
    LEFT JOIN NguoiThamDu n ON n.id = p.nguoiThamDuId
    ${whereEvent}
    ORDER BY p.createdAt DESC
  `, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    return res.json(rows);
  });
};

