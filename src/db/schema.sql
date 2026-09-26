CREATE TABLE IF NOT EXISTS TaiKhoan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenDangNhap TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    matKhauHash TEXT NOT NULL,
    vaiTro TEXT NOT NULL CHECK(vaiTro IN ('QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'NguoiThamDu')),
    hoTen TEXT NOT NULL,
    trangThai TEXT NOT NULL DEFAULT 'HoatDong' CHECK(trangThai IN ('HoatDong', 'Khoa', 'ChoXacNhan')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS SuKien (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maSuKien TEXT UNIQUE NOT NULL,
    tenSuKien TEXT NOT NULL,
    moTa TEXT,
    loaiSuKien TEXT NOT NULL,
    ngayBatDau TEXT NOT NULL,
    ngayKetThuc TEXT NOT NULL,
    diaDiem TEXT NOT NULL,
    trangThai TEXT NOT NULL DEFAULT 'SapDienRa' CHECK(trangThai IN ('SapDienRa', 'DangDienRa', 'DaKetThuc')),
    bannerUrl TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS PhienNoiDung (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maPhien TEXT UNIQUE NOT NULL,
    tenPhien TEXT NOT NULL,
    moTa TEXT,
    ngayGio TEXT NOT NULL,
    diaDiem TEXT,
    suKienId INTEGER NOT NULL,
    phong TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (suKienId) REFERENCES SuKien(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS DienGia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maDienGia TEXT UNIQUE NOT NULL,
    tenDienGia TEXT NOT NULL,
    chuyenNganh TEXT,
    gioiThieu TEXT,
    avatarUrl TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS PhienNoiDung_DienGia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phienNoiDungId INTEGER NOT NULL,
    dienGiaId INTEGER NOT NULL,
    UNIQUE(phienNoiDungId, dienGiaId),
    FOREIGN KEY (phienNoiDungId) REFERENCES PhienNoiDung(id) ON DELETE CASCADE,
    FOREIGN KEY (dienGiaId) REFERENCES DienGia(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HangVe (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maHangVe TEXT UNIQUE NOT NULL,
    tenHangVe TEXT NOT NULL,
    gia REAL NOT NULL CHECK(gia >= 0),
    soLuong INTEGER NOT NULL CHECK(soLuong >= 0),
    suKienId INTEGER NOT NULL,
    moTa TEXT,
    trangThai TEXT NOT NULL DEFAULT 'ConVe' CHECK(trangThai IN ('ConVe', 'HetVe', 'TaiCho')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (suKienId) REFERENCES SuKien(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS NguoiThamDu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maNguoiThamDu TEXT UNIQUE NOT NULL,
    hoTen TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    soDienThoai TEXT,
    trangThai TEXT NOT NULL DEFAULT 'HoatDong' CHECK(trangThai IN ('HoatDong', 'Khoa')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS DangKy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maDangKy TEXT UNIQUE NOT NULL,
    nguoiThamDuId INTEGER NOT NULL,
    suKienId INTEGER NOT NULL,
    hangVeId INTEGER NOT NULL,
    soLuong INTEGER NOT NULL DEFAULT 1 CHECK(soLuong > 0),
    tongTien REAL NOT NULL CHECK(tongTien >= 0),
    trangThai TEXT NOT NULL DEFAULT 'DaXacNhan' CHECK(trangThai IN ('ChoXacNhan', 'DaXacNhan', 'Huy')),
    qrCode TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (nguoiThamDuId) REFERENCES NguoiThamDu(id) ON DELETE CASCADE,
    FOREIGN KEY (suKienId) REFERENCES SuKien(id) ON DELETE CASCADE,
    FOREIGN KEY (hangVeId) REFERENCES HangVe(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ThongBao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maThongBao TEXT UNIQUE NOT NULL,
    suKienId INTEGER NOT NULL,
    tieuDe TEXT NOT NULL,
    noiDung TEXT NOT NULL,
    loaiThongBao TEXT NOT NULL CHECK(loaiThongBao IN ('MoiThamDu', 'NhaNho', 'CamOn', 'Khac')),
    nguoiGuiId INTEGER NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (suKienId) REFERENCES SuKien(id) ON DELETE CASCADE,
    FOREIGN KEY (nguoiGuiId) REFERENCES TaiKhoan(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PhanHoi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maPhanHoi TEXT UNIQUE NOT NULL,
    suKienId INTEGER NOT NULL,
    nguoiThamDuId INTEGER,
    danhGia INTEGER CHECK(danhGia BETWEEN 1 AND 5),
    phanHoi TEXT,
    nhomYKien TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (suKienId) REFERENCES SuKien(id) ON DELETE CASCADE,
    FOREIGN KEY (nguoiThamDuId) REFERENCES NguoiThamDu(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS CauHoiChatbot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maCauHoi TEXT UNIQUE NOT NULL,
    cauHoi TEXT NOT NULL,
    cauTraLoi TEXT NOT NULL,
    suKienId INTEGER,
    phienNoiDungId INTEGER,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (suKienId) REFERENCES SuKien(id) ON DELETE CASCADE,
    FOREIGN KEY (phienNoiDungId) REFERENCES PhienNoiDung(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS BaoCaoDoanhThu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maBaoCao TEXT UNIQUE NOT NULL,
    suKienId INTEGER NOT NULL,
    tongDoanhThu REAL NOT NULL CHECK(tongDoanhThu >= 0),
    soVeBan INTEGER NOT NULL DEFAULT 0 CHECK(soVeBan >= 0),
    doanhThuTheoHang TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (suKienId) REFERENCES SuKien(id) ON DELETE CASCADE
);
