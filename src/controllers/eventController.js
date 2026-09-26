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
      return res.status(201).json({ id: this.lastID, message: 'Tạo sự kiện thành công' });
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
    return res.json({ message: 'Xóa sự kiện thành công' });
  });
};
