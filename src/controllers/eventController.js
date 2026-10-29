const db = require('../config/db');

exports.listEvents = (req, res) => {
  const { q, search, tuKhoa, trangThai, status, loaiSuKien, category } = req.query;
  const keyword = (q || search || tuKhoa || '').trim();
  const filterStatus = (trangThai || status || '').trim();
  const filterCategory = (loaiSuKien || category || '').trim();

  const whereConditions = [];
  const params = [];

  if (keyword) {
    whereConditions.push(`(
      s.tenSuKien LIKE ? OR 
      s.moTa LIKE ? OR 
      s.diaDiem LIKE ? OR 
      s.loaiSuKien LIKE ? OR 
      s.maSuKien LIKE ?
    )`);
    const kwPattern = `%${keyword}%`;
    params.push(kwPattern, kwPattern, kwPattern, kwPattern, kwPattern);
  }

  if (filterStatus && filterStatus !== 'all') {
    whereConditions.push(`s.trangThai = ?`);
    params.push(filterStatus);
  }

  if (filterCategory && filterCategory !== 'all') {
    whereConditions.push(`s.loaiSuKien = ?`);
    params.push(filterCategory);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const sql = `
    SELECT s.*,
           COALESCE(SUM(h.soLuong), 0) AS tongSoVe,
           COALESCE(SUM(booked.daBan), 0) AS soVeDaBan,
           MAX(0, COALESCE(SUM(h.soLuong), 0) - COALESCE(SUM(booked.daBan), 0)) AS soVeConLai,
           MIN(h.gia) AS giaVeTu
    FROM SuKien s
    LEFT JOIN HangVe h ON h.suKienId = s.id
    LEFT JOIN (
      SELECT hangVeId, SUM(soLuong) AS daBan
      FROM DangKy
      WHERE trangThai != 'Huy'
      GROUP BY hangVeId
    ) booked ON booked.hangVeId = h.id
    ${whereClause}
    GROUP BY s.id
    ORDER BY s.ngayBatDau DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    return res.json(rows);
  });
};

exports.getEventById = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM SuKien WHERE id = ?`, [id], (err, event) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện' });

    db.all(`SELECT * FROM PhienNoiDung WHERE suKienId = ? ORDER BY ngayGio ASC`, [id], (sessionErr, sessions) => {
      const sessionList = sessions || [];
      const finishWithTickets = (enhancedSessions) => {
        const ticketSql = `
          SELECT h.*,
                 COALESCE(booked.daBan, 0) AS daBan,
                 MAX(0, h.soLuong - COALESCE(booked.daBan, 0)) AS conLai,
                 CASE 
                   WHEN MAX(0, h.soLuong - COALESCE(booked.daBan, 0)) <= 0 THEN 'HetVe'
                   WHEN h.trangThai = 'TaiCho' THEN 'TaiCho'
                   ELSE 'ConVe'
                 END AS tinhTrangVe
          FROM HangVe h
          LEFT JOIN (
            SELECT hangVeId, SUM(soLuong) as daBan
            FROM DangKy
            WHERE trangThai != 'Huy'
            GROUP BY hangVeId
          ) booked ON booked.hangVeId = h.id
          WHERE h.suKienId = ?
          ORDER BY h.gia ASC
        `;

        db.all(ticketSql, [id], (ticketErr, tickets) => {
          return res.json({ event, sessions: enhancedSessions, tickets });
        });
      };

      if (sessionList.length === 0) {
        return finishWithTickets([]);
      }

      const sessionIds = sessionList.map(s => s.id);
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

        const enhanced = sessionList.map(s => ({
          ...s,
          dienGia: speakersBySession[s.id] || []
        }));
        finishWithTickets(enhanced);
      });
    });
  });
};

exports.createEvent = (req, res) => {
  const { maSuKien, tenSuKien, moTa, loaiSuKien, ngayBatDau, ngayKetThuc, diaDiem, trangThai, bannerUrl } = req.body;

  db.run(
    `INSERT INTO SuKien (maSuKien, tenSuKien, moTa, loaiSuKien, ngayBatDau, ngayKetThuc, diaDiem, trangThai, bannerUrl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [maSuKien, tenSuKien, moTa, loaiSuKien, ngayBatDau, ngayKetThuc, diaDiem, trangThai || 'SapDienRa', bannerUrl || ''],
    function (err) {
      if (err) return res.status(400).json({ message: 'Không thể tạo sự kiện', error: err.message });
      const eventId = this.lastID;

      // Tự động khởi tạo 3 hạng vé cơ bản cho sự kiện mới
      const defaultTiers = [
        [`TICKET-VIP-${eventId}`, 'VIP', 2390000, 100, eventId, 'Chỗ ngồi ưu tiên + Lounge networking', 'ConVe'],
        [`TICKET-PRO-${eventId}`, 'Professional', 1490000, 200, eventId, 'Toàn quyền tham dự hội nghị và workshop', 'ConVe'],
        [`TICKET-STD-${eventId}`, 'Standard', 790000, 300, eventId, 'Vé tiêu chuẩn tham dự phiên toàn thể', 'ConVe']
      ];

      defaultTiers.forEach(t => {
        db.run(
          `INSERT OR IGNORE INTO HangVe (maHangVe, tenHangVe, gia, soLuong, suKienId, moTa, trangThai)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          t
        );
      });

      return res.status(201).json({ id: eventId, message: 'Tạo sự kiện thành công' });
    }
  );
};

exports.updateEvent = (req, res) => {
  const { id } = req.params;
  const { tenSuKien, moTa, loaiSuKien, ngayBatDau, ngayKetThuc, diaDiem, trangThai } = req.body;

  db.run(
    `UPDATE SuKien SET tenSuKien = ?, moTa = ?, loaiSuKien = ?, ngayBatDau = ?, ngayKetThuc = ?, diaDiem = ?, trangThai = ? WHERE id = ?`,
    [tenSuKien, moTa, loaiSuKien, ngayBatDau, ngayKetThuc, diaDiem, trangThai, id],
    function (err) {
      if (err) return res.status(400).json({ message: 'Không thể cập nhật sự kiện' });
      return res.json({ message: 'Cập nhật thành công' });
    }
  );
};

exports.deleteEvent = (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM SuKien WHERE id = ?', [id], function (err) {
    if (err) return res.status(400).json({ message: 'Không thể xóa sự kiện' });
    if (this.changes === 0) return res.status(404).json({ message: 'Không tìm thấy sự kiện' });
    return res.json({ message: 'Xóa sự kiện thành công' });
  });
};
