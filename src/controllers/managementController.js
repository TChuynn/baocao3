const db = require('../config/db');
const { processRegistrationNotificationAndEmail } = require('../services/notificationEmailService');

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
  const sql = `
    SELECT p.*, s.tenSuKien, s.maSuKien
    FROM PhienNoiDung p
    LEFT JOIN SuKien s ON s.id = p.suKienId
    ${eventId ? 'WHERE p.suKienId = ?' : ''}
    ORDER BY p.ngayGio ASC
  `;
  const params = eventId ? [eventId] : [];

  db.all(sql, params, (err, sessions) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (!sessions || sessions.length === 0) return res.json([]);

    const sessionIds = sessions.map(s => s.id);
    const placeholders = sessionIds.map(() => '?').join(',');
    const speakerSql = `
      SELECT pd.phienNoiDungId, d.id, d.maDienGia, d.tenDienGia, d.chuyenNganh, d.avatarUrl
      FROM PhienNoiDung_DienGia pd
      JOIN DienGia d ON d.id = pd.dienGiaId
      WHERE pd.phienNoiDungId IN (${placeholders})
      ORDER BY d.tenDienGia ASC
    `;

    db.all(speakerSql, sessionIds, (spkErr, speakerRows) => {
      const speakersBySession = {};
      (speakerRows || []).forEach(row => {
        if (!speakersBySession[row.phienNoiDungId]) {
          speakersBySession[row.phienNoiDungId] = [];
        }
        speakersBySession[row.phienNoiDungId].push({
          id: row.id,
          maDienGia: row.maDienGia,
          tenDienGia: row.tenDienGia,
          chuyenNganh: row.chuyenNganh,
          avatarUrl: row.avatarUrl
        });
      });

      const result = sessions.map(s => ({
        ...s,
        dienGia: speakersBySession[s.id] || []
      }));
      return res.json(result);
    });
  });
};

function formatVNTime(dateObj) {
  const pad = (n) => String(n).padStart(2, '0');
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  const day = pad(dateObj.getDate());
  const month = pad(dateObj.getMonth() + 1);
  const year = dateObj.getFullYear();
  return `${hours}:${minutes} ngày ${day}/${month}/${year}`;
}

exports.checkSessionConflict = (req, res) => {
  const { suKienId, ngayGio, thoiLuong, excludeSessionId } = req.query;

  if (!suKienId || !ngayGio) {
    return res.status(400).json({ message: 'Vui lòng cung cấp suKienId và ngayGio' });
  }

  const newStart = new Date(ngayGio).getTime();
  if (isNaN(newStart)) {
    return res.status(400).json({ message: 'Thời gian bắt đầu không hợp lệ' });
  }

  const newDuration = Math.max(1, parseInt(thoiLuong, 10) || 60);
  const newEnd = newStart + newDuration * 60 * 1000;
  const excludeId = excludeSessionId ? Number(excludeSessionId) : null;

  db.all(
    `SELECT id, maPhien, tenPhien, ngayGio, COALESCE(thoiLuong, 60) AS thoiLuong, phong, diaDiem
     FROM PhienNoiDung
     WHERE suKienId = ?`,
    [Number(suKienId)],
    (err, existingSessions) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });

      const conflict = (existingSessions || []).find(s => {
        if (excludeId && s.id === excludeId) return false;
        const existStart = new Date(s.ngayGio).getTime();
        if (isNaN(existStart)) return false;
        const existDuration = Math.max(1, parseInt(s.thoiLuong, 10) || 60);
        const existEnd = existStart + existDuration * 60 * 1000;
        return (newStart < existEnd && newEnd > existStart);
      });

      if (conflict) {
        const existStart = new Date(conflict.ngayGio);
        const existDuration = Math.max(1, parseInt(conflict.thoiLuong, 10) || 60);
        const existEnd = new Date(existStart.getTime() + existDuration * 60 * 1000);

        return res.json({
          hasConflict: true,
          message: `Trùng thời gian! Đã có phiên "${conflict.tenPhien}" (${conflict.maPhien}) diễn ra từ ${formatVNTime(existStart)} đến ${formatVNTime(existEnd)} (${existDuration} phút) trong cùng sự kiện. Không thể đăng ký phiên này!`,
          conflictingSession: {
            id: conflict.id,
            maPhien: conflict.maPhien,
            tenPhien: conflict.tenPhien,
            ngayGio: conflict.ngayGio,
            thoiLuong: existDuration,
            phong: conflict.phong
          }
        });
      }

      return res.json({
        hasConflict: false,
        message: 'Khung giờ hợp lệ, không bị trùng với phiên nào trong sự kiện.'
      });
    }
  );
};

exports.createSession = (req, res) => {
  const { maPhien, tenPhien, moTa, ngayGio, thoiLuong, diaDiem, suKienId, phong, dienGiaId, dienGiaIds } = req.body;

  if (!maPhien || !tenPhien || !suKienId || !ngayGio) {
    return res.status(400).json({ message: 'Thiếu thông tin phiên nội dung (mã, tên, sự kiện, thời gian)' });
  }

  const newStart = new Date(ngayGio).getTime();
  if (isNaN(newStart)) {
    return res.status(400).json({ message: 'Thời gian bắt đầu phiên không hợp lệ' });
  }

  const newDuration = Math.max(1, parseInt(thoiLuong, 10) || 60);
  const newEnd = newStart + newDuration * 60 * 1000;

  // Kiểm tra xung đột thời gian với các phiên đã có trong cùng sự kiện
  db.all(
    `SELECT id, maPhien, tenPhien, ngayGio, COALESCE(thoiLuong, 60) AS thoiLuong, phong, diaDiem
     FROM PhienNoiDung
     WHERE suKienId = ?`,
    [Number(suKienId)],
    (err, existingSessions) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });

      const conflict = (existingSessions || []).find(s => {
        const existStart = new Date(s.ngayGio).getTime();
        if (isNaN(existStart)) return false;
        const existDuration = Math.max(1, parseInt(s.thoiLuong, 10) || 60);
        const existEnd = existStart + existDuration * 60 * 1000;
        return (newStart < existEnd && newEnd > existStart);
      });

      if (conflict) {
        const existStart = new Date(conflict.ngayGio);
        const existDuration = Math.max(1, parseInt(conflict.thoiLuong, 10) || 60);
        const existEnd = new Date(existStart.getTime() + existDuration * 60 * 1000);

        return res.status(409).json({
          hasConflict: true,
          message: `Trùng thời gian! Đã có phiên "${conflict.tenPhien}" (${conflict.maPhien}) diễn ra từ ${formatVNTime(existStart)} đến ${formatVNTime(existEnd)} (${existDuration} phút) trong cùng sự kiện. Không thể đăng ký phiên này!`,
          conflictingSession: {
            id: conflict.id,
            maPhien: conflict.maPhien,
            tenPhien: conflict.tenPhien,
            ngayGio: conflict.ngayGio,
            thoiLuong: existDuration,
            phong: conflict.phong
          }
        });
      }

      // Khung giờ hợp lệ -> Lưu phiên mới
      db.run(
        `INSERT INTO PhienNoiDung (maPhien, tenPhien, moTa, ngayGio, thoiLuong, diaDiem, suKienId, phong)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [maPhien, tenPhien, moTa || '', ngayGio, newDuration, diaDiem || '', Number(suKienId), phong || ''],
        function (insertErr) {
          if (insertErr) return res.status(400).json({ message: 'Không thể tạo phiên nội dung', error: insertErr.message });
          const sessionId = this.lastID;

          // Xử lý gán diễn giả nếu có truyền vào ngay khi tạo phiên
          const rawIds = dienGiaIds || (dienGiaId ? [dienGiaId] : []);
          const targetSpeakerIds = (Array.isArray(rawIds) ? rawIds : [rawIds]).map(Number).filter(id => id > 0);

          if (targetSpeakerIds.length > 0) {
            let inserted = 0;
            targetSpeakerIds.forEach(spkId => {
              db.run(
                'INSERT OR IGNORE INTO PhienNoiDung_DienGia (phienNoiDungId, dienGiaId) VALUES (?, ?)',
                [sessionId, spkId],
                () => {
                  inserted++;
                  if (inserted === targetSpeakerIds.length) {
                    return res.status(201).json({ id: sessionId, message: 'Tạo phiên và gán diễn giả thành công' });
                  }
                }
              );
            });
          } else {
            return res.status(201).json({ id: sessionId, message: 'Tạo phiên thành công' });
          }
        }
      );
    }
  );
};

exports.getSessionSpeakers = (req, res) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) {
    return res.status(400).json({ message: 'ID phiên không hợp lệ' });
  }

  db.get(
    `SELECT p.*, s.tenSuKien, s.maSuKien
     FROM PhienNoiDung p
     LEFT JOIN SuKien s ON s.id = p.suKienId
     WHERE p.id = ?`,
    [sessionId],
    (err, session) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      if (!session) return res.status(404).json({ message: 'Không tìm thấy phiên nội dung' });

      // Lấy danh sách diễn giả đã gán vào phiên này
      db.all(
        `SELECT d.*
         FROM DienGia d
         JOIN PhienNoiDung_DienGia pd ON pd.dienGiaId = d.id
         WHERE pd.phienNoiDungId = ?
         ORDER BY d.tenDienGia ASC`,
        [sessionId],
        (spkErr, assignedSpeakers) => {
          if (spkErr) return res.status(500).json({ message: 'Database error', error: spkErr.message });

          // Lấy danh sách diễn giả chưa được gán vào phiên này để hiển thị trong dropdown chọn gán
          db.all(
            `SELECT d.*
             FROM DienGia d
             WHERE d.id NOT IN (
               SELECT dienGiaId FROM PhienNoiDung_DienGia WHERE phienNoiDungId = ?
             )
             ORDER BY d.tenDienGia ASC`,
            [sessionId],
            (availErr, availableSpeakers) => {
              if (availErr) return res.status(500).json({ message: 'Database error', error: availErr.message });

              return res.json({
                session,
                assignedSpeakers: assignedSpeakers || [],
                availableSpeakers: availableSpeakers || []
              });
            }
          );
        }
      );
    }
  );
};

exports.assignSpeakerToSession = (req, res) => {
  const sessionId = Number(req.params.id);
  const { dienGiaId, dienGiaIds } = req.body;

  if (!sessionId) {
    return res.status(400).json({ message: 'ID phiên không hợp lệ' });
  }

  const rawIds = dienGiaIds || (dienGiaId ? [dienGiaId] : []);
  const targetSpeakerIds = (Array.isArray(rawIds) ? rawIds : [rawIds]).map(Number).filter(id => id > 0);

  if (targetSpeakerIds.length === 0) {
    return res.status(400).json({ message: 'Vui lòng chọn diễn giả để gán vào phiên' });
  }

  // 1. Kiểm tra phiên có tồn tại không
  db.get('SELECT id, tenPhien, maPhien, suKienId FROM PhienNoiDung WHERE id = ?', [sessionId], (sessErr, session) => {
    if (sessErr) return res.status(500).json({ message: 'Database error', error: sessErr.message });
    if (!session) return res.status(404).json({ message: 'Không tìm thấy phiên nội dung' });

    let completed = 0;
    let errors = [];

    targetSpeakerIds.forEach(spkId => {
      // Kiểm tra diễn giả tồn tại
      db.get('SELECT id, tenDienGia FROM DienGia WHERE id = ?', [spkId], (spkErr, speaker) => {
        if (spkErr || !speaker) {
          completed++;
          if (completed === targetSpeakerIds.length) finish();
          return;
        }

        db.run(
          'INSERT OR IGNORE INTO PhienNoiDung_DienGia (phienNoiDungId, dienGiaId) VALUES (?, ?)',
          [sessionId, spkId],
          function (insErr) {
            if (insErr) errors.push(insErr.message);
            completed++;
            if (completed === targetSpeakerIds.length) {
              finish(speaker);
            }
          }
        );
      });
    });

    function finish(lastSpeaker) {
      if (errors.length > 0 && completed === errors.length) {
        return res.status(400).json({ message: 'Lỗi gán diễn giả', errors });
      }

      const spkName = lastSpeaker?.tenDienGia || 'diễn giả';
      return res.status(200).json({
        message: targetSpeakerIds.length === 1 
          ? `Đã gán diễn giả "${spkName}" vào phiên "${session.tenPhien}" thành công.`
          : `Đã gán thành công các diễn giả vào phiên "${session.tenPhien}".`,
        sessionId,
        tenPhien: session.tenPhien
      });
    }
  });
};

exports.removeSpeakerFromSession = (req, res) => {
  const sessionId = Number(req.params.id);
  const speakerId = Number(req.params.dienGiaId);

  if (!sessionId || !speakerId) {
    return res.status(400).json({ message: 'ID phiên hoặc ID diễn giả không hợp lệ' });
  }

  db.run(
    'DELETE FROM PhienNoiDung_DienGia WHERE phienNoiDungId = ? AND dienGiaId = ?',
    [sessionId, speakerId],
    function (err) {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Diễn giả này chưa được gán vào phiên hoặc đã được gỡ trước đó' });
      }
      return res.json({ message: 'Đã gỡ diễn giả khỏi phiên nội dung thành công', sessionId, speakerId });
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
  const whereClause = eventId ? 'WHERE h.suKienId = ?' : '';
  const params = eventId ? [eventId] : [];

  const sql = `
    SELECT h.*,
           s.tenSuKien,
           COALESCE(booked.daBan, 0) AS daBan,
           MAX(0, h.soLuong - COALESCE(booked.daBan, 0)) AS conLai,
           CASE 
             WHEN MAX(0, h.soLuong - COALESCE(booked.daBan, 0)) <= 0 THEN 'HetVe'
             WHEN h.trangThai = 'TaiCho' THEN 'TaiCho'
             ELSE 'ConVe'
           END AS tinhTrangVe
    FROM HangVe h
    LEFT JOIN SuKien s ON s.id = h.suKienId
    LEFT JOIN (
      SELECT hangVeId, SUM(soLuong) as daBan
      FROM DangKy
      WHERE trangThai != 'Huy'
      GROUP BY hangVeId
    ) booked ON booked.hangVeId = h.id
    ${whereClause}
    ORDER BY h.gia ASC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
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

  const cleanEmail = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ message: 'Định dạng email không hợp lệ' });
  }

  const cleanName = fullName.trim();
  const cleanPhone = (phone || '').trim();
  const targetType = (ticketType || 'Standard').trim();

  // 1. Kiểm tra sự kiện có tồn tại không
  db.get('SELECT id, maSuKien, tenSuKien, moTa, loaiSuKien, ngayBatDau, ngayKetThuc, diaDiem FROM SuKien WHERE id = ?', [Number(eventId)], (eventErr, event) => {
    if (eventErr) return res.status(500).json({ message: 'Database error', error: eventErr.message });
    if (!event) return res.status(400).json({ message: 'Sự kiện không tồn tại' });

    // 2. Lấy hoặc tạo người tham dự theo Email
    const getOrCreateGuest = (cb) => {
      db.get('SELECT id, hoTen, email, soDienThoai FROM NguoiThamDu WHERE LOWER(email) = LOWER(?)', [cleanEmail], (userErr, existingUser) => {
        if (userErr) return cb(userErr);
        if (existingUser) {
          if (cleanPhone && !existingUser.soDienThoai) {
            db.run('UPDATE NguoiThamDu SET soDienThoai = ? WHERE id = ?', [cleanPhone, existingUser.id]);
          }
          return cb(null, existingUser.id);
        }

        const maNguoiThamDu = `USER-${Date.now()}`;
        db.run(
          `INSERT INTO NguoiThamDu (maNguoiThamDu, hoTen, email, soDienThoai, trangThai)
           VALUES (?, ?, ?, ?, 'HoatDong')`,
          [maNguoiThamDu, cleanName, cleanEmail, cleanPhone],
          function (insErr) {
            if (insErr) return cb(insErr);
            return cb(null, this.lastID);
          }
        );
      });
    };

    // 3. Lấy hoặc tự động khởi tạo hạng vé cho sự kiện nếu chưa có
    const getOrCreateTicketTier = (cb) => {
      db.all('SELECT * FROM HangVe WHERE suKienId = ? ORDER BY gia DESC', [Number(eventId)], (tierErr, tiers) => {
        if (tierErr) return cb(tierErr);

        if (tiers && tiers.length > 0) {
          let matched = tiers.find(t => t.tenHangVe.toLowerCase() === targetType.toLowerCase());
          if (!matched) {
            matched = tiers.find(t => t.tenHangVe.toLowerCase().includes(targetType.toLowerCase()) || targetType.toLowerCase().includes(t.tenHangVe.toLowerCase()));
          }
          if (!matched) matched = tiers[0];
          return cb(null, matched);
        }

        // Tự động sinh các hạng vé chuẩn cho sự kiện
        const defaultTiers = [
          [`TICKET-VIP-${eventId}`, 'VIP', 2390000, 100, Number(eventId), 'Chỗ ngồi ưu tiên + Lounge networking', 'ConVe'],
          [`TICKET-PRO-${eventId}`, 'Professional', 1490000, 200, Number(eventId), 'Toàn quyền tham dự hội nghị và workshop', 'ConVe'],
          [`TICKET-STD-${eventId}`, 'Standard', 790000, 300, Number(eventId), 'Vé tiêu chuẩn tham dự phiên toàn thể', 'ConVe']
        ];

        let insertedCount = 0;
        let createdTiers = [];
        defaultTiers.forEach((row) => {
          db.run(
            `INSERT INTO HangVe (maHangVe, tenHangVe, gia, soLuong, suKienId, moTa, trangThai)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            row,
            function (insertErr) {
              insertedCount++;
              if (!insertErr) {
                createdTiers.push({ id: this.lastID, tenHangVe: row[1], gia: row[2] });
              }
              if (insertedCount === defaultTiers.length) {
                let chosen = createdTiers.find(t => t.tenHangVe.toLowerCase() === targetType.toLowerCase()) || createdTiers[0];
                return cb(null, chosen);
              }
            }
          );
        });
      });
    };

    getOrCreateGuest((guestErr, guestId) => {
      if (guestErr) return res.status(400).json({ message: 'Không thể tạo người tham dự', error: guestErr.message });

      getOrCreateTicketTier((tierErr, tier) => {
        if (tierErr || !tier) return res.status(400).json({ message: 'Không thể xác định hạng vé', error: tierErr?.message });

        const ticketPrice = Number(tier.gia || (targetType === 'VIP' ? 2390000 : (targetType === 'Standard' ? 790000 : 1490000)));
        const uniqueSuffix = Date.now().toString().slice(-4) + Math.floor(Math.random() * 100);
        const qrCode = `QR-${eventId}-${guestId}-${uniqueSuffix}`;
        const maDangKy = `REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Kiểm tra xem hạng vé này có còn vé không trước khi lưu
        db.get(
          `SELECT h.soLuong,
                  COALESCE(SUM(d.soLuong), 0) AS daBan,
                  MAX(0, h.soLuong - COALESCE(SUM(d.soLuong), 0)) AS conLai
           FROM HangVe h
           LEFT JOIN DangKy d ON d.hangVeId = h.id AND d.trangThai != 'Huy'
           WHERE h.id = ?
           GROUP BY h.id`,
          [tier.id],
          (availErr, availRow) => {
            if (availRow && availRow.conLai <= 0) {
              return res.status(400).json({
                message: `Hạng vé "${tier.tenHangVe}" của sự kiện này hiện đã HẾT VÉ! Vui lòng chọn hạng vé khác.`
              });
            }

            db.run(
              `INSERT INTO DangKy (maDangKy, nguoiThamDuId, suKienId, hangVeId, soLuong, tongTien, trangThai, qrCode)
               VALUES (?, ?, ?, ?, 1, ?, 'DaXacNhan', ?)`,
              [maDangKy, guestId, Number(eventId), tier.id, ticketPrice, qrCode],
              async function (regErr) {
                if (regErr) return res.status(400).json({ message: 'Không thể lưu đăng ký', error: regErr.message });
                
                const lastInsertedId = this.lastID;

            // Kích hoạt AI tự động sinh thông báo & gửi email xác nhận + nhắc lịch
            let notificationResult = null;
            try {
              notificationResult = await processRegistrationNotificationAndEmail({
                guest: {
                  id: guestId,
                  hoTen: cleanName,
                  email: cleanEmail,
                  soDienThoai: cleanPhone
                },
                event,
                ticketTier: tier,
                maDangKy,
                qrCode
              });
            } catch (notiErr) {
              console.warn('[RegisterGuest] Lỗi quy trình thông báo AI:', notiErr);
            }

            return res.status(201).json({
              message: 'Đăng ký thành công',
              maDangKy,
              qrCode,
              ticketType: tier.tenHangVe,
              guestId,
              ticketId: lastInsertedId,
              notification: notificationResult
            });
          }
        );
      });
    });
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
    SELECT d.*, n.hoTen, n.email, n.soDienThoai, 
           COALESCE(s.tenSuKien, 'Sự kiện') as tenSuKien, 
           COALESCE(h.tenHangVe, 'Tiêu chuẩn') as tenHangVe
    FROM DangKy d
    JOIN NguoiThamDu n ON n.id = d.nguoiThamDuId
    LEFT JOIN SuKien s ON s.id = d.suKienId
    LEFT JOIN HangVe h ON h.id = d.hangVeId
    WHERE d.qrCode = ? OR d.maDangKy = ?
  `, [cleanCode, cleanCode], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!row) return res.status(404).json({ message: `Không tìm thấy vé với mã "${cleanCode}"` });
    
    if (row.trangThai === 'Huy') {
      return res.status(400).json({ 
        message: `Vé này đã bị HỦY, không có giá trị để check-in vào sự kiện!`,
        ticket: row,
        isCancelled: true
      });
    }

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
  const email = (req.query.email || (req.user ? req.user.email : null) || '').trim();
  if (!email) {
    return res.status(400).json({ message: 'Vui lòng cung cấp email người tham dự' });
  }

  db.all(`
    SELECT d.id, d.maDangKy, d.qrCode, d.tongTien, d.trangThai, d.thoiGianCheckIn, d.createdAt,
           s.tenSuKien, s.ngayBatDau, s.ngayKetThuc, s.diaDiem, s.bannerUrl,
           COALESCE(h.tenHangVe, 'Tiêu chuẩn') as tenHangVe, COALESCE(h.gia, d.tongTien) as gia
    FROM DangKy d
    JOIN NguoiThamDu n ON n.id = d.nguoiThamDuId
    LEFT JOIN SuKien s ON s.id = d.suKienId
    LEFT JOIN HangVe h ON h.id = d.hangVeId
    WHERE LOWER(n.email) = LOWER(?)
    ORDER BY d.createdAt DESC
  `, [email], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
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

exports.cancelTicket = (req, res) => {
  const { id } = req.params;
  const reason = (req.body.lyDo || req.body.reason || 'Người tham dự yêu cầu hủy vé').trim();
  const callerEmail = (req.body.email || (req.user ? req.user.email : null) || '').trim().toLowerCase();

  db.get(`
    SELECT d.*, n.hoTen, n.email, s.tenSuKien, s.ngayBatDau, s.diaDiem, h.tenHangVe, h.gia
    FROM DangKy d
    JOIN NguoiThamDu n ON n.id = d.nguoiThamDuId
    LEFT JOIN SuKien s ON s.id = d.suKienId
    LEFT JOIN HangVe h ON h.id = d.hangVeId
    WHERE d.id = ? OR d.maDangKy = ?
  `, [id, id], (err, ticket) => {
    if (err) return res.status(500).json({ message: 'Lỗi cơ sở dữ liệu', error: err.message });
    if (!ticket) return res.status(404).json({ message: 'Không tìm thấy thông tin vé cần hủy' });

    // Kiểm tra quyền: nếu là Người tham dự thì phải đúng email của vé
    const isStaffOrAdmin = req.user && ['QuanTriVien', 'BanToChuc', 'KeToan'].includes(req.user.vaiTro);
    if (!isStaffOrAdmin && callerEmail) {
      if (ticket.email.toLowerCase() !== callerEmail) {
        return res.status(403).json({ message: 'Bạn không có quyền hủy vé của người khác' });
      }
    }

    if (ticket.trangThai === 'DaCheckIn') {
      return res.status(400).json({
        message: 'Vé này đã được check-in tại sự kiện nên không thể thực hiện hủy vé.'
      });
    }

    if (ticket.trangThai === 'Huy') {
      return res.status(400).json({
        message: 'Vé này đã được hủy trước đó rồi.'
      });
    }

    db.run(
      `UPDATE DangKy SET trangThai = 'Huy' WHERE id = ?`,
      [ticket.id],
      function (updateErr) {
        if (updateErr) return res.status(500).json({ message: 'Không thể cập nhật hủy vé', error: updateErr.message });

        // Tự động kiểm tra và mở lại trạng thái HangVe nếu trước đó từng bị HetVe
        db.run(`UPDATE HangVe SET trangThai = 'ConVe' WHERE id = ? AND trangThai = 'HetVe'`, [ticket.hangVeId]);

        return res.json({
          message: `Đã hủy vé "${ticket.maDangKy}" (${ticket.tenSuKien} - Hạng ${ticket.tenHangVe}) thành công.`,
          ticket: {
            id: ticket.id,
            maDangKy: ticket.maDangKy,
            tenSuKien: ticket.tenSuKien,
            trangThai: 'Huy',
            lyDo: reason
          }
        });
      }
    );
  });
};

