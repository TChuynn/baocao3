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

  const matKhauHash = await bcrypt.hash(matKhau, 10);
  db.run(
    `INSERT INTO TaiKhoan (tenDangNhap, email, matKhauHash, vaiTro, hoTen, trangThai) VALUES (?, ?, ?, ?, ?, 'HoatDong')`,
    [tenDangNhap, email, matKhauHash, vaiTro, hoTen],
    function (err) {
      if (err) {
        return res.status(400).json({ message: 'Tên đăng nhập hoặc email đã tồn tại' });
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

  const validRoles = ['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'NguoiThamDu'];
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

  const validRoles = ['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'NguoiThamDu'];
  if (!vaiTro || !validRoles.includes(vaiTro)) {
    return res.status(400).json({ message: 'Vai trò không hợp lệ' });
  }

  db.run(
    `UPDATE TaiKhoan SET vaiTro = ?, trangThai = ? WHERE id = ?`,
    [vaiTro, trangThai || 'HoatDong', id],
    function (err) {
      if (err) return res.status(400).json({ message: 'Không thể cập nhật quyền tài khoản' });
      return res.json({ message: 'Cập nhật quyền tài khoản thành công' });
    }
  );
};
