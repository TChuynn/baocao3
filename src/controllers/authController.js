const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      tenDangNhap: user.tenDangNhap,
      vaiTro: user.vaiTro,
      hoTen: user.hoTen,
      email: user.email
    },
    process.env.JWT_SECRET || 'demo-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

exports.login = (req, res) => {
  const { tenDangNhap, matKhau } = req.body;

  if (!tenDangNhap || !matKhau) {
    return res.status(400).json({ message: 'Thiếu thông tin đăng nhập' });
  }

  db.get(
    'SELECT * FROM TaiKhoan WHERE tenDangNhap = ? OR email = ?',
    [tenDangNhap, tenDangNhap],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (!user) {
        return res.status(401).json({ message: 'Tài khoản không tồn tại' });
      }

      const valid = await bcrypt.compare(matKhau, user.matKhauHash);
      if (!valid) {
        return res.status(401).json({ message: 'Mật khẩu không đúng' });
      }

      if (user.trangThai === 'Khoa') {
        return res.status(403).json({ message: 'Tài khoản đã bị khóa' });
      }

      const token = generateToken(user);
      return res.json({
        token,
        user: {
          id: user.id,
          tenDangNhap: user.tenDangNhap,
          hoTen: user.hoTen,
          vaiTro: user.vaiTro,
          email: user.email,
          trangThai: user.trangThai
        }
      });
    }
  );
};

exports.register = async (req, res) => {
  const { tenDangNhap, email, matKhau, hoTen, vaiTro = 'NguoiThamDu' } = req.body;

  if (!tenDangNhap || !email || !matKhau || !hoTen) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
  }

  const validRoles = ['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'NguoiThamDu', 'KeToan'];
  if (!validRoles.includes(vaiTro)) {
    return res.status(400).json({ message: 'Vai trò không hợp lệ' });
  }

  const cleanEmail = email.trim();
  const cleanUsername = tenDangNhap.trim();
  const cleanName = hoTen.trim();

  const matKhauHash = await bcrypt.hash(matKhau, 10);
  db.run(
    `INSERT INTO TaiKhoan (tenDangNhap, email, matKhauHash, vaiTro, hoTen, trangThai) VALUES (?, ?, ?, ?, ?, 'HoatDong')`,
    [cleanUsername, cleanEmail, matKhauHash, vaiTro, cleanName],
    function (err) {
      if (err) {
        return res.status(400).json({ message: 'Tên đăng nhập hoặc email đã tồn tại' });
      }

      // Đảm bảo tạo sẵn profile NguoiThamDu nếu tài khoản là Người tham dự
      if (vaiTro === 'NguoiThamDu') {
        db.get('SELECT id FROM NguoiThamDu WHERE LOWER(email) = LOWER(?)', [cleanEmail], (userErr, row) => {
          if (!userErr && !row) {
            db.run(
              `INSERT INTO NguoiThamDu (maNguoiThamDu, hoTen, email, soDienThoai, trangThai)
               VALUES (?, ?, ?, '', 'HoatDong')`,
              [`USER-${Date.now()}`, cleanName, cleanEmail]
            );
          }
        });
      }

      return res.status(201).json({ message: 'Đăng ký thành công' });
    }
  );
};

exports.getProfile = (req, res) => {
  const user = req.user;
  return res.json({ user });
};

exports.listAccounts = (req, res) => {
  db.all(
    `SELECT id, tenDangNhap, email, hoTen, vaiTro, trangThai, createdAt
     FROM TaiKhoan
     ORDER BY createdAt DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      return res.json(rows);
    }
  );
};

exports.createAccount = async (req, res) => {
  const { tenDangNhap, email, matKhau, hoTen, vaiTro = 'NguoiThamDu', trangThai = 'HoatDong' } = req.body;

  if (!tenDangNhap || !email || !matKhau || !hoTen) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc cho tài khoản' });
  }

  const validRoles = ['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'NguoiThamDu', 'KeToan'];
  if (!validRoles.includes(vaiTro)) {
    return res.status(400).json({ message: 'Vai trò không hợp lệ' });
  }

  const matKhauHash = await bcrypt.hash(matKhau, 10);

  db.run(
    `INSERT INTO TaiKhoan (tenDangNhap, email, matKhauHash, vaiTro, hoTen, trangThai)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenDangNhap, email, matKhauHash, vaiTro, hoTen, trangThai],
    function (err) {
      if (err) {
        return res.status(400).json({ message: 'Tên đăng nhập hoặc email đã tồn tại' });
      }
      return res.status(201).json({ message: 'Tạo tài khoản thành công', id: this.lastID });
    }
  );
};

exports.updateAccountRole = (req, res) => {
  const { id } = req.params;
  const { vaiTro, trangThai } = req.body;

  const validRoles = ['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'NguoiThamDu', 'KeToan'];
  if (!vaiTro || !validRoles.includes(vaiTro)) {
    return res.status(400).json({ message: 'Vai trò không hợp lệ' });
  }

  // An toàn: Không cho phép Admin tự khóa tài khoản của chính mình
  if (req.user && req.user.id === Number(id) && trangThai === 'Khoa') {
    return res.status(400).json({ message: 'Không thể tự khóa tài khoản quản trị của chính bạn' });
  }

  db.run(
    `UPDATE TaiKhoan SET vaiTro = ?, trangThai = ? WHERE id = ?`,
    [vaiTro, trangThai || 'HoatDong', id],
    function (err) {
      if (err) return res.status(400).json({ message: 'Không thể cập nhật quyền tài khoản' });
      if (this.changes === 0) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
      return res.json({ message: 'Cập nhật quyền tài khoản thành công' });
    }
  );
};

exports.updateAccount = async (req, res) => {
  const { id } = req.params;
  const { tenDangNhap, email, hoTen, vaiTro, trangThai, matKhau } = req.body;

  if (!tenDangNhap || !email || !hoTen || !vaiTro) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc (Tên đăng nhập, email, họ tên, vai trò)' });
  }

  const validRoles = ['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'NguoiThamDu', 'KeToan'];
  if (!validRoles.includes(vaiTro)) {
    return res.status(400).json({ message: 'Vai trò không hợp lệ' });
  }

  const validStatus = ['HoatDong', 'Khoa', 'ChoXacNhan'];
  const newStatus = trangThai || 'HoatDong';
  if (!validStatus.includes(newStatus)) {
    return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
  }

  // An toàn: Không cho phép Admin tự khóa tài khoản của chính mình
  if (req.user && req.user.id === Number(id) && newStatus === 'Khoa') {
    return res.status(400).json({ message: 'Không thể tự khóa tài khoản quản trị của chính bạn' });
  }

  const cleanUsername = tenDangNhap.trim();
  const cleanEmail = email.trim();
  const cleanName = hoTen.trim();

  // Kiểm tra trùng lặp tên đăng nhập hoặc email với tài khoản khác
  db.get(
    `SELECT id FROM TaiKhoan WHERE (tenDangNhap = ? OR email = ?) AND id != ?`,
    [cleanUsername, cleanEmail, id],
    async (err, existing) => {
      if (err) return res.status(500).json({ message: 'Lỗi cơ sở dữ liệu' });
      if (existing) {
        return res.status(400).json({ message: 'Tên đăng nhập hoặc email đã được sử dụng bởi tài khoản khác' });
      }

      try {
        let sql, params;
        if (matKhau && matKhau.trim()) {
          const matKhauHash = await bcrypt.hash(matKhau.trim(), 10);
          sql = `UPDATE TaiKhoan SET tenDangNhap = ?, email = ?, hoTen = ?, vaiTro = ?, trangThai = ?, matKhauHash = ? WHERE id = ?`;
          params = [cleanUsername, cleanEmail, cleanName, vaiTro, newStatus, matKhauHash, id];
        } else {
          sql = `UPDATE TaiKhoan SET tenDangNhap = ?, email = ?, hoTen = ?, vaiTro = ?, trangThai = ? WHERE id = ?`;
          params = [cleanUsername, cleanEmail, cleanName, vaiTro, newStatus, id];
        }

        db.run(sql, params, function (updateErr) {
          if (updateErr) {
            return res.status(400).json({ message: 'Không thể cập nhật tài khoản: ' + updateErr.message });
          }
          if (this.changes === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản cần sửa' });
          }
          return res.json({ message: 'Cập nhật tài khoản thành công' });
        });
      } catch (hashErr) {
        return res.status(500).json({ message: 'Lỗi xử lý mật khẩu' });
      }
    }
  );
};

exports.deleteAccount = (req, res) => {
  const { id } = req.params;

  // An toàn: Không cho phép Admin tự xóa chính tài khoản mình
  if (req.user && req.user.id === Number(id)) {
    return res.status(400).json({ message: 'Không thể tự xóa tài khoản quản trị của chính bạn' });
  }

  db.get(`SELECT id, tenDangNhap, email, hoTen FROM TaiKhoan WHERE id = ?`, [id], (err, user) => {
    if (err) return res.status(500).json({ message: 'Lỗi cơ sở dữ liệu' });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản cần xóa' });

    db.run(`DELETE FROM TaiKhoan WHERE id = ?`, [id], function (delErr) {
      if (delErr) {
        return res.status(500).json({ message: 'Lỗi khi xóa tài khoản: ' + delErr.message });
      }
      return res.json({ message: `Đã xóa vĩnh viễn tài khoản "${user.tenDangNhap}" (${user.hoTen}) thành công.` });
    });
  });
};

exports.toggleLockAccount = (req, res) => {
  const { id } = req.params;

  // An toàn: Không cho phép Admin tự khóa chính mình
  if (req.user && req.user.id === Number(id)) {
    return res.status(400).json({ message: 'Không thể tự khóa tài khoản quản trị của chính bạn' });
  }

  db.get(`SELECT id, tenDangNhap, hoTen, trangThai FROM TaiKhoan WHERE id = ?`, [id], (err, user) => {
    if (err) return res.status(500).json({ message: 'Lỗi cơ sở dữ liệu' });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    const newStatus = user.trangThai === 'Khoa' ? 'HoatDong' : 'Khoa';
    db.run(
      `UPDATE TaiKhoan SET trangThai = ? WHERE id = ?`,
      [newStatus, id],
      function (updateErr) {
        if (updateErr) return res.status(500).json({ message: 'Không thể thay đổi trạng thái tài khoản' });
        const actionMsg = newStatus === 'Khoa' 
          ? `Đã khóa tài khoản "${user.tenDangNhap}" (${user.hoTen}). Người dùng này sẽ không thể đăng nhập.` 
          : `Đã mở khóa tài khoản "${user.tenDangNhap}" (${user.hoTen}) thành công.`;
        return res.json({ message: actionMsg, trangThai: newStatus });
      }
    );
  });
};
