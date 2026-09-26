const api = {
  async get(path, withAuth = false) {
    const headers = {};
    if (withAuth) {
      const token = localStorage.getItem('event_token');
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(path, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Request failed');
    }
    return res.json();
  },
  async post(path, body = {}, withAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (withAuth) {
      const token = localStorage.getItem('event_token');
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  },
  async put(path, body = {}, withAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (withAuth) {
      const token = localStorage.getItem('event_token');
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(path, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  }
};

const state = {
  currentUser: null,
  events: [],
  chatDragging: false,
  chatResize: false
};

function setActiveSection(section) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.section === section));
  document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('active', screen.id === section));
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function saveSession(token, user) {
  localStorage.setItem('event_token', token);
  localStorage.setItem('event_user', JSON.stringify(user));
  state.currentUser = user;
  updateUserState();
}

function clearSession() {
  localStorage.removeItem('event_token');
  localStorage.removeItem('event_user');
  state.currentUser = null;
  updateUserState();
}

function updateUserState() {
  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  if (user) {
    document.getElementById('currentUser').textContent = user.hoTen || user.tenDangNhap;
    document.getElementById('loginBtn').textContent = 'Đăng xuất';
  } else {
    document.getElementById('currentUser').textContent = 'Khách';
    document.getElementById('loginBtn').textContent = 'Đăng nhập';
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => setActiveSection(item.dataset.section));
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

document.getElementById('createEventBtn').addEventListener('click', () => {
  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  if (!user || !['QuanTriVien', 'BanToChuc'].includes(user.vaiTro)) {
    alert('Chỉ Admin hoặc Ban tổ chức mới được tạo sự kiện.');
    openModal('authModal');
    return;
  }
  openModal('eventModal');
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  if (user) {
    clearSession();
    return;
  }
  openModal('authModal');
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const payload = {
    tenDangNhap: form.get('tenDangNhap'),
    matKhau: form.get('matKhau')
  };

  try {
    const result = await api.post('/api/auth/login', payload);
    saveSession(result.token, result.user);
    closeModal('authModal');
    e.currentTarget.reset();
    alert('Đăng nhập thành công');
  } catch (error) {
    alert(error.message || 'Đăng nhập thất bại');
  }
});

document.getElementById('accountForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  if (!user || user.vaiTro !== 'QuanTriVien') {
    alert('Chỉ quản trị viên mới có quyền tạo và phân quyền tài khoản.');
    return;
  }

  const form = new FormData(e.currentTarget);
  const payload = {
    tenDangNhap: form.get('tenDangNhap'),
    email: form.get('email'),
    matKhau: form.get('matKhau'),
    hoTen: form.get('hoTen'),
    vaiTro: form.get('vaiTro')
  };

  try {
    await api.post('/api/accounts', payload, true);
    alert('Tạo tài khoản thành công');
    e.currentTarget.reset();
    await loadAccounts();
  } catch (error) {
    alert(error.message || 'Tạo tài khoản thất bại');
  }
});

document.getElementById('eventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  if (!user || !['QuanTriVien', 'BanToChuc'].includes(user.vaiTro)) {
    alert('Bạn không có quyền tạo sự kiện');
    return;
  }

  const form = new FormData(e.currentTarget);
  const payload = {
    maSuKien: form.get('maSuKien'),
    tenSuKien: form.get('tenSuKien'),
    moTa: form.get('moTa'),
    loaiSuKien: form.get('loaiSuKien'),
    ngayBatDau: form.get('ngayBatDau'),
    ngayKetThuc: form.get('ngayKetThuc'),
    diaDiem: form.get('diaDiem'),
    trangThai: form.get('trangThai'),
    bannerUrl: form.get('bannerUrl')
  };

  const eventId = form.get('eventId');

  try {
    if (eventId) {
      await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('event_token')}`
        },
        body: JSON.stringify(payload)
      });
      alert('Cập nhật sự kiện thành công');
    } else {
      await api.post('/api/events', payload, true);
      alert('Tạo sự kiện thành công');
    }

    closeModal('eventModal');
    e.currentTarget.reset();
    await loadDashboard();
    await loadEvents();
  } catch (error) {
    alert(error.message || 'Tạo/cập nhật sự kiện thất bại');
  }
});

document.getElementById('sessionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const payload = {
    maPhien: form.get('maPhien'),
    tenPhien: form.get('tenPhien'),
    ngayGio: form.get('ngayGio'),
    phong: form.get('phong'),
    suKienId: 1,
    diaDiem: 'Main Hall'
  };

  try {
    await api.post('/api/sessions', payload, true);
    alert('Thêm phiên nội dung thành công');
    e.currentTarget.reset();
  } catch (err) {
    alert(err.message || 'Thêm phiên thất bại');
  }
});

document.getElementById('speakerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const payload = {
    maDienGia: form.get('maDienGia'),
    tenDienGia: form.get('tenDienGia'),
    chuyenNganh: form.get('chuyenNganh')
  };

  try {
    await api.post('/api/speakers', payload, true);
    alert('Thêm diễn giả thành công');
    e.currentTarget.reset();
  } catch (err) {
    alert(err.message || 'Thêm diễn giả thất bại');
  }
});

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function buildQrUrl(code) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(code || 'EVENT-QR')}`;
}

async function loadDashboard() {
  const events = await api.get('/api/events');
  state.events = events;
  document.getElementById('statEvents').textContent = events.length;

  try {
    const summary = await api.get('/api/dashboard/summary', true);
    document.getElementById('statGuests').textContent = summary.totalGuests || 0;
    document.getElementById('statRevenue').textContent = formatCurrency(summary.revenue || 0);
    document.getElementById('statAi').textContent = `${summary.aiScore || 92}%`;
  } catch (error) {
    document.getElementById('statGuests').textContent = '1.2K';
    document.getElementById('statRevenue').textContent = formatCurrency(842500000);
    document.getElementById('statAi').textContent = '92%';
  }

  const upcoming = events.slice(0, 3).map(event => `<li><strong>${event.tenSuKien}</strong><br><small>${event.ngayBatDau}</small></li>`).join('');
  document.getElementById('upcomingEvents').innerHTML = upcoming || '<li>Chưa có sự kiện nào.</li>';

  document.getElementById('aiSummary').innerHTML = `- 78% phản hồi hài lòng\n- 46% đề xuất thêm thời gian Q&A\n- 83% đánh giá không gian tổ chức tốt`;
}

async function loadReports() {
  try {
    const reports = await api.get('/api/reports', true);
    const reportSummary = reports.length
      ? reports.reduce((sum, item) => sum + Number(item.tongDoanhThu || 0), 0)
      : 0;

    document.getElementById('reportSummary').innerHTML = `Tổng doanh thu: ${formatCurrency(reportSummary)}\nSố báo cáo: ${reports.length}\nSự kiện đang theo dõi: ${state.events.length || 0}`;

    document.getElementById('reportList').innerHTML = (reports || []).map(report => `
      <div class="card" style="margin-bottom: 12px;">
        <strong>${report.maBaoCao}</strong>
        <small>Sự kiện ID: ${report.suKienId}</small>
        <span>Doanh thu: ${formatCurrency(report.tongDoanhThu || 0)}</span>
        <span>Vé bán: ${report.soVeBan || 0}</span>
      </div>
    `).join('') || '<p>Chưa có báo cáo doanh thu.</p>';
  } catch (error) {
    document.getElementById('reportSummary').innerHTML = 'Bạn cần đăng nhập với quyền quản trị hoặc ban tổ chức để xem báo cáo.';
    document.getElementById('reportList').innerHTML = '<p>Không có dữ liệu báo cáo.</p>';
  }
}

async function loadRegisteredTickets() {
  try {
    const registrations = await api.get('/api/registrations', true);
    const list = document.getElementById('registeredTicketsList');

    list.innerHTML = (registrations || []).map(reg => `
      <div class="card ticket-card">
        <strong>${reg.hoTen}</strong>
        <span>${reg.tenSuKien}</span>
        <span>Hạng vé: ${reg.tenHangVe}</span>
        <span>Giá: ${formatCurrency(reg.tongTien || 0)}</span>
        <span>Mã vé: ${reg.maDangKy}</span>
        <img class="qr-code" src="${buildQrUrl(reg.qrCode || reg.maDangKy)}" alt="QR check-in ${reg.maDangKy}" />
      </div>
    `).join('') || '<p>Chưa có vé nào được đặt.</p>';
  } catch (error) {
    document.getElementById('registeredTicketsList').innerHTML = '<p>Không thể tải QR check-in.</p>';
  }
}

async function loadAccounts() {
  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  if (!user || user.vaiTro !== 'QuanTriVien') {
    document.getElementById('accountList').innerHTML = '<p>Chỉ quản trị viên mới xem và phân quyền tài khoản.</p>';
    return;
  }

  try {
    const accounts = await api.get('/api/accounts', true);
    const html = accounts.map(account => `
      <div class="card">
        <h4>${account.hoTen}</h4>
        <p>${account.tenDangNhap} · ${account.email}</p>
        <div class="form-row two-col" style="margin-top: 10px;">
          <select data-role-select="${account.id}">
            <option value="QuanTriVien" ${account.vaiTro === 'QuanTriVien' ? 'selected' : ''}>Quản trị viên</option>
            <option value="BanToChuc" ${account.vaiTro === 'BanToChuc' ? 'selected' : ''}>Ban tổ chức</option>
            <option value="NhanVienCheckIn" ${account.vaiTro === 'NhanVienCheckIn' ? 'selected' : ''}>Nhân viên check-in</option>
            <option value="NguoiThamDu" ${account.vaiTro === 'NguoiThamDu' ? 'selected' : ''}>Người tham dự</option>
          </select>
          <select data-status-select="${account.id}">
            <option value="HoatDong" ${account.trangThai === 'HoatDong' ? 'selected' : ''}>Hoạt động</option>
            <option value="Khoa" ${account.trangThai === 'Khoa' ? 'selected' : ''}>Khóa</option>
            <option value="ChoXacNhan" ${account.trangThai === 'ChoXacNhan' ? 'selected' : ''}>Chờ xác nhận</option>
          </select>
        </div>
        <button class="primary" data-account-update="${account.id}" style="margin-top: 10px;">Cập nhật quyền</button>
      </div>
    `).join('');

    document.getElementById('accountList').innerHTML = html || '<p>Chưa có tài khoản nào.</p>';
  } catch (error) {
    document.getElementById('accountList').innerHTML = `<p>${error.message || 'Không thể tải danh sách tài khoản.'}</p>`;
  }
}

document.getElementById('accountList').addEventListener('click', async (e) => {
  const button = e.target.closest('[data-account-update]');
  if (!button) return;

  const id = button.dataset.accountUpdate;
  const roleSelect = document.querySelector(`[data-role-select="${id}"]`);
  const statusSelect = document.querySelector(`[data-status-select="${id}"]`);

  if (!roleSelect || !statusSelect) return;

  try {
    await api.put(`/api/accounts/${id}/role`, {
      vaiTro: roleSelect.value,
      trangThai: statusSelect.value
    }, true);
    alert('Cập nhật quyền tài khoản thành công');
    await loadAccounts();
  } catch (error) {
    alert(error.message || 'Cập nhật quyền thất bại');
  }
});

async function loadEvents() {
  const events = await api.get('/api/events');
  const html = events.map(event => `
    <div class="card">
      <div class="badge">${event.trangThai}</div>
      <h3>${event.tenSuKien}</h3>
      <p>${event.moTa}</p>
      <small>${event.diaDiem}</small>
      <small>${event.ngayBatDau} - ${event.ngayKetThuc}</small>
      <div class="card-actions">
        <button class="small-btn edit" data-edit="${event.id}">Sửa</button>
        <button class="small-btn delete" data-delete="${event.id}">Xóa</button>
      </div>
    </div>
  `).join('');
  document.getElementById('eventList').innerHTML = html || '<div class="card"><p>Chưa có sự kiện nào.</p></div>';

  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.edit);
      const event = state.events.find(item => item.id === id);
      if (!event) return;
      const form = document.getElementById('eventForm');
      form.eventId.value = event.id;
      form.maSuKien.value = event.maSuKien;
      form.tenSuKien.value = event.tenSuKien;
      form.moTa.value = event.moTa;
      form.loaiSuKien.value = event.loaiSuKien;
      form.ngayBatDau.value = event.ngayBatDau.slice(0, 16);
      form.ngayKetThuc.value = event.ngayKetThuc.slice(0, 16);
      form.diaDiem.value = event.diaDiem;
      form.trangThai.value = event.trangThai;
      form.bannerUrl.value = event.bannerUrl || '';
      document.getElementById('eventSubmitBtn').textContent = 'Cập nhật sự kiện';
      openModal('eventModal');
    });
  });

  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.delete);
      try {
        const res = await fetch(`/api/events/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('event_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Xóa thất bại');
        alert('Xóa sự kiện thành công');
        await loadDashboard();
        await loadEvents();
      } catch (err) {
        alert(err.message || 'Xóa thất bại');
      }
    });
  });
}

document.getElementById('registrationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const payload = {
    fullName: form.get('fullName'),
    email: form.get('email'),
    phone: form.get('phone'),
    eventId: form.get('eventId'),
    ticketType: form.get('ticketType')
  };

  try {
    const result = await api.post('/api/registrations', payload);
    alert(`${result.message}. Mã QR: ${result.qrCode || 'N/A'}`);
    e.currentTarget.reset();
    await loadRegisteredTickets();
  } catch (err) {
    alert(err.message || 'Đăng ký thất bại');
  }
});

document.getElementById('ticketForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const payload = {
    maHangVe: form.get('maHangVe'),
    tenHangVe: form.get('tenHangVe'),
    gia: Number(form.get('gia')),
    soLuong: Number(form.get('soLuong')),
    suKienId: Number(form.get('suKienId')),
    moTa: 'Ticket created from demo UI',
    trangThai: 'ConVe'
  };

  try {
    await api.post('/api/tickets', payload, true);
    alert('Thêm hạng vé thành công');
    e.currentTarget.reset();
  } catch (err) {
    alert(err.message || 'Thêm hạng vé thất bại');
  }
});

document.getElementById('checkInBtn').addEventListener('click', async () => {
  const code = document.getElementById('checkinCode').value;
  try {
    const result = await api.post('/api/checkin', { maVe: code }, true);
    document.getElementById('checkinResult').textContent = `${result.message}: ${result.registration.maDangKy}`;
  } catch (err) {
    document.getElementById('checkinResult').textContent = err.message || 'Check-in thất bại';
  }
});

document.getElementById('generateNotificationBtn').addEventListener('click', async () => {
  const text = document.getElementById('notificationInput').value;
  try {
    const result = await api.post('/api/ai/generate-notification', { type: 'MoiThamDu', message: text, eventId: 1 }, true);
    document.getElementById('notificationOutput').textContent = result.content || JSON.stringify(result, null, 2);
  } catch (error) {
    document.getElementById('notificationOutput').textContent = error.message;
  }
});

document.getElementById('chatBtn').addEventListener('click', async () => {
  const q = document.getElementById('chatQuestion').value;
  const result = await api.post('/api/ai/chatbot', { question: q, eventId: 1 });
  document.getElementById('chatOutput').textContent = result.answer || 'Không có câu trả lời';
});

document.getElementById('chatWidgetBtn').addEventListener('click', async () => {
  const input = document.getElementById('chatWidgetInput');
  const question = input.value.trim();
  if (!question) return;
  const messages = document.getElementById('chatMessages');
  messages.innerHTML += `<div class="msg user">${question}</div>`;
  const result = await api.post('/api/ai/chatbot', { question, eventId: 1 });
  messages.innerHTML += `<div class="msg bot">${result.answer}</div>`;
  input.value = '';
  messages.scrollTop = messages.scrollHeight;
});

const chatWidget = document.getElementById('chatWidget');
const chatDragHandle = document.getElementById('chatDragHandle');
const chatResizeHandle = document.getElementById('chatResizeHandle');
const chatMinimizeBtn = document.getElementById('chatMinimizeBtn');
const chatExpandBtn = document.getElementById('chatExpandBtn');

chatMinimizeBtn.addEventListener('click', () => {
  chatWidget.classList.toggle('minimized');
  chatWidget.classList.remove('expanded');
});

chatExpandBtn.addEventListener('click', () => {
  chatWidget.classList.toggle('expanded');
  chatWidget.classList.remove('minimized');
});

chatDragHandle.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;

  state.chatDragging = true;
  const startX = event.clientX - chatWidget.offsetLeft;
  const startY = event.clientY - chatWidget.offsetTop;

  function onPointerMove(moveEvent) {
    if (!state.chatDragging) return;
    const left = Math.max(8, Math.min(window.innerWidth - chatWidget.offsetWidth - 8, moveEvent.clientX - startX));
    const top = Math.max(8, Math.min(window.innerHeight - chatWidget.offsetHeight - 8, moveEvent.clientY - startY));
    chatWidget.style.left = `${left}px`;
    chatWidget.style.top = `${top}px`;
    chatWidget.style.right = 'auto';
    chatWidget.style.bottom = 'auto';
  }

  function onPointerUp() {
    state.chatDragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
});

chatResizeHandle.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  state.chatResize = true;
  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = chatWidget.offsetWidth;
  const startHeight = chatWidget.offsetHeight;

  function onPointerMove(moveEvent) {
    if (!state.chatResize) return;
    const nextWidth = Math.max(280, startWidth + (moveEvent.clientX - startX));
    const nextHeight = Math.max(220, startHeight + (moveEvent.clientY - startY));
    chatWidget.style.width = `${nextWidth}px`;
    chatWidget.style.height = `${nextHeight}px`;
  }

  function onPointerUp() {
    state.chatResize = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
});

async function init() {
  updateUserState();
  await loadDashboard();
  await loadEvents();
  await loadAccounts();
  await loadReports();
  await loadRegisteredTickets();
}

init();
