const db = require('../config/db');

exports.listEvents = (req, res) => {
  db.all(
    `SELECT * FROM SuKien ORDER BY ngayBatDau DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      return res.json(rows);
    }
  );
};

exports.getEventById = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM SuKien WHERE id = ?`, [id], (err, event) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện' });

    db.all(`SELECT * FROM PhienNoiDung WHERE suKienId = ? ORDER BY ngayGio ASC`, [id], (sessionErr, sessions) => {
      db.all(`SELECT * FROM HangVe WHERE suKienId = ? ORDER BY gia ASC`, [id], (ticketErr, tickets) => {
        return res.json({ event, sessions, tickets });
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
