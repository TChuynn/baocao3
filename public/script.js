/**
 * AI EventHub - Strict Role-Based Portal Controller
 * Real system authentication: Users see ONLY the interface of their authenticated role.
 */

// ================= API SERVICE =================
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
      throw new Error(err.message || 'Yêu cầu không thành công');
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
      throw new Error(data.message || 'Yêu cầu không thành công');
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
      throw new Error(data.message || 'Yêu cầu không thành công');
    }
    return data;
  },

  async delete(path, withAuth = true) {
    const headers = {};
    if (withAuth) {
      const token = localStorage.getItem('event_token');
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(path, { method: 'DELETE', headers });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new Error(data.message || 'Yêu cầu xóa không thành công');
    }
    return data;
  }
};

// ================= APP STATE =================
const state = {
  currentUser: null,
  events: [],
  accounts: [],
  registrations: [],
  html5QrScanner: null,
  isScanning: false
};

// Role Portal Configuration
const ROLE_PORTALS = {
  QuanTriVien: { label: 'Quản trị viên', portalId: 'view-admin', badgeClass: 'admin' },
  BanToChuc: { label: 'Ban tổ chức', portalId: 'view-btc', badgeClass: 'btc' },
  NhanVienCheckIn: { label: 'Nhân viên Check-in', portalId: 'view-checkin', badgeClass: 'staff' },
  KeToan: { label: 'Kế toán', portalId: 'view-ketoan', badgeClass: 'ketoan' },
  NguoiThamDu: { label: 'Người tham dự', portalId: 'view-attendee', badgeClass: 'attendee' }
};

// ================= UTILITIES =================
function formatCurrency(val) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(val || 0));
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleString('vi-VN', { hour12: false });
  } catch (e) {
    return isoStr;
  }
}

function buildQrUrl(code) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(code || 'AI-EVENT')}`;
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

// ================= STRICT ROLE-BASED VIEW CONTROL =================
/**
 * Applies the view strictly matching the authenticated user's role.
 * If user is null:
 *   - Renders the public Landing Page (Hero, Showcase, Features, AI Teaser, Footer).
 * If user is authenticated:
 *   - Renders ONLY their authorized portal (Admin, BTC, Staff, Accountant, Attendee).
 */
async function applyUserSession(user) {
  state.currentUser = user;

  // 1. Hide ALL viewports first
  document.querySelectorAll('.role-viewport').forEach(view => view.classList.add('hidden'));

  const roleLabel = document.getElementById('roleLabel');
  const roleBadge = document.getElementById('currentRoleBadge');
  const topbarUserInfo = document.getElementById('topbarUserInfo');
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const userAvatar = document.getElementById('userAvatar');
  const authActionBtn = document.getElementById('authActionBtn');
  const landingNavLinks = document.getElementById('landingNavLinks');
  const landingAuthActions = document.getElementById('landingAuthActions');

  if (user && ROLE_PORTALS[user.vaiTro]) {
    // Authenticated user: open ONLY their authorized portal
    const portalConfig = ROLE_PORTALS[user.vaiTro];
    const targetPortal = document.getElementById(portalConfig.portalId);
    if (targetPortal) {
      targetPortal.classList.remove('hidden');

      // Ensure the first nav item and screen are active if none selected
      const activeScreen = targetPortal.querySelector('.role-screen.active');
      if (!activeScreen) {
        const firstNav = targetPortal.querySelector('.sidebar-nav .nav-btn');
        const firstScreen = targetPortal.querySelector('.role-screen');
        if (firstNav) {
          targetPortal.querySelectorAll('.sidebar-nav .nav-btn').forEach(b => b.classList.remove('active'));
          firstNav.classList.add('active');
        }
        if (firstScreen) {
          targetPortal.querySelectorAll('.role-screen').forEach(s => s.classList.remove('active'));
          firstScreen.classList.add('active');
        }
      }
    }

    // Hide Landing navigation & actions
    if (landingNavLinks) landingNavLinks.classList.add('hidden');
    if (landingAuthActions) landingAuthActions.classList.add('hidden');

    // Show User Profile & Role Badge in Topbar
    if (roleBadge) {
      roleBadge.classList.remove('hidden');
      roleBadge.className = `role-badge ${portalConfig.badgeClass}`;
      if (roleLabel) roleLabel.textContent = portalConfig.label;
    }
    if (topbarUserInfo) {
      topbarUserInfo.classList.remove('hidden');
      if (userName) userName.textContent = user.hoTen || user.tenDangNhap;
      if (userRole) userRole.textContent = portalConfig.label;
      if (userAvatar) userAvatar.textContent = (user.hoTen || user.tenDangNhap || 'U').charAt(0).toUpperCase();
    }

    if (authActionBtn) {
      authActionBtn.textContent = 'Đăng xuất';
      authActionBtn.className = 'btn btn-outline';
    }

    // Instant scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Load data specific to this role
    await refreshRoleData(user.vaiTro);
  } else {
    // Unauthenticated: Show Public Landing Page
    const landingView = document.getElementById('view-landing');
    if (landingView) landingView.classList.remove('hidden');

    // Show Landing header navigation links & actions
    if (landingNavLinks) landingNavLinks.classList.remove('hidden');
    if (landingAuthActions) landingAuthActions.classList.remove('hidden');

    // Hide Role badge & user info
    if (roleBadge) roleBadge.classList.add('hidden');
    if (topbarUserInfo) topbarUserInfo.classList.add('hidden');

    if (authActionBtn) {
      authActionBtn.textContent = 'Đăng nhập';
      authActionBtn.className = 'btn btn-primary';
    }

    // Load Landing Page events & data
    await loadLandingPage();
  }
}

/**
 * Loads events dynamically for the Public Landing Page showcase grid
 */
async function loadLandingPage() {
  await loadBaseEvents();

  const grid = document.getElementById('landingEventsGrid');
  if (grid) {
    if (!state.events || state.events.length === 0) {
      grid.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 40px; color: var(--text-muted);">Hiện tại chưa có sự kiện nào được công bố.</div>';
    } else {
      grid.innerHTML = state.events.map(ev => {
        const isLive = ev.trangThai === 'DangDienRa';
        const statusLabel = isLive ? 'Đang diễn ra' : (ev.trangThai === 'SapDienRa' ? 'Sắp diễn ra' : 'Đã kết thúc');
        const statusClass = isLive ? 'active' : 'upcoming';
        const banner = ev.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87';
        const cleanTitle = (ev.tenSuKien || '').replace(/'/g, "\\'");

        return `
          <div class="landing-event-card">
            <div class="landing-event-banner" style="background-image: url('${banner}');">
              <span class="landing-event-status ${statusClass}">${statusLabel}</span>
            </div>
            <div class="landing-event-body">
              <span class="landing-event-category">🌐 ${ev.loaiSuKien || 'Hội thảo công nghệ'}</span>
              <h3 class="landing-event-title">${ev.tenSuKien}</h3>
              <div class="landing-event-meta">
                <div>📅 <strong>Thời gian:</strong> ${formatDate(ev.ngayBatDau)}</div>
                <div>📍 <strong>Địa điểm:</strong> ${ev.diaDiem || 'Trung tâm Hội nghị Quốc gia'}</div>
              </div>
              <p class="landing-event-desc">${ev.moTa || 'Sự kiện công nghệ và đổi mới sáng tạo thu hút hàng đầu.'}</p>
              <div class="landing-event-footer">
                <span style="font-weight: 700; color: #34d399; font-size: 0.95rem;">Vé từ 790.000 đ</span>
                <button class="btn btn-primary btn-sm" onclick="openBookTicketModal(${ev.id}, '${cleanTitle}')">
                  🎟️ Đặt vé ngay
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Update KPI counters
  const statEvents = document.getElementById('landingStatEvents');
  if (statEvents) {
    statEvents.textContent = `${state.events.length || 6}+`;
  }
}

async function refreshRoleData(roleKey) {
  await loadBaseEvents();

  switch (roleKey) {
    case 'QuanTriVien':
      await loadAdminDashboard();
      await loadAdminAccounts();
      await loadAdminEvents();
      break;

    case 'BanToChuc':
      await loadBtcEvents();
      await loadBtcSessions();
      await loadBtcSpeakers();
      await loadBtcTickets();
      await loadBtcFeedbacks();
      populateEventSelects(['btcSessionEventSelect', 'btcTicketEventSelect', 'aiNotificationEvent', 'aiSummaryEventSelect']);
      break;

    case 'NhanVienCheckIn':
      await loadStaffCheckinData();
      break;

    case 'KeToan':
      await loadKetoanOverview();
      await loadKetoanTransactions();
      await loadKetoanReports();
      populateEventSelects(['reportModalEventSelect']);
      break;

    case 'NguoiThamDu':
      await loadAttendeeEvents();
      await loadAttendeeTickets();
      await loadAttendeeFeedbacks();
      populateEventSelects(['feedbackEventSelect']);
      break;
  }
}

async function loadBaseEvents() {
  try {
    state.events = await api.get('/api/events');
  } catch (e) {
    console.error('Failed to load events:', e);
  }
}

function populateEventSelects(selectIds = []) {
  selectIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = state.events.map(ev => `<option value="${ev.id}">${ev.tenSuKien} (${ev.maSuKien})</option>`).join('');
  });
}

function setupSidebarNav() {
  document.querySelectorAll('.role-viewport').forEach(viewport => {
    const navButtons = viewport.querySelectorAll('.sidebar-nav .nav-btn');
    const screens = viewport.querySelectorAll('.role-screen');

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        screens.forEach(screen => {
          screen.classList.toggle('active', screen.id === targetId);
        });
      });
    });
  });
}

// ==============================================================
// 1. QUẢN TRỊ VIÊN (ADMIN PORTAL LOGIC)
// ==============================================================
async function loadAdminDashboard() {
  try {
    const summary = await api.get('/api/dashboard/summary', true);
    document.getElementById('adminStatEvents').textContent = summary.totalEvents || state.events.length;
    document.getElementById('adminStatGuests').textContent = summary.totalGuests || 0;
    document.getElementById('adminStatRevenue').textContent = formatCurrency(summary.revenue || 0);
    document.getElementById('adminStatAi').textContent = `${summary.aiScore || 96}%`;
  } catch (err) {
    document.getElementById('adminStatEvents').textContent = state.events.length;
  }

  const feed = document.getElementById('adminUpcomingFeed');
  if (feed) {
    feed.innerHTML = state.events.slice(0, 4).map(ev => `
      <div class="feed-item" style="padding: 10px 0; border-bottom: 1px solid var(--border-glass);">
        <div class="flex-between">
          <strong>${ev.tenSuKien}</strong>
          <span class="badge ${ev.trangThai === 'DangDienRa' ? 'badge-success' : 'badge-info'}">${ev.trangThai}</span>
        </div>
        <small class="text-muted">📍 ${ev.diaDiem} · ⏱️ ${formatDate(ev.ngayBatDau)}</small>
      </div>
    `).join('') || '<p class="text-muted">Chưa có sự kiện nào.</p>';
  }
}

async function loadAdminAccounts() {
  try {
    const accounts = await api.get('/api/accounts', true);
    state.accounts = accounts;
    document.getElementById('adminAccountsCount').textContent = `${accounts.length} tài khoản`;
    document.getElementById('adminAccountTotalBadge').textContent = `${accounts.length} tài khoản`;

    const roleCounts = {
      QuanTriVien: accounts.filter(a => a.vaiTro === 'QuanTriVien').length,
      BanToChuc: accounts.filter(a => a.vaiTro === 'BanToChuc').length,
      NhanVienCheckIn: accounts.filter(a => a.vaiTro === 'NhanVienCheckIn').length,
      KeToan: accounts.filter(a => a.vaiTro === 'KeToan').length,
      NguoiThamDu: accounts.filter(a => a.vaiTro === 'NguoiThamDu').length
    };

    const distContainer = document.getElementById('adminRoleDistribution');
    if (distContainer) {
      distContainer.innerHTML = Object.entries(roleCounts).map(([role, count]) => {
        const label = ROLE_PORTALS[role]?.label || role;
        return `
          <div class="flex-between" style="padding: 8px 0; border-bottom: 1px solid var(--border-glass);">
            <span>${label}</span>
            <strong class="badge badge-accent">${count} người dùng</strong>
          </div>
        `;
      }).join('');
    }

    const tbody = document.getElementById('adminAccountTableBody');
    if (tbody) {
      tbody.innerHTML = accounts.map(acc => `
        <tr>
          <td>
            <strong>${acc.tenDangNhap}</strong><br>
            <small class="text-muted">${acc.email}</small>
          </td>
          <td>${acc.hoTen}</td>
          <td>
            <select class="table-select" data-admin-role="${acc.id}">
              <option value="QuanTriVien" ${acc.vaiTro === 'QuanTriVien' ? 'selected' : ''}>Quản trị viên (Admin)</option>
              <option value="BanToChuc" ${acc.vaiTro === 'BanToChuc' ? 'selected' : ''}>Ban tổ chức (BTC)</option>
              <option value="NhanVienCheckIn" ${acc.vaiTro === 'NhanVienCheckIn' ? 'selected' : ''}>Nhân viên check-in</option>
              <option value="KeToan" ${acc.vaiTro === 'KeToan' ? 'selected' : ''}>Kế toán (Accountant)</option>
              <option value="NguoiThamDu" ${acc.vaiTro === 'NguoiThamDu' ? 'selected' : ''}>Người tham dự (Guest)</option>
            </select>
          </td>
          <td>
            <select class="table-select status" data-admin-status="${acc.id}">
              <option value="HoatDong" ${acc.trangThai === 'HoatDong' ? 'selected' : ''}>🟢 Hoạt động</option>
              <option value="Khoa" ${acc.trangThai === 'Khoa' ? 'selected' : ''}>🔴 Đã khóa</option>
            </select>
          </td>
          <td style="text-align: center;">
            <button class="btn btn-sm btn-outline" data-admin-save="${acc.id}">Lưu</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="text-center">Chưa có tài khoản nào</td></tr>';
    }
  } catch (err) {
    console.warn('Admin accounts fetch error:', err.message);
  }
}

async function loadAdminEvents() {
  const container = document.getElementById('adminEventsList');
  if (!container) return;

  container.innerHTML = state.events.map(ev => `
    <div class="event-manage-card">
      <div class="event-banner-thumb" style="background-image: url('${ev.bannerUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30'}');">
        <span class="badge badge-info event-banner-badge">${ev.trangThai}</span>
      </div>
      <div class="event-card-body">
        <div>
          <h3>${ev.tenSuKien}</h3>
          <p class="event-desc">${ev.moTa || 'Không có mô tả'}</p>
          <div class="event-meta-row"><span>📍</span> <span>${ev.diaDiem}</span></div>
          <div class="event-meta-row"><span>📅</span> <span>${formatDate(ev.ngayBatDau)} - ${formatDate(ev.ngayKetThuc)}</span></div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-outline" onclick="openEditEventModal(${ev.id})">Sửa sự kiện</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEventById(${ev.id})">Xóa</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ==============================================================
// 2. BAN TỔ CHỨC (ORGANIZER PORTAL LOGIC)
// ==============================================================
async function loadBtcEvents() {
  const container = document.getElementById('btcEventsGrid');
  if (!container) return;

  container.innerHTML = state.events.map(ev => `
    <div class="event-manage-card">
      <div class="event-banner-thumb" style="background-image: url('${ev.bannerUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30'}');">
        <span class="badge ${ev.trangThai === 'DangDienRa' ? 'badge-success' : 'badge-info'} event-banner-badge">${ev.trangThai}</span>
      </div>
      <div class="event-card-body">
        <div>
          <span class="badge badge-accent mb-2">${ev.loaiSuKien}</span>
          <h3>${ev.tenSuKien}</h3>
          <p class="event-desc">${ev.moTa || 'Không có mô tả'}</p>
          <div class="event-meta-row"><span>📍 Địa điểm:</span> <strong>${ev.diaDiem}</strong></div>
          <div class="event-meta-row"><span>⏱️ Bắt đầu:</span> <span>${formatDate(ev.ngayBatDau)}</span></div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-primary" onclick="openEditEventModal(${ev.id})">Chỉnh sửa</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEventById(${ev.id})">Xóa</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function loadBtcSessions() {
  try {
    const sessions = await api.get('/api/sessions');
    document.getElementById('btcSessionCount').textContent = `${sessions.length} phiên`;
    const list = document.getElementById('btcSessionList');
    if (list) {
      list.innerHTML = sessions.map(s => `
        <div class="feed-item" style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); margin-bottom: 10px;">
          <div class="flex-between">
            <strong style="color: #60a5fa;">${s.tenPhien}</strong>
            <span class="badge badge-info">${s.maPhien}</span>
          </div>
          <p class="text-muted mt-2" style="font-size: 0.88rem;">${s.moTa || 'Không có mô tả'}</p>
          <div class="flex-between mt-2" style="font-size: 0.82rem; color: var(--text-muted);">
            <span>Phòng: ${s.phong || 'Chính'}</span>
            <span>⏱️ ${formatDate(s.ngayGio)}</span>
          </div>
        </div>
      `).join('') || '<p class="text-muted">Chưa có phiên nội dung nào.</p>';
    }
  } catch (e) {
    console.warn('Sessions error:', e);
  }
}

async function loadBtcSpeakers() {
  try {
    const speakers = await api.get('/api/speakers');
    document.getElementById('btcSpeakerCount').textContent = `${speakers.length} diễn giả`;
    const list = document.getElementById('btcSpeakerList');
    if (list) {
      list.innerHTML = speakers.map(sp => `
        <div class="speaker-card" style="display: flex; gap: 14px; padding: 14px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); margin-bottom: 10px; align-items: center;">
          <img src="${sp.avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2'}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-glass-bright);" />
          <div>
            <strong>${sp.tenDienGia}</strong>
            <span class="badge badge-accent" style="margin-left: 8px;">${sp.chuyenNganh || 'Chuyên gia'}</span>
            <p class="text-muted" style="font-size: 0.82rem; margin-top: 4px;">${sp.gioiThieu || ''}</p>
          </div>
        </div>
      `).join('') || '<p class="text-muted">Chưa có diễn giả nào.</p>';
    }
  } catch (e) {
    console.warn('Speakers error:', e);
  }
}

async function loadBtcTickets() {
  try {
    const tickets = await api.get('/api/tickets');
    document.getElementById('btcTicketCount').textContent = `${tickets.length} hạng vé`;
    const list = document.getElementById('btcTicketList');
    if (list) {
      list.innerHTML = tickets.map(tk => `
        <div class="feed-item" style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); margin-bottom: 10px;">
          <div class="flex-between">
            <strong style="font-size: 1.05rem;">${tk.tenHangVe} (${tk.maHangVe})</strong>
            <span class="badge badge-success">${formatCurrency(tk.gia)}</span>
          </div>
          <div class="flex-between mt-2" style="font-size: 0.85rem; color: var(--text-secondary);">
            <span>Số lượng phát hành: ${tk.soLuong} vé</span>
            <span class="badge ${tk.trangThai === 'ConVe' ? 'badge-info' : 'badge-warning'}">${tk.trangThai}</span>
          </div>
        </div>
      `).join('') || '<p class="text-muted">Chưa có hạng vé nào.</p>';
    }
  } catch (e) {
    console.warn('Tickets error:', e);
  }
}

async function loadBtcFeedbacks() {
  try {
    const feedbacks = await api.get('/api/feedback');
    const container = document.getElementById('btcFeedbacksList');
    if (container) {
      container.innerHTML = feedbacks.map(fb => `
        <div class="feedback-item" style="padding: 14px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); margin-bottom: 12px;">
          <div class="flex-between">
            <div>
              <strong>${fb.hoTen}</strong>
              <small class="text-muted"> · ${fb.tenSuKien}</small>
            </div>
            <span style="color: #fbbf24; font-size: 1.1rem;">${'★'.repeat(fb.danhGia || 5)}</span>
          </div>
          <p class="mt-2" style="font-size: 0.92rem;">${fb.phanHoi || ''}</p>
          <small class="text-muted" style="display: block; margin-top: 6px;">Chủ đề: ${fb.nhomYKien || 'Góp ý'} · ${formatDate(fb.createdAt)}</small>
        </div>
      `).join('') || '<p class="text-muted">Chưa có phản hồi nào.</p>';
    }
  } catch (e) {
    console.warn('Feedbacks error:', e);
  }
}

// ==============================================================
// 3. NHÂN VIÊN CHECK-IN (CHECK-IN STAFF PORTAL LOGIC)
// ==============================================================
async function loadStaffCheckinData(search = '', status = '') {
  try {
    let url = '/api/registrations?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;

    const regs = await api.get(url, true);
    state.registrations = regs;

    const stats = await api.get('/api/checkin/stats', true);
    document.getElementById('staffStatTotal').textContent = stats.total;
    document.getElementById('staffStatChecked').textContent = stats.checkedIn;
    document.getElementById('staffStatNotChecked').textContent = stats.notCheckedIn;
    document.getElementById('staffLiveCheckinCount').textContent = stats.checkedIn;

    document.getElementById('countAll').textContent = stats.total;
    document.getElementById('countChecked').textContent = stats.checkedIn;
    document.getElementById('countUnchecked').textContent = stats.notCheckedIn;

    document.getElementById('staffProgressBar').style.width = `${stats.rate}%`;
    document.getElementById('staffProgressText').textContent = `${stats.rate}% khách đã hoàn tất check-in`;
    document.getElementById('staffRatioText').textContent = `${stats.checkedIn} / ${stats.total}`;

    const tbody = document.getElementById('staffAttendeesTableBody');
    if (tbody) {
      tbody.innerHTML = regs.map(r => {
        const isChecked = r.trangThai === 'DaCheckIn';
        return `
          <tr>
            <td>
              <strong>${r.hoTen}</strong>
            </td>
            <td>
              <small>${r.email}</small><br>
              <small class="text-muted">${r.soDienThoai || '-'}</small>
            </td>
            <td>${r.tenSuKien}</td>
            <td><span class="badge badge-info">${r.tenHangVe}</span></td>
            <td><code>${r.maDangKy}</code></td>
            <td>
              <span class="badge ${isChecked ? 'badge-success' : 'badge-warning'}">
                ${isChecked ? 'Đã Check-in' : 'Chưa Check-in'}
              </span>
              ${isChecked && r.thoiGianCheckIn ? `<br><small class="text-muted">${formatDate(r.thoiGianCheckIn)}</small>` : ''}
            </td>
            <td>
              ${isChecked ? `
                <button class="btn btn-sm btn-outline" onclick="undoCheckin(${r.id})">Hoàn tác</button>
              ` : `
                <button class="btn btn-sm btn-primary" onclick="quickCheckin('${r.qrCode || r.maDangKy}')">Check-in</button>
              `}
            </td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="7" class="text-center text-muted">Không tìm thấy người tham dự nào</td></tr>';
    }
  } catch (e) {
    console.warn('Staff checkin load error:', e);
  }
}

async function processCheckinCode(code) {
  const resultCard = document.getElementById('checkinResultCard');
  const resultBadge = document.getElementById('checkinStatusBadge');
  const detailsBox = document.getElementById('resultDetails');

  try {
    const res = await api.post('/api/checkin', { maVe: code }, true);

    playTone(880, 0.15);

    resultCard.className = 'checkin-result-card success';
    resultBadge.textContent = 'HỢP LỆ';
    resultBadge.className = 'badge badge-success';

    document.getElementById('resultIcon').textContent = '✅';
    document.getElementById('resultTitle').textContent = 'CHECK-IN THÀNH CÔNG!';
    document.getElementById('resultDesc').textContent = res.message;

    detailsBox.classList.remove('hidden');
    document.getElementById('resAttendeeName').textContent = res.ticket.hoTen;
    document.getElementById('resTicketTier').textContent = res.ticket.tenHangVe;
    document.getElementById('resEventName').textContent = res.ticket.tenSuKien;
    document.getElementById('resTicketCode').textContent = res.ticket.maDangKy;
    document.getElementById('resCheckinTime').textContent = formatDate(res.ticket.thoiGianCheckIn);

    await loadStaffCheckinData();
  } catch (err) {
    playTone(330, 0.3);

    const isDuplicate = err.message.includes('đã được check-in') || err.message.includes('đã được sử dụng');
    resultCard.className = isDuplicate ? 'checkin-result-card duplicate' : 'checkin-result-card error';

    resultBadge.textContent = isDuplicate ? 'CẢNH BÁO: ĐÃ DÙNG' : 'KHÔNG HỢP LỆ';
    resultBadge.className = isDuplicate ? 'badge badge-warning' : 'badge badge-danger';

    document.getElementById('resultIcon').textContent = isDuplicate ? '⚠️' : '❌';
    document.getElementById('resultTitle').textContent = isDuplicate ? 'VÉ ĐÃ CHECK-IN TRƯỚC ĐÓ!' : 'LỖI CHECK-IN';
    document.getElementById('resultDesc').textContent = err.message;
    detailsBox.classList.add('hidden');
  }
}

function quickCheckin(code) {
  processCheckinCode(code);
}

async function undoCheckin(ticketId) {
  if (!confirm('Bạn có chắc muốn hoàn tác trạng thái check-in cho vé này?')) return;
  try {
    await api.post('/api/checkin/undo', { ticketId }, true);
    alert('Đã hoàn tác check-in');
    await loadStaffCheckinData();
  } catch (e) {
    alert(e.message || 'Lỗi hoàn tác');
  }
}

function playTone(freq, duration) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function initCameraScanner() {
  const btnToggle = document.getElementById('btnToggleCamera');
  const btnStop = document.getElementById('btnStopCamera');
  const placeholder = document.getElementById('qrReaderPlaceholder');

  btnToggle?.addEventListener('click', async () => {
    if (typeof Html5Qrcode === 'undefined') {
      alert('Thư viện quét camera đang tải, vui lòng thử lại sau 2 giây.');
      return;
    }

    try {
      placeholder.style.display = 'none';
      btnToggle.style.display = 'none';
      btnStop.style.display = 'inline-flex';

      state.html5QrScanner = new Html5Qrcode("qr-reader");
      await state.html5QrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          processCheckinCode(decodedText);
        },
        (errorMessage) => {}
      );
      state.isScanning = true;
    } catch (err) {
      alert('Không thể mở camera: ' + (err.message || 'Vui lòng cấp quyền camera'));
      placeholder.style.display = 'flex';
      btnToggle.style.display = 'inline-flex';
      btnStop.style.display = 'none';
    }
  });

  btnStop?.addEventListener('click', async () => {
    if (state.html5QrScanner && state.isScanning) {
      await state.html5QrScanner.stop();
      state.html5QrScanner = null;
      state.isScanning = false;
    }
    placeholder.style.display = 'flex';
    btnToggle.style.display = 'inline-flex';
    btnStop.style.display = 'none';
  });
}

// ==============================================================
// 4. KẾ TOÁN (ACCOUNTANT PORTAL LOGIC)
// ==============================================================
async function loadKetoanOverview() {
  try {
    const fin = await api.get('/api/financial/overview', true);
    document.getElementById('ketoanTotalRevenue').textContent = formatCurrency(fin.totalRevenue || 0);
    document.getElementById('ketoanTotalTickets').textContent = fin.totalTickets || 0;
    const avg = fin.totalTickets ? Math.round(fin.totalRevenue / fin.totalTickets) : 0;
    document.getElementById('ketoanAvgPrice').textContent = formatCurrency(avg);

    const eventList = document.getElementById('ketoanByEventList');
    if (eventList) {
      eventList.innerHTML = (fin.byEvent || []).map(item => `
        <div class="flex-between" style="padding: 12px 0; border-bottom: 1px solid var(--border-glass);">
          <div>
            <strong>${item.tenSuKien}</strong><br>
            <small class="text-muted">${item.ticketCount || 0} vé đã phát hành</small>
          </div>
          <strong class="text-accent" style="color: #34d399; font-size: 1.1rem;">
            ${formatCurrency(item.eventRevenue || 0)}
          </strong>
        </div>
      `).join('') || '<p class="text-muted">Chưa có số liệu.</p>';
    }

    const tierList = document.getElementById('ketoanByTierList');
    if (tierList) {
      tierList.innerHTML = (fin.byTier || []).map(tier => `
        <div class="flex-between" style="padding: 12px 0; border-bottom: 1px solid var(--border-glass);">
          <div>
            <span class="badge badge-accent">${tier.tenHangVe}</span>
            <small class="text-muted" style="margin-left: 8px;">(${tier.count} vé)</small>
          </div>
          <strong>${formatCurrency(tier.subtotal || 0)}</strong>
        </div>
      `).join('') || '<p class="text-muted">Chưa có số liệu.</p>';
    }
  } catch (e) {
    console.warn('Ketoan overview error:', e);
  }
}

async function loadKetoanTransactions() {
  try {
    const txs = await api.get('/api/registrations', true);
    const tbody = document.getElementById('ketoanTransactionsTableBody');
    if (tbody) {
      tbody.innerHTML = txs.map(t => `
        <tr>
          <td><strong>${t.maDangKy}</strong></td>
          <td><small>${formatDate(t.createdAt)}</small></td>
          <td>
            <strong>${t.hoTen}</strong><br>
            <small class="text-muted">${t.email}</small>
          </td>
          <td>${t.tenSuKien}</td>
          <td><span class="badge badge-info">${t.tenHangVe}</span></td>
          <td><strong style="color: #34d399;">${formatCurrency(t.tongTien)}</strong></td>
          <td><span class="badge badge-success">Đã thanh toán</span></td>
        </tr>
      `).join('') || '<tr><td colspan="7" class="text-center text-muted">Chưa có giao dịch nào</td></tr>';
    }
  } catch (e) {
    console.warn('Transactions error:', e);
  }
}

async function loadKetoanReports() {
  try {
    const reports = await api.get('/api/reports', true);
    const tbody = document.getElementById('ketoanReportsTableBody');
    if (tbody) {
      tbody.innerHTML = reports.map(r => `
        <tr>
          <td><strong>${r.maBaoCao}</strong></td>
          <td>${r.tenSuKien || ('Sự kiện #' + r.suKienId)}</td>
          <td><strong style="color: #34d399;">${formatCurrency(r.tongDoanhThu)}</strong></td>
          <td><strong>${r.soVeBan} vé</strong></td>
          <td><small class="text-muted">${r.ghiChu || '-'}</small></td>
          <td><small>${formatDate(r.createdAt)}</small></td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="text-center text-muted">Chưa có báo cáo nào</td></tr>';
    }
  } catch (e) {
    console.warn('Reports error:', e);
  }
}

function exportTableToCsv(filename = 'danh-sach-giao-dich.csv') {
  const table = document.getElementById('transactionTable');
  if (!table) return;
  let csv = [];
  const rows = table.querySelectorAll('tr');
  for (let i = 0; i < rows.length; i++) {
    const row = [], cols = rows[i].querySelectorAll('td, th');
    for (let j = 0; j < cols.length; j++) {
      let text = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""');
      row.push(`"${text}"`);
    }
    csv.push(row.join(','));
  }
  const csvBlob = new Blob(['\ufeff' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(csvBlob);
  link.download = filename;
  link.click();
}

// ==============================================================
// 5. NGƯỜI THAM DỰ (ATTENDEE / PUBLIC PORTAL LOGIC)
// ==============================================================
async function loadAttendeeEvents() {
  const container = document.getElementById('attendeeEventsList');
  if (!container) return;

  container.innerHTML = state.events.map(ev => `
    <div class="stream-card">
      <div class="stream-banner" style="background-image: url('${ev.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87'}');">
        <span class="badge badge-accent" style="position: absolute; top: 12px; left: 12px;">${ev.loaiSuKien}</span>
        <span class="badge ${ev.trangThai === 'DangDienRa' ? 'badge-success' : 'badge-info'}" style="position: absolute; top: 12px; right: 12px;">${ev.trangThai}</span>
      </div>
      <div class="stream-content">
        <div>
          <h3 style="font-size: 1.35rem; font-weight: 700; margin-bottom: 8px;">${ev.tenSuKien}</h3>
          <p class="event-desc">${ev.moTa || 'Sự kiện hàng đầu về công nghệ và khởi nghiệp.'}</p>
          <div class="event-meta-row"><span>📍</span> <strong>${ev.diaDiem}</strong></div>
          <div class="event-meta-row"><span>📅</span> <span>${formatDate(ev.ngayBatDau)}</span></div>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn btn-primary btn-block" onclick="openBookTicketModal(${ev.id}, '${ev.tenSuKien.replace(/'/g, "\\'")}')">
            🎟️ Đặt vé tham dự ngay
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

async function loadAttendeeTickets(email = null) {
  const container = document.getElementById('attendeeTicketsGallery');
  if (!container) return;

  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  const targetEmail = email || (user ? user.email : 'long@gmail.com');

  try {
    const myTickets = await api.get(`/api/my-tickets?email=${encodeURIComponent(targetEmail)}`);
    container.innerHTML = myTickets.map(tk => {
      const isChecked = tk.trangThai === 'DaCheckIn';
      return `
        <div class="ticket-pass">
          <div class="ticket-header">
            <div>
              <span class="badge badge-accent">${tk.tenHangVe} PASS</span>
              <h3 style="font-size: 1.15rem; margin-top: 4px;">${tk.tenSuKien}</h3>
            </div>
            <span class="ticket-status-badge ${isChecked ? 'checked' : 'valid'}">
              ${isChecked ? 'ĐÃ CHECK-IN' : 'VÉ HỢP LỆ'}
            </span>
          </div>
          <div class="ticket-body">
            <small class="text-muted">MÃ VÉ CỦA BẠN: <strong>${tk.maDangKy}</strong></small>
            <div class="qr-display">
              <img src="${buildQrUrl(tk.qrCode || tk.maDangKy)}" alt="QR Code" />
            </div>
            <small class="text-muted">Xuất trình mã này tại cổng tiếp đón</small>
            <div style="margin-top: 14px; font-size: 0.88rem; color: var(--text-secondary);">
              📍 ${tk.diaDiem}<br>
              ⏱️ ${formatDate(tk.ngayBatDau)}
            </div>
          </div>
        </div>
      `;
    }).join('') || `
      <div class="glass-panel text-center" style="grid-column: 1 / -1; padding: 40px;">
        <h3>Chưa có vé nào cho email "${targetEmail}"</h3>
        <p class="text-muted mt-2">Hãy khám phá sự kiện và đăng ký mua vé để nhận mã QR Pass ngay.</p>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<p class="text-muted">Vui lòng nhập email để tra cứu vé.</p>`;
  }
}

async function loadAttendeeFeedbacks() {
  try {
    const feedbacks = await api.get('/api/feedback');
    const container = document.getElementById('attendeePublicFeedbacks');
    if (container) {
      container.innerHTML = feedbacks.slice(0, 4).map(fb => `
        <div style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); margin-bottom: 10px;">
          <div class="flex-between">
            <strong>${fb.hoTen}</strong>
            <span style="color: #fbbf24;">${'★'.repeat(fb.danhGia || 5)}</span>
          </div>
          <p class="mt-2 text-muted" style="font-size: 0.88rem;">${fb.phanHoi || ''}</p>
        </div>
      `).join('') || '<p class="text-muted">Chưa có đánh giá nào.</p>';
    }
  } catch (e) {}
}

function openBookTicketModal(eventId, eventName) {
  document.getElementById('bookModalEventId').value = eventId;
  document.getElementById('bookModalEventTitle').textContent = `Đăng ký vé: ${eventName}`;
  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  if (user) {
    document.getElementById('bookModalFullName').value = user.hoTen || '';
    document.getElementById('bookModalEmail').value = user.email || '';
  }
  openModal('bookTicketModal');
}

function openEditEventModal(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  const form = document.getElementById('eventForm');
  form.eventId.value = ev.id;
  form.maSuKien.value = ev.maSuKien;
  form.tenSuKien.value = ev.tenSuKien;
  form.moTa.value = ev.moTa || '';
  form.loaiSuKien.value = ev.loaiSuKien;
  form.diaDiem.value = ev.diaDiem;
  form.ngayBatDau.value = (ev.ngayBatDau || '').slice(0, 16);
  form.ngayKetThuc.value = (ev.ngayKetThuc || '').slice(0, 16);
  form.trangThai.value = ev.trangThai;
  form.bannerUrl.value = ev.bannerUrl || '';

  document.getElementById('eventModalTitle').textContent = 'Chỉnh sửa sự kiện';
  document.getElementById('eventSubmitBtn').textContent = 'Cập nhật sự kiện';
  openModal('eventModal');
}

async function deleteEventById(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa sự kiện này? Hành động này không thể hoàn tác!')) return;
  try {
    await api.delete(`/api/events/${id}`);
    alert('Đã xóa sự kiện');
    await loadBaseEvents();
    if (state.currentUser?.vaiTro === 'QuanTriVien') await loadAdminEvents();
    if (state.currentUser?.vaiTro === 'BanToChuc') await loadBtcEvents();
  } catch (e) {
    alert(e.message || 'Lỗi khi xóa sự kiện');
  }
}

// ==============================================================
// FORM SUBMISSIONS & EVENT LISTENERS
// ==============================================================
function setupEventListeners() {
  // Modal Closes
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Landing Page Hero & Header Action Buttons
  document.getElementById('btnLandingLoginHero')?.addEventListener('click', () => openModal('authModal'));
  document.getElementById('btnLandingRegister')?.addEventListener('click', () => openModal('registerModal'));

  // Topbar Logo Click: smooth scroll to top when on landing page
  document.getElementById('brandLogo')?.addEventListener('click', (e) => {
    if (!state.currentUser) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Footer Quick Role Login Links
  document.querySelectorAll('.btn-footer-login').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetUser = btn.dataset.loginUser;
      const loginForm = document.getElementById('loginForm');
      if (loginForm && targetUser) {
        loginForm.tenDangNhap.value = targetUser;
        loginForm.matKhau.value = '123456';
      }
      openModal('authModal');
    });
  });

  // Modal Demo Account Quick-Fill Chips
  document.querySelectorAll('.demo-chip-sm').forEach(chip => {
    chip.addEventListener('click', () => {
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        loginForm.tenDangNhap.value = chip.dataset.fillUser || '';
        loginForm.matKhau.value = chip.dataset.fillPass || '123456';
        loginForm.matKhau.focus();
      }
    });
  });

  // Topbar Auth Action (Login / Logout)
  document.getElementById('authActionBtn')?.addEventListener('click', () => {
    if (state.currentUser) {
      if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?')) {
        localStorage.removeItem('event_token');
        localStorage.removeItem('event_user');
        applyUserSession(null);
      }
    } else {
      openModal('authModal');
    }
  });

  // Helper to format AI message
  function formatAiMessage(text) {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  // Landing Page AI Assistant Chatbot
  document.getElementById('landingChatForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('landingChatInput');
    const q = input.value.trim();
    if (!q) return;

    const scrollBox = document.getElementById('landingChatMessages');
    const userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.textContent = q;
    scrollBox.appendChild(userDiv);
    input.value = '';

    const loadingId = 'loading_landing_' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'msg bot msg-thinking';
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Trợ lý AI đang suy nghĩ...';
    scrollBox.appendChild(loadingDiv);
    scrollBox.scrollTop = scrollBox.scrollHeight;

    try {
      const res = await api.post('/api/ai/chatbot', { question: q, eventId: 1 });
      document.getElementById(loadingId)?.remove();
      const botDiv = document.createElement('div');
      botDiv.className = 'msg bot';
      botDiv.innerHTML = formatAiMessage(res.answer || 'Tôi có thể hỗ trợ gì thêm cho bạn về sự kiện?');
      scrollBox.appendChild(botDiv);
    } catch (err) {
      document.getElementById(loadingId)?.remove();
      const errDiv = document.createElement('div');
      errDiv.className = 'msg bot';
      errDiv.textContent = 'Hệ thống trợ lý AI đang bận xử lý, vui lòng thử lại sau giây lát.';
      scrollBox.appendChild(errDiv);
    }
    scrollBox.scrollTop = scrollBox.scrollHeight;
  });

  // Landing AI Sample Questions Click
  document.querySelectorAll('.btn-sample-ask').forEach(btn => {
    btn.addEventListener('click', () => {
      const ask = btn.dataset.ask;
      const input = document.getElementById('landingChatInput');
      if (input && ask) {
        input.value = ask;
        document.getElementById('landingChatForm')?.dispatchEvent(new Event('submit'));
      }
    });
  });



  // Switch between Login and Register Modals
  document.getElementById('btnShowRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('authModal');
    openModal('registerModal');
  });

  document.getElementById('btnBackToLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('registerModal');
    openModal('authModal');
  });

  // Fallback Login Form (Modal)
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const tenDangNhap = form.get('tenDangNhap');
    const matKhau = form.get('matKhau');

    try {
      const res = await api.post('/api/auth/login', { tenDangNhap, matKhau });
      localStorage.setItem('event_token', res.token);
      localStorage.setItem('event_user', JSON.stringify(res.user));

      closeModal('authModal');
      formEl?.reset();

      // Enforce Portal of the authenticated user role immediately without reload/reset
      await applyUserSession(res.user);
    } catch (err) {
      alert(err.message || 'Đăng nhập thất bại! Vui lòng kiểm tra lại tài khoản và mật khẩu.');
    }
  });

  // Register Form
  document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.post('/api/auth/register', {
        hoTen: form.get('hoTen'),
        tenDangNhap: form.get('tenDangNhap'),
        email: form.get('email'),
        matKhau: form.get('matKhau'),
        vaiTro: 'NguoiThamDu'
      });
      alert('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
      closeModal('registerModal');
      openModal('authModal');
      formEl?.reset();
    } catch (err) {
      alert(err.message || 'Đăng ký thất bại');
    }
  });

  // Admin New Account Form
  document.getElementById('adminNewAccountForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.post('/api/accounts', {
        tenDangNhap: form.get('tenDangNhap'),
        email: form.get('email'),
        matKhau: form.get('matKhau'),
        hoTen: form.get('hoTen'),
        vaiTro: form.get('vaiTro')
      }, true);
      alert('Tạo tài khoản thành công');
      formEl?.reset();
      await loadAdminAccounts();
    } catch (err) {
      alert(err.message || 'Tạo tài khoản thất bại');
    }
  });

  // Admin Save Role & Status
  document.getElementById('adminAccountTableBody')?.addEventListener('click', async (e) => {
    const saveBtn = e.target.closest('[data-admin-save]');
    if (!saveBtn) return;
    const id = saveBtn.dataset.adminSave;
    const roleSelect = document.querySelector(`[data-admin-role="${id}"]`);
    const statusSelect = document.querySelector(`[data-admin-status="${id}"]`);

    try {
      await api.put(`/api/accounts/${id}/role`, {
        vaiTro: roleSelect.value,
        trangThai: statusSelect.value
      }, true);
      alert('Cập nhật quyền và trạng thái tài khoản thành công');
      await loadAdminAccounts();
    } catch (err) {
      alert(err.message || 'Cập nhật thất bại');
    }
  });

  document.getElementById('btnAdminQuickAccount')?.addEventListener('click', () => {
    document.querySelector('[data-target="admin-accounts"]')?.click();
  });

  document.getElementById('btnAdminRefreshEvents')?.addEventListener('click', async () => {
    await loadBaseEvents();
    await loadAdminDashboard();
  });

  // BTC / Admin Event Form Submit
  document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const eventId = form.get('eventId');
    const payload = {
      maSuKien: form.get('maSuKien'),
      tenSuKien: form.get('tenSuKien'),
      moTa: form.get('moTa'),
      loaiSuKien: form.get('loaiSuKien'),
      diaDiem: form.get('diaDiem'),
      ngayBatDau: form.get('ngayBatDau'),
      ngayKetThuc: form.get('ngayKetThuc'),
      trangThai: form.get('trangThai'),
      bannerUrl: form.get('bannerUrl')
    };

    try {
      if (eventId) {
        await api.put(`/api/events/${eventId}`, payload, true);
        alert('Cập nhật sự kiện thành công');
      } else {
        await api.post('/api/events', payload, true);
        alert('Tạo sự kiện mới thành công');
      }
      closeModal('eventModal');
      formEl?.reset();
      await loadBaseEvents();
      if (state.currentUser?.vaiTro === 'QuanTriVien') await loadAdminEvents();
      if (state.currentUser?.vaiTro === 'BanToChuc') await loadBtcEvents();
    } catch (err) {
      alert(err.message || 'Lưu sự kiện thất bại');
    }
  });

  document.getElementById('btnBtcCreateEvent')?.addEventListener('click', () => {
    const form = document.getElementById('eventForm');
    form.reset();
    form.eventId.value = '';
    document.getElementById('eventModalTitle').textContent = 'Tạo sự kiện mới';
    document.getElementById('eventSubmitBtn').textContent = 'Lưu sự kiện';
    openModal('eventModal');
  });

  // BTC Session Form
  document.getElementById('btcSessionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.post('/api/sessions', {
        suKienId: Number(form.get('suKienId')),
        maPhien: form.get('maPhien'),
        tenPhien: form.get('tenPhien'),
        ngayGio: form.get('ngayGio'),
        phong: form.get('phong'),
        moTa: form.get('moTa')
      }, true);
      alert('Thêm phiên hội thảo thành công');
      formEl?.reset();
      await loadBtcSessions();
    } catch (err) {
      alert(err.message || 'Lỗi thêm phiên');
    }
  });

  // BTC Speaker Form
  document.getElementById('btcSpeakerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.post('/api/speakers', {
        maDienGia: form.get('maDienGia'),
        tenDienGia: form.get('tenDienGia'),
        chuyenNganh: form.get('chuyenNganh'),
        avatarUrl: form.get('avatarUrl'),
        gioiThieu: form.get('gioiThieu')
      }, true);
      alert('Thêm diễn giả thành công');
      formEl?.reset();
      await loadBtcSpeakers();
    } catch (err) {
      alert(err.message || 'Lỗi thêm diễn giả');
    }
  });

  // BTC Ticket Form
  document.getElementById('btcTicketForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.post('/api/tickets', {
        suKienId: Number(form.get('suKienId')),
        maHangVe: form.get('maHangVe'),
        tenHangVe: form.get('tenHangVe'),
        gia: Number(form.get('gia')),
        soLuong: Number(form.get('soLuong')),
        moTa: form.get('moTa'),
        trangThai: 'ConVe'
      }, true);
      alert('Tạo hạng vé thành công');
      formEl?.reset();
      await loadBtcTickets();
    } catch (err) {
      alert(err.message || 'Lỗi tạo hạng vé');
    }
  });

  // BTC AI Generate Notification
  document.getElementById('btnAiGenerateNotification')?.addEventListener('click', async () => {
    const type = document.getElementById('aiNotificationType').value;
    const eventId = document.getElementById('aiNotificationEvent').value;
    const message = document.getElementById('aiNotificationPrompt').value;
    const outBox = document.getElementById('aiNotificationResult');

    outBox.textContent = 'AI đang khởi tạo nội dung...';
    try {
      const res = await api.post('/api/ai/generate-notification', { type, message, eventId }, true);
      outBox.textContent = res.content || JSON.stringify(res, null, 2);
    } catch (e) {
      outBox.textContent = 'Lỗi tạo thông báo: ' + e.message;
    }
  });

  // BTC AI Summarize Feedback
  document.getElementById('btnAiSummarizeFeedback')?.addEventListener('click', async () => {
    const eventId = document.getElementById('aiSummaryEventSelect').value;
    const ev = state.events.find(e => e.id === Number(eventId));
    const outBox = document.getElementById('aiSummaryOutput');

    outBox.innerHTML = '<p class="text-muted">AI đang phân tích cảm xúc và tổng hợp phản hồi...</p>';
    try {
      const res = await api.post('/api/ai/summarize-feedback', { maSuKien: ev ? ev.maSuKien : 'EVT-2025-001' }, true);
      outBox.innerHTML = `
        <div style="line-height: 1.6;">
          <h4 style="margin-bottom: 8px;">Tổng quan: ${res.tongPhanHoi} phản hồi được phân tích</h4>
          ${(res.summary || []).map(item => `
            <div style="margin-bottom: 10px;">
              <div class="flex-between">
                <span>${item.nhom}</span>
                <strong style="color: #34d399;">${item.phanTram}% tích cực</strong>
              </div>
              <div class="progress-bar-container mt-2" style="height: 6px;">
                <div class="progress-bar-fill" style="width: ${item.phanTram}%;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      outBox.textContent = 'Lỗi phân tích: ' + e.message;
    }
  });

  // Staff Manual Check-in Form
  document.getElementById('staffManualCheckinForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('staffCodeInput').value.trim();
    if (code) {
      processCheckinCode(code);
      document.getElementById('staffCodeInput').value = '';
    }
  });

  // Staff Quick Chip Click
  document.querySelectorAll('.sample-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      processCheckinCode(btn.dataset.code);
    });
  });

  // Staff Search & Filter
  document.getElementById('staffSearchInput')?.addEventListener('input', (e) => {
    loadStaffCheckinData(e.target.value);
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter === 'all' ? '' : tab.dataset.filter;
      loadStaffCheckinData('', filter);
    });
  });

  // Accountant Report Modal
  document.getElementById('btnKetoanNewReport')?.addEventListener('click', () => openModal('reportModal'));
  document.getElementById('btnOpenReportModal')?.addEventListener('click', () => openModal('reportModal'));

  document.getElementById('createReportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.post('/api/reports', {
        suKienId: Number(form.get('suKienId')),
        tongDoanhThu: Number(form.get('tongDoanhThu')),
        soVeBan: Number(form.get('soVeBan')),
        ghiChu: form.get('ghiChu')
      }, true);
      alert('Lập báo cáo doanh thu thành công');
      closeModal('reportModal');
      formEl?.reset();
      await loadKetoanReports();
      await loadKetoanOverview();
    } catch (err) {
      alert(err.message || 'Lỗi lập báo cáo');
    }
  });

  document.getElementById('btnExportCsv')?.addEventListener('click', () => exportTableToCsv());
  document.getElementById('btnKetoanPrint')?.addEventListener('click', () => window.print());

  // Attendee Book Ticket Form
  document.getElementById('bookTicketForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const email = form.get('email');
    try {
      const res = await api.post('/api/registrations', {
        eventId: Number(form.get('eventId')),
        fullName: form.get('fullName'),
        email,
        phone: form.get('phone'),
        ticketType: form.get('ticketType')
      });
      alert(`Đăng ký thành công! Mã QR của bạn: ${res.qrCode || 'Đã sinh vé'}`);
      closeModal('bookTicketModal');
      formEl?.reset();

      document.querySelector('[data-target="attendee-tickets"]')?.click();
      await loadAttendeeTickets(email);
    } catch (err) {
      alert(err.message || 'Đặt vé thất bại');
    }
  });

  // Attendee Ticket Lookup
  document.getElementById('btnLookupMyTickets')?.addEventListener('click', () => {
    const email = document.getElementById('attendeeEmailFilter').value.trim();
    if (email) loadAttendeeTickets(email);
  });

  // Attendee Feedback Form
  document.getElementById('attendeeFeedbackForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      await api.post('/api/feedback', {
        suKienId: Number(form.get('suKienId')),
        email: form.get('email'),
        danhGia: Number(form.get('danhGia')),
        nhomYKien: form.get('nhomYKien'),
        phanHoi: form.get('phanHoi')
      });
      alert('Cảm ơn bạn đã đóng góp phản hồi!');
      formEl?.reset();
      await loadAttendeeFeedbacks();
    } catch (err) {
      alert(err.message || 'Gửi phản hồi thất bại');
    }
  });

  // Chatbot (Fullpage)
  document.getElementById('fullpageChatForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('fullpageChatInput');
    const q = input.value.trim();
    if (!q) return;

    const scrollBox = document.getElementById('fullpageChatMessages');
    const userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.textContent = q;
    scrollBox.appendChild(userDiv);
    input.value = '';

    const loadingId = 'loading_fp_' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'msg bot msg-thinking';
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Trợ lý AI đang xử lý câu trả lời...';
    scrollBox.appendChild(loadingDiv);
    scrollBox.scrollTop = scrollBox.scrollHeight;

    try {
      const res = await api.post('/api/ai/chatbot', { question: q, eventId: 1 });
      document.getElementById(loadingId)?.remove();
      const botDiv = document.createElement('div');
      botDiv.className = 'msg bot';
      botDiv.innerHTML = formatAiMessage(res.answer || 'Tôi có thể hỗ trợ gì thêm cho bạn?');
      scrollBox.appendChild(botDiv);
    } catch (err) {
      document.getElementById(loadingId)?.remove();
      const errDiv = document.createElement('div');
      errDiv.className = 'msg bot';
      errDiv.textContent = 'Xin lỗi, hiện tại trợ lý AI chưa phản hồi được. Vui lòng thử lại sau.';
      scrollBox.appendChild(errDiv);
    }
    scrollBox.scrollTop = scrollBox.scrollHeight;
  });

  // Floating Chatbot Widget
  const chatWidget = document.getElementById('chatWidget');
  document.getElementById('chatMinimizeBtn')?.addEventListener('click', () => {
    chatWidget.classList.toggle('minimized');
  });

  document.getElementById('btnAttendeeAiAsk')?.addEventListener('click', () => {
    document.querySelector('[data-target="attendee-chatbot"]')?.click();
  });

  const sendFloatingWidgetMessage = async () => {
    const input = document.getElementById('chatWidgetInput');
    const q = input.value.trim();
    if (!q) return;

    const messages = document.getElementById('chatMessages');
    const userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.textContent = q;
    messages.appendChild(userDiv);
    input.value = '';

    const loadingId = 'loading_widget_' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'msg bot msg-thinking';
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang soạn phản hồi...';
    messages.appendChild(loadingDiv);
    messages.scrollTop = messages.scrollHeight;

    try {
      const res = await api.post('/api/ai/chatbot', { question: q, eventId: 1 });
      document.getElementById(loadingId)?.remove();
      const botDiv = document.createElement('div');
      botDiv.className = 'msg bot';
      botDiv.innerHTML = formatAiMessage(res.answer || 'Tôi có thể hỗ trợ gì thêm?');
      messages.appendChild(botDiv);
    } catch (e) {
      document.getElementById(loadingId)?.remove();
      const errDiv = document.createElement('div');
      errDiv.className = 'msg bot';
      errDiv.textContent = 'Không thể phản hồi lúc này. Vui lòng thử lại sau.';
      messages.appendChild(errDiv);
    }
    messages.scrollTop = messages.scrollHeight;
  };

  document.getElementById('chatWidgetBtn')?.addEventListener('click', sendFloatingWidgetMessage);
  document.getElementById('chatWidgetInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendFloatingWidgetMessage();
    }
  });
}

// ================= APP INITIALIZATION =================
async function initApp() {
  setupSidebarNav();
  setupEventListeners();
  initCameraScanner();

  // Read stored user session
  const storedUser = JSON.parse(localStorage.getItem('event_user') || 'null');
  const storedToken = localStorage.getItem('event_token');

  if (storedUser && storedToken && ROLE_PORTALS[storedUser.vaiTro]) {
    // Restore session of authenticated role
    await applyUserSession(storedUser);
  } else {
    // Show Public Landing Page
    await applyUserSession(null);
  }
}

document.addEventListener('DOMContentLoaded', initApp);
