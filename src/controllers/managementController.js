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
};

exports.listRegistrations = (req, res) => {
  db.all(`
    SELECT d.id, d.maDangKy, d.qrCode, d.tongTien, d.trangThai, d.createdAt,
           n.hoTen, n.email, n.soDienThoai,
           s.tenSuKien,
           h.tenHangVe
    FROM DangKy d
    JOIN NguoiThamDu n ON n.id = d.nguoiThamDuId
    JOIN SuKien s ON s.id = d.suKienId
    JOIN HangVe h ON h.id = d.hangVeId
    ORDER BY d.createdAt DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    return res.json(rows);
  });
};

exports.checkinTicket = (req, res) => {
  const { maVe } = req.body;

  if (!maVe) {
    return res.status(400).json({ message: 'Vui lòng nhập mã vé' });
  }

  db.get('SELECT * FROM DangKy WHERE qrCode = ? OR maDangKy = ?', [maVe, maVe], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!row) return res.status(404).json({ message: 'Không tìm thấy vé' });

    return res.json({
      message: 'Check-in thành công',
      registration: row,
      attendee: { maDangKy: row.maDangKy, qrCode: row.qrCode }
    });
  });
};

exports.listReports = (req, res) => {
  db.all('SELECT * FROM BaoCaoDoanhThu ORDER BY createdAt DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    return res.json(rows);
  });
};
