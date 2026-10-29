const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'event_management.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  // Đảm bảo có các cột phục vụ tính năng khóa tạm tài khoản khi đăng nhập sai
  db.run('ALTER TABLE TaiKhoan ADD COLUMN soLanDangNhapSai INTEGER DEFAULT 0', () => {});
  db.run('ALTER TABLE TaiKhoan ADD COLUMN khoaTamDen TEXT DEFAULT NULL', () => {});

  // Đảm bảo có cột thời lượng phiên (phút) để kiểm tra xung đột thời gian
  db.run('ALTER TABLE PhienNoiDung ADD COLUMN thoiLuong INTEGER DEFAULT 60', () => {});
});

module.exports = db;
