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
      const error = new Error(err.message || 'Yêu cầu không thành công');
      error.status = res.status;
      error.data = err;
      throw error;
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
      const error = new Error(data.message || 'Yêu cầu không thành công');
      error.status = res.status;
      error.data = data;
      throw error;
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
      const error = new Error(data.message || 'Yêu cầu không thành công');
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  },

  async patch(path, body = {}, withAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (withAuth) {
      const token = localStorage.getItem('event_token');
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(path, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const error = new Error(data.message || 'Yêu cầu không thành công');
      error.status = res.status;
      error.data = data;
      throw error;
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
      const error = new Error(data.message || 'Yêu cầu xóa không thành công');
      error.status = res.status;
      error.data = data;
      throw error;
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
  if (id === 'authModal') {
    if (!loginCountdownInterval) {
      clearLoginAlert();
    }
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
  if (id === 'authModal' && !loginCountdownInterval) {
    clearLoginAlert();
  }
}

let loginCountdownInterval = null;

function clearLoginAlert() {
  if (loginCountdownInterval) {
    clearInterval(loginCountdownInterval);
    loginCountdownInterval = null;
  }
  const alertBox = document.getElementById('loginAlertBox');
  const submitBtn = document.getElementById('btnLoginSubmit');
  if (alertBox) {
    alertBox.style.display = 'none';
    alertBox.innerHTML = '';
  }
  if (submitBtn) submitBtn.disabled = false;
}

function showLoginAlert(message, type = 'error', remainingSeconds = 0) {
  const alertBox = document.getElementById('loginAlertBox');
  const submitBtn = document.getElementById('btnLoginSubmit');
  if (!alertBox) {
    alert(message);
    return;
  }

  if (loginCountdownInterval) {
    clearInterval(loginCountdownInterval);
    loginCountdownInterval = null;
  }

  alertBox.style.display = 'block';

  if (type === 'lock') {
    alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
    alertBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    alertBox.style.color = '#fca5a5';
    if (submitBtn) submitBtn.disabled = true;

    let sec = remainingSeconds;
    const renderLockMessage = () => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
      alertBox.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
          <span>⛔</span> <span>Tài khoản tạm thời bị khóa</span>
        </div>
        <div>${message}</div>
        <div style="margin-top: 8px; font-weight: 600; color: #f87171; display: flex; align-items: center; gap: 6px;">
          <span>⏳</span> Thử lại sau: <span style="font-family: monospace; font-size: 1.1rem; background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px;">${timeStr}</span>
        </div>
      `;
    };
    renderLockMessage();

    loginCountdownInterval = setInterval(() => {
      sec--;
      if (sec <= 0) {
        clearInterval(loginCountdownInterval);
        loginCountdownInterval = null;
        if (submitBtn) submitBtn.disabled = false;
        alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
        alertBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        alertBox.style.color = '#6ee7b7';
        alertBox.innerHTML = '✅ Thời gian tạm khóa 3 phút đã kết thúc! Bạn có thể thử đăng nhập lại ngay bây giờ.';
      } else {
        renderLockMessage();
      }
    }, 1000);
  } else if (type === 'warning') {
    alertBox.style.background = 'rgba(245, 158, 11, 0.15)';
    alertBox.style.border = '1px solid rgba(245, 158, 11, 0.4)';
    alertBox.style.color = '#fde68a';
    alertBox.innerHTML = `
      <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
        <span>⚠️</span> <span>${message}</span>
      </div>
    `;
    if (submitBtn) submitBtn.disabled = false;
  } else {
    alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
    alertBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    alertBox.style.color = '#fca5a5';
    alertBox.innerHTML = `
      <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
        <span>❌</span> <span>${message}</span>
      </div>
    `;
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ================= AI CHATBOT HISTORY RESET =================
/**
 * Resets message history and input fields across all AI Chatbot interfaces
 * (Landing Page chat teaser, Attendee portal fullpage chat, and Floating Chatbot widget)
 */
function resetAiChatHistory() {
  const landingChat = document.getElementById('landingChatMessages');
  if (landingChat) {
    landingChat.innerHTML = '<div class="msg bot">Xin chào! Bạn quan tâm đến sự kiện nào hoặc cần hỗ trợ gì về lịch trình, vé tham dự?</div>';
  }
  const landingInput = document.getElementById('landingChatInput');
  if (landingInput) landingInput.value = '';

  const fullpageChat = document.getElementById('fullpageChatMessages');
  if (fullpageChat) {
    fullpageChat.innerHTML = '<div class="msg bot">Xin chào bạn! Tôi là Trợ lý AI của AI EventHub. Bạn có thắc mắc gì về thời gian, địa điểm, các phiên workshop hay cách thức đăng ký vé không?</div>';
  }
  const fullpageInput = document.getElementById('fullpageChatInput');
  if (fullpageInput) fullpageInput.value = '';

  const widgetChat = document.getElementById('chatMessages');
  if (widgetChat) {
    widgetChat.innerHTML = '<div class="msg bot">Chào bạn! Tôi có thể hỗ trợ giải đáp về sự kiện, diễn giả, lịch trình và quy định check-in.</div>';
  }
  const widgetInput = document.getElementById('chatWidgetInput');
  if (widgetInput) widgetInput.value = '';
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
  // Clear previous chat history whenever user session changes or logs out
  resetAiChatHistory();

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

// Filter states for Events Exploration
const attendeeEventFilters = {
  keyword: '',
  status: 'all',
  category: 'all',
  sortBy: 'date-asc'
};

const landingEventFilters = {
  keyword: '',
  status: 'all'
};

function populateAttendeeCategoryFilter() {
  const sel = document.getElementById('attendeeCategoryFilter');
  if (!sel) return;
  const curVal = sel.value || 'all';
  const categories = Array.from(new Set((state.events || []).map(e => e.loaiSuKien).filter(Boolean)));
  sel.innerHTML = '<option value="all">Tất cả chủ đề</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
  if (curVal && categories.includes(curVal)) {
    sel.value = curVal;
  }
}

function resetAttendeeEventFilters() {
  attendeeEventFilters.keyword = '';
  attendeeEventFilters.status = 'all';
  attendeeEventFilters.category = 'all';
  attendeeEventFilters.sortBy = 'date-asc';

  const input = document.getElementById('attendeeEventSearchInput');
  if (input) input.value = '';

  const clearBtn = document.getElementById('btnAttendeeClearSearch');
  if (clearBtn) clearBtn.classList.add('hidden');

  const catSel = document.getElementById('attendeeCategoryFilter');
  if (catSel) catSel.value = 'all';

  const sortSel = document.getElementById('attendeeSortFilter');
  if (sortSel) sortSel.value = 'date-asc';

  document.querySelectorAll('#attendeeStatusPills .status-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === 'all');
  });

  loadAttendeeEvents();
}
window.resetAttendeeEventFilters = resetAttendeeEventFilters;

/**
 * Loads events dynamically for the Public Landing Page showcase grid
 */
async function loadLandingPage() {
  await loadBaseEvents();

  const grid = document.getElementById('landingEventsGrid');
  if (grid) {
    let list = [...(state.events || [])];
    const kw = (landingEventFilters.keyword || '').trim().toLowerCase();
    if (kw) {
      list = list.filter(ev =>
        (ev.tenSuKien && ev.tenSuKien.toLowerCase().includes(kw)) ||
        (ev.moTa && ev.moTa.toLowerCase().includes(kw)) ||
        (ev.diaDiem && ev.diaDiem.toLowerCase().includes(kw)) ||
        (ev.loaiSuKien && ev.loaiSuKien.toLowerCase().includes(kw)) ||
        (ev.maSuKien && ev.maSuKien.toLowerCase().includes(kw))
      );
    }
    if (landingEventFilters.status && landingEventFilters.status !== 'all') {
      list = list.filter(ev => ev.trangThai === landingEventFilters.status);
    }

    if (!list || list.length === 0) {
      grid.innerHTML = `
        <div class="filter-empty-state" style="grid-column: 1/-1;">
          <div style="font-size: 2.8rem; margin-bottom: 8px;">🔍</div>
          <h3>Không tìm thấy sự kiện nào</h3>
          <p class="text-muted">Không có sự kiện nào khớp với tiêu chí tìm kiếm của bạn.</p>
        </div>
      `;
    } else {
      grid.innerHTML = list.map(ev => {
        const isLive = ev.trangThai === 'DangDienRa';
        const statusLabel = isLive ? 'Đang diễn ra' : (ev.trangThai === 'SapDienRa' ? 'Sắp diễn ra' : 'Đã kết thúc');
        const statusClass = isLive ? 'active' : 'upcoming';
        const banner = ev.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87';
        const cleanTitle = (ev.tenSuKien || '').replace(/'/g, "\\'");
        const isSoldOut = ev.soVeConLai !== undefined && ev.soVeConLai <= 0;
        const remainingBadge = isSoldOut
          ? '<span class="badge" style="background: rgba(239, 68, 68, 0.25); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); padding: 3px 8px; border-radius: 4px; font-weight: 700;">🔴 Hết vé</span>'
          : (ev.soVeConLai !== undefined && ev.soVeConLai <= 10
              ? `<span class="badge" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); padding: 3px 8px; border-radius: 4px; font-weight: 700;">⚡ Sắp hết (Còn ${ev.soVeConLai} vé)</span>`
              : (ev.soVeConLai !== undefined
                  ? `<span class="badge" style="background: rgba(16, 185, 129, 0.25); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.5); padding: 3px 8px; border-radius: 4px; font-weight: 700;">🟢 Còn ${ev.soVeConLai} vé</span>`
                  : ''));
        const priceLabel = ev.giaVeTu ? `Vé từ ${formatCurrency(ev.giaVeTu)}` : 'Vé từ 790.000 đ';

        return `
          <div class="landing-event-card">
            <div class="landing-event-banner" style="background-image: url('${banner}');">
              <span class="landing-event-status ${statusClass}">${statusLabel}</span>
              ${remainingBadge ? `<div style="position: absolute; bottom: 12px; left: 12px;">${remainingBadge}</div>` : ''}
            </div>
            <div class="landing-event-body">
              <span class="landing-event-category">🌐 ${ev.loaiSuKien || 'Hội thảo công nghệ'}</span>
              <h3 class="landing-event-title">${ev.tenSuKien}</h3>
              <div class="landing-event-meta">
                <div>📅 <strong>Thời gian:</strong> ${formatDate(ev.ngayBatDau)}</div>
                <div>📍 <strong>Địa điểm:</strong> ${ev.diaDiem || 'Trung tâm Hội nghị Quốc gia'}</div>
                ${ev.soVeConLai !== undefined ? `
                  <div>🎫 <strong>Tình trạng vé:</strong> ${isSoldOut ? '<span style="color: #f87171; font-weight: 700;">Đã hết vé</span>' : `<span style="color: #34d399; font-weight: 700;">Còn lại ${ev.soVeConLai} / ${ev.tongSoVe} vé</span>`}</div>
                ` : ''}
              </div>
              <p class="landing-event-desc">${ev.moTa || 'Sự kiện công nghệ và đổi mới sáng tạo thu hút hàng đầu.'}</p>
              <div class="landing-event-footer">
                <span style="font-weight: 700; color: #34d399; font-size: 0.95rem;">${priceLabel}</span>
                ${isSoldOut ? `
                  <button class="btn btn-secondary btn-sm" disabled style="opacity: 0.6; cursor: not-allowed;">
                    🔴 Đã hết vé
                  </button>
                ` : `
                  <button class="btn btn-primary btn-sm" onclick="openBookTicketModal(${ev.id}, '${cleanTitle}')">
                    🎟️ Đặt vé ngay
                  </button>
                `}
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

        // Tự động tải mới dữ liệu theo tab người dùng vừa chọn
        if (targetId === 'attendee-tickets') {
          loadAttendeeTickets();
        } else if (targetId === 'attendee-explore') {
          loadAttendeeEvents();
        } else if (targetId === 'attendee-feedback') {
          loadAttendeeFeedbacks();
        } else if (targetId === 'admin-accounts') {
          loadAdminAccounts();
        } else if (targetId === 'admin-events') {
          loadAdminEvents();
        } else if (targetId === 'btc-events') {
          loadBtcEvents();
        } else if (targetId === 'btc-tickets') {
          loadBtcTickets();
        } else if (targetId === 'staff-list') {
          loadStaffCheckinList();
        } else if (targetId === 'ketoan-transactions') {
          loadKetoanTransactions();
        } else if (targetId === 'ketoan-reports') {
          loadKetoanReports();
        }
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

function renderAdminAccountsTable(accounts) {
  const tbody = document.getElementById('adminAccountTableBody');
  if (!tbody) return;

  const ROLE_BADGES = {
    QuanTriVien: '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">👑 Admin</span>',
    BanToChuc: '<span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.3);">🎪 BTC</span>',
    NhanVienCheckIn: '<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">🎫 Check-in</span>',
    KeToan: '<span class="badge" style="background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3);">💰 Kế toán</span>',
    NguoiThamDu: '<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3);">👤 Khách</span>'
  };

  tbody.innerHTML = (accounts || []).map(acc => {
    const isSelf = state.currentUser?.id === acc.id;
    const isPermLocked = acc.trangThai === 'Khoa';
    const isTempLocked = acc.khoaTamDen && new Date(acc.khoaTamDen) > new Date();
    const isLocked = isPermLocked || isTempLocked;
    const roleBadge = ROLE_BADGES[acc.vaiTro] || `<span class="badge badge-info">${acc.vaiTro}</span>`;
    
    let statusBadge;
    if (isPermLocked) {
      statusBadge = '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">🔴 Đã khóa</span>';
    } else if (isTempLocked) {
      const remainingMin = Math.max(1, Math.ceil((new Date(acc.khoaTamDen) - new Date()) / 60000));
      statusBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);" title="Đăng nhập sai quá 5 lần liên tiếp. Tạm khóa trong 3 phút.">⏳ Tạm khóa (${remainingMin}p)</span>`;
    } else {
      statusBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">🟢 Hoạt động</span>';
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
            ${acc.tenDangNhap}
            ${isSelf ? '<span class="badge badge-accent" style="font-size: 0.7rem; padding: 2px 6px;">Bạn</span>' : ''}
          </div>
          <small class="text-muted">${acc.email}</small>
        </td>
        <td>${acc.hoTen}</td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td style="text-align: center; white-space: nowrap;">
          <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: center;">
            <button class="btn btn-sm btn-outline" data-admin-edit="${acc.id}" title="Chỉnh sửa thông tin tài khoản">
              ✏️ Sửa
            </button>
            <button class="btn btn-sm ${isLocked ? 'btn-success' : 'btn-warning'}" 
                    data-admin-lock="${acc.id}" 
                    data-username="${acc.tenDangNhap}"
                    data-name="${acc.hoTen}"
                    data-status="${acc.trangThai}"
                    ${isSelf ? 'disabled style="opacity: 0.4; cursor: not-allowed;" title="Không thể tự khóa tài khoản của chính bạn"' : `title="${isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}"`}>
              ${isLocked ? '🔓 Mở' : '🔒 Khóa'}
            </button>
            <button class="btn btn-sm btn-danger" 
                    data-admin-delete="${acc.id}" 
                    data-username="${acc.tenDangNhap}"
                    data-name="${acc.hoTen}"
                    ${isSelf ? 'disabled style="opacity: 0.4; cursor: not-allowed;" title="Không thể tự xóa tài khoản của chính bạn"' : 'title="Xóa vĩnh viễn tài khoản"'}>
              🗑️ Xóa
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5" class="text-center" style="padding: 20px; color: var(--text-muted);">Không tìm thấy tài khoản nào</td></tr>';
}

async function loadAdminAccounts() {
  try {
    const accounts = await api.get('/api/accounts', true);
    state.accounts = accounts;
    state.cachedAdminAccounts = accounts;

    const countEl = document.getElementById('adminAccountsCount');
    if (countEl) countEl.textContent = `${accounts.length} tài khoản`;
    const totalBadge = document.getElementById('adminAccountTotalBadge');
    if (totalBadge) totalBadge.textContent = `${accounts.length} tài khoản`;

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

    renderAdminAccountsTable(accounts);
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
    state.allSessions = sessions;
    document.getElementById('btcSessionCount').textContent = `${sessions.length} phiên`;
    const list = document.getElementById('btcSessionList');
    if (list) {
      list.innerHTML = sessions.map(s => {
        const speakers = Array.isArray(s.dienGia) ? s.dienGia : [];
        const speakersHtml = speakers.length > 0
          ? speakers.map(sp => `
              <span class="session-speaker-tag" title="${sp.chuyenNganh || ''}">
                <img src="${sp.avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2'}" alt="${sp.tenDienGia}" />
                ${sp.tenDienGia}
              </span>
            `).join('')
          : '<span class="text-muted" style="font-size: 0.8rem; font-style: italic;">Chưa gán diễn giả</span>';

        return `
          <div class="feed-item" style="padding: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-md); margin-bottom: 12px;">
            <div class="flex-between">
              <strong style="color: #60a5fa; font-size: 0.98rem;">${s.tenPhien}</strong>
              <span class="badge badge-info">${s.maPhien}</span>
            </div>
            <p class="text-muted mt-2" style="font-size: 0.86rem; line-height: 1.4;">${s.moTa || 'Không có mô tả'}</p>
            
            <div class="session-speakers-container">
              <strong style="font-size: 0.82rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;">
                🎙️ Diễn giả:
              </strong>
              ${speakersHtml}
            </div>

            <div class="flex-between mt-3" style="font-size: 0.82rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
              <div>
                <span>Phòng: ${s.phong || 'Chính'}</span>
                <span style="margin: 0 6px;">•</span>
                <span>⏱️ ${formatDate(s.ngayGio)} (${s.thoiLuong || 60} phút)</span>
              </div>
              <button class="btn btn-sm btn-outline" onclick="openAssignSpeakerModal(${s.id})" style="padding: 3px 10px; font-size: 0.8rem; border-color: rgba(99, 102, 241, 0.4); color: #a5b4fc;">
                🎙️ Gán diễn giả
              </button>
            </div>
          </div>
        `;
      }).join('') || '<p class="text-muted">Chưa có phiên nội dung nào.</p>';
    }
  } catch (e) {
    console.warn('Sessions error:', e);
  }
}

async function loadBtcSpeakers() {
  try {
    const speakers = await api.get('/api/speakers');
    document.getElementById('btcSpeakerCount').textContent = `${speakers.length} diễn giả`;

    // Populate dropdown in btcSessionForm
    const sessionSpeakerSelect = document.getElementById('btcSessionSpeakerSelect');
    if (sessionSpeakerSelect) {
      sessionSpeakerSelect.innerHTML = '<option value="">-- Chưa gán diễn giả --</option>' +
        speakers.map(sp => `<option value="${sp.id}">${sp.tenDienGia} (${sp.chuyenNganh || sp.maDienGia})</option>`).join('');
    }

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
        const isCancelled = r.trangThai === 'Huy';
        return `
          <tr style="${isCancelled ? 'opacity: 0.6; background: rgba(239,68,68,0.04);' : ''}">
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
              ${isCancelled ? `
                <span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">
                  Đã Hủy Vé
                </span>
              ` : `
                <span class="badge ${isChecked ? 'badge-success' : 'badge-warning'}">
                  ${isChecked ? 'Đã Check-in' : 'Chưa Check-in'}
                </span>
                ${isChecked && r.thoiGianCheckIn ? `<br><small class="text-muted">${formatDate(r.thoiGianCheckIn)}</small>` : ''}
              `}
            </td>
            <td>
              ${isCancelled ? `
                <span class="text-muted" style="font-size: 0.85rem;">Không khả dụng</span>
              ` : (isChecked ? `
                <button class="btn btn-sm btn-outline" onclick="undoCheckin(${r.id})">Hoàn tác</button>
              ` : `
                <button class="btn btn-sm btn-primary" onclick="quickCheckin('${r.qrCode || r.maDangKy}')">Check-in</button>
              `)}
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
  let cleanCode = String(code || '').trim();
  if (!cleanCode) return;

  // Xử lý nếu QR chứa URL hoặc query param
  if (cleanCode.includes('code=')) {
    cleanCode = cleanCode.split('code=')[1].split('&')[0];
  } else if (cleanCode.includes('/')) {
    const parts = cleanCode.split('/');
    const last = parts[parts.length - 1];
    if (last.startsWith('QR-') || last.startsWith('REG-')) {
      cleanCode = last;
    }
  }

  const resultCard = document.getElementById('checkinResultCard');
  const resultBadge = document.getElementById('checkinStatusBadge');
  const detailsBox = document.getElementById('resultDetails');

  try {
    const res = await api.post('/api/checkin', { maVe: cleanCode }, true);

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
  const cameraSelect = document.getElementById('qrCameraSelect');
  let selectedCameraId = null;

  const stopScanner = async () => {
    if (state.html5QrScanner) {
      try {
        if (state.isScanning) {
          await state.html5QrScanner.stop();
        }
        await state.html5QrScanner.clear();
      } catch (e) {
        console.warn('Dừng camera:', e);
      }
      state.html5QrScanner = null;
      state.isScanning = false;
    }
  };

  const formatCameraErrorMessage = (err) => {
    const msg = (err && (err.message || err.name || String(err))) || '';
    if (msg.includes('NotAllowedError') || msg.includes('Permission denied') || msg.includes('PermissionDismissedError') || msg.includes('dismissed')) {
      return '⚠️ Trình duyệt chưa áp dụng quyền Camera hoặc vừa được bật quyền nhưng chưa tải lại trang.\n\n👉 Bạn hãy nhấn nút "Tải lại" (hoặc bấm F5) ở góc trên trình duyệt để kích hoạt quyền Camera nhé!';
    }
    if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
      return 'Không tìm thấy thiết bị webcam/camera nào trên máy tính của bạn. Hãy kiểm tra kết nối hoặc sử dụng nút "📁 Tải ảnh QR / File ảnh" để quét từ ảnh!';
    }
    if (msg.includes('NotReadableError') || msg.includes('TrackStartError')) {
      return 'Camera đang bị ứng dụng khác (Zoom, Zalo, Teams, phần mềm camera khác,...) chiếm dụng. Vui lòng tắt ứng dụng đó và thử lại!';
    }
    if (msg.includes('OverconstrainedError')) {
      return 'Camera không hỗ trợ thông số yêu cầu. Vui lòng kiểm tra lại thiết bị hoặc đổi camera!';
    }
    return msg ? `Không thể mở camera: ${msg}` : 'Không thể khởi động camera. Vui lòng kiểm tra quyền và tải lại trang (F5).';
  };

  // Cấu hình vùng nhận diện và xử lý quét
  const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const qrboxSize = Math.max(Math.floor(minEdge * 0.85), 260);
    return {
      width: qrboxSize,
      height: qrboxSize
    };
  };

  let lastScannedText = '';
  let lastScanTime = 0;

  const onScanSuccess = (decodedText) => {
    const clean = String(decodedText || '').trim();
    const now = Date.now();
    // Chống lặp trong 2.5s cho cùng 1 mã
    if (clean === lastScannedText && now - lastScanTime < 2500) {
      return;
    }
    lastScannedText = clean;
    lastScanTime = now;
    processCheckinCode(clean);
  };

  // Cấu hình quét siêu nhạy: 25 FPS, tăng tốc phần cứng
  const scanConfig = {
    fps: 25,
    qrbox: qrboxFunction,
    aspectRatio: 1.0,
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    }
  };

  btnToggle?.addEventListener('click', async () => {
    if (typeof Html5Qrcode === 'undefined') {
      alert('Thư viện quét camera đang tải, vui lòng thử lại sau 2 giây.');
      return;
    }

    try {
      placeholder.style.display = 'none';
      btnToggle.style.display = 'none';
      btnStop.style.display = 'inline-flex';

      // 1. Dọn dẹp scanner cũ trước khi mở mới
      await stopScanner();

      // 2. Lấy danh sách camera thực tế của máy
      let cameras = [];
      try {
        cameras = await Html5Qrcode.getCameras();
      } catch (camListErr) {
        console.warn('Lỗi truy vấn camera:', camListErr);
        const listErrMsg = String(camListErr?.message || camListErr || '');
        if (listErrMsg.includes('NotAllowedError') || listErrMsg.includes('Permission denied')) {
          throw camListErr;
        }
      }

      // 3. Xử lý dropdown chọn camera nếu máy có nhiều camera
      if (cameraSelect && cameras && cameras.length > 1) {
        cameraSelect.innerHTML = cameras.map((c, i) =>
          `<option value="${c.id}">${c.label || ('Camera ' + (i + 1))}</option>`
        ).join('');
        cameraSelect.style.display = 'inline-block';
        if (!selectedCameraId || !cameras.some(c => c.id === selectedCameraId)) {
          selectedCameraId = cameras[0].id;
        }
        cameraSelect.value = selectedCameraId;
      } else {
        if (cameraSelect) cameraSelect.style.display = 'none';
        if (cameras && cameras.length > 0) {
          selectedCameraId = cameras[0].id;
        }
      }

      // 4. Khởi tạo phiên bản quét mới
      state.html5QrScanner = new Html5Qrcode("qr-reader", {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        verbose: false
      });

      // 5. Bắt đầu quét với camera cụ thể hoặc chế độ mặc định an toàn
      const cameraConfig = selectedCameraId ? selectedCameraId : { facingMode: "user" };
      await state.html5QrScanner.start(
        cameraConfig,
        scanConfig,
        onScanSuccess,
        () => {}
      );

      state.isScanning = true;
    } catch (err) {
      console.error('Lỗi khởi động camera:', err);
      alert(formatCameraErrorMessage(err));
      await stopScanner();
      placeholder.style.display = 'flex';
      btnToggle.style.display = 'inline-flex';
      btnStop.style.display = 'none';
      if (cameraSelect) cameraSelect.style.display = 'none';
    }
  });

  cameraSelect?.addEventListener('change', async (e) => {
    selectedCameraId = e.target.value;
    if (state.isScanning) {
      try {
        await stopScanner();
        state.html5QrScanner = new Html5Qrcode("qr-reader", {
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false
        });
        await state.html5QrScanner.start(
          selectedCameraId,
          scanConfig,
          onScanSuccess,
          () => {}
        );
        state.isScanning = true;
      } catch (err) {
        alert(formatCameraErrorMessage(err));
        await stopScanner();
        placeholder.style.display = 'flex';
        btnToggle.style.display = 'inline-flex';
        btnStop.style.display = 'none';
      }
    }
  });

  btnStop?.addEventListener('click', async () => {
    await stopScanner();
    placeholder.style.display = 'flex';
    btnToggle.style.display = 'inline-flex';
    btnStop.style.display = 'none';
    if (cameraSelect) cameraSelect.style.display = 'none';
  });

  // 5. Hỗ trợ quét trực tiếp từ ảnh chụp QR trên máy tính/điện thoại
  const fileInput = document.getElementById('qrFileInput');
  const btnUpload = document.getElementById('btnUploadQrImage');

  btnUpload?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileScanner = new Html5Qrcode("qr-reader-temp", {
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false
      });
      const decodedText = await fileScanner.scanFile(file, true);
      if (decodedText) {
        processCheckinCode(decodedText);
      }
    } catch (err) {
      alert('Không đọc được mã QR từ ảnh: ' + (err.message || 'Vui lòng kiểm tra lại góc chụp hoặc độ nét của ảnh'));
    } finally {
      e.target.value = '';
    }
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

  populateAttendeeCategoryFilter();

  let list = [...(state.events || [])];

  const kw = (attendeeEventFilters.keyword || '').trim().toLowerCase();
  if (kw) {
    list = list.filter(ev =>
      (ev.tenSuKien && ev.tenSuKien.toLowerCase().includes(kw)) ||
      (ev.moTa && ev.moTa.toLowerCase().includes(kw)) ||
      (ev.diaDiem && ev.diaDiem.toLowerCase().includes(kw)) ||
      (ev.loaiSuKien && ev.loaiSuKien.toLowerCase().includes(kw)) ||
      (ev.maSuKien && ev.maSuKien.toLowerCase().includes(kw))
    );
  }

  if (attendeeEventFilters.status && attendeeEventFilters.status !== 'all') {
    list = list.filter(ev => ev.trangThai === attendeeEventFilters.status);
  }

  if (attendeeEventFilters.category && attendeeEventFilters.category !== 'all') {
    list = list.filter(ev => ev.loaiSuKien === attendeeEventFilters.category);
  }

  // Sort
  if (attendeeEventFilters.sortBy === 'date-asc') {
    list.sort((a, b) => new Date(a.ngayBatDau) - new Date(b.ngayBatDau));
  } else if (attendeeEventFilters.sortBy === 'date-desc') {
    list.sort((a, b) => new Date(b.ngayBatDau) - new Date(a.ngayBatDau));
  } else if (attendeeEventFilters.sortBy === 'price-asc') {
    list.sort((a, b) => Number(a.giaVeTu || 0) - Number(b.giaVeTu || 0));
  } else if (attendeeEventFilters.sortBy === 'price-desc') {
    list.sort((a, b) => Number(b.giaVeTu || 0) - Number(a.giaVeTu || 0));
  }

  // Counter
  const counterEl = document.getElementById('attendeeFilterCounter');
  if (counterEl) {
    counterEl.innerHTML = `Hiển thị <strong>${list.length}</strong> / ${state.events ? state.events.length : 0} sự kiện`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="filter-empty-state">
        <div style="font-size: 2.8rem; margin-bottom: 8px;">🔍</div>
        <h3>Không tìm thấy sự kiện nào phù hợp</h3>
        <p class="text-muted" style="margin-top: 4px;">
          ${kw ? `Không có sự kiện nào khớp với từ khóa "<strong>${attendeeEventFilters.keyword}</strong>"` : 'Không có sự kiện nào khớp với bộ lọc trạng thái/chủ đề hiện tại.'}
        </p>
        <button class="btn btn-outline btn-sm mt-3" onclick="resetAttendeeEventFilters()">
          🔄 Xem tất cả sự kiện
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(ev => {
    const isSoldOut = ev.soVeConLai !== undefined && ev.soVeConLai <= 0;
    const cleanTitle = (ev.tenSuKien || '').replace(/'/g, "\\'");
    const statusLabel = ev.trangThai === 'DangDienRa' ? 'Đang diễn ra' : (ev.trangThai === 'SapDienRa' ? 'Sắp diễn ra' : 'Đã kết thúc');
    const statusBadgeClass = ev.trangThai === 'DangDienRa' ? 'badge-success' : (ev.trangThai === 'SapDienRa' ? 'badge-info' : 'badge-secondary');

    let ticketQuotaHtml = '';
    if (ev.soVeConLai !== undefined) {
      if (isSoldOut) {
        ticketQuotaHtml = '<strong style="color: #f87171;">🔴 Đã hết vé tham dự</strong>';
      } else if (ev.soVeConLai <= 10) {
        ticketQuotaHtml = `<strong style="color: #fbbf24;">⚡ Sắp hết: Còn ${ev.soVeConLai} / ${ev.tongSoVe} vé</strong>`;
      } else {
        ticketQuotaHtml = `<strong style="color: #34d399;">🟢 Còn lại: ${ev.soVeConLai} / ${ev.tongSoVe} vé</strong>`;
      }
    }

    return `
      <div class="stream-card">
        <div class="stream-banner" style="background-image: url('${ev.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87'}');">
          <span class="badge badge-accent" style="position: absolute; top: 12px; left: 12px;">${ev.loaiSuKien}</span>
          <span class="badge ${statusBadgeClass}" style="position: absolute; top: 12px; right: 12px;">${statusLabel}</span>
          ${isSoldOut ? `<span class="badge badge-danger" style="position: absolute; bottom: 12px; left: 12px; background: rgba(239,68,68,0.85); color: #fff;">ĐÃ HẾT VÉ</span>` : ''}
        </div>
        <div class="stream-content">
          <div>
            <h3 style="font-size: 1.35rem; font-weight: 700; margin-bottom: 8px;">${ev.tenSuKien}</h3>
            <p class="event-desc">${ev.moTa || 'Sự kiện hàng đầu về công nghệ và khởi nghiệp.'}</p>
            <div class="event-meta-row"><span>📍</span> <strong>${ev.diaDiem}</strong></div>
            <div class="event-meta-row"><span>📅</span> <span>${formatDate(ev.ngayBatDau)}</span></div>
            ${ticketQuotaHtml ? `<div class="event-meta-row"><span>🎫</span> <span>${ticketQuotaHtml}</span></div>` : ''}
          </div>
          <div style="margin-top: 20px;">
            ${isSoldOut ? `
              <button class="btn btn-secondary btn-block" disabled style="opacity: 0.6; cursor: not-allowed;">
                🔴 Đã hết vé tham dự
              </button>
            ` : `
              <button class="btn btn-primary btn-block" onclick="openBookTicketModal(${ev.id}, '${cleanTitle}')">
                🎟️ Đặt vé tham dự ngay ${ev.soVeConLai !== undefined ? `(Còn ${ev.soVeConLai} vé)` : ''}
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function loadAttendeeTickets(email = null) {
  const container = document.getElementById('attendeeTicketsGallery');
  if (!container) return;

  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  const filterInput = document.getElementById('attendeeEmailFilter');
  const targetEmail = (email || (filterInput ? filterInput.value.trim() : '') || (user ? user.email : '') || 'chuyen121106@gmail.com').trim();

  if (filterInput && targetEmail) {
    filterInput.value = targetEmail;
  }

  try {
    const myTickets = await api.get(`/api/my-tickets?email=${encodeURIComponent(targetEmail)}`);
    container.innerHTML = myTickets.map(tk => {
      const isChecked = tk.trangThai === 'DaCheckIn';
      const isCancelled = tk.trangThai === 'Huy';
      const cleanEventTitle = (tk.tenSuKien || '').replace(/'/g, "\\'");

      let statusBadgeHtml = '';
      if (isCancelled) {
        statusBadgeHtml = `<span class="ticket-status-badge cancelled">ĐÃ HỦY VÉ</span>`;
      } else if (isChecked) {
        statusBadgeHtml = `<span class="ticket-status-badge checked">ĐÃ CHECK-IN</span>`;
      } else {
        statusBadgeHtml = `<span class="ticket-status-badge valid">VÉ HỢP LỆ</span>`;
      }

      return `
        <div class="ticket-pass ${isCancelled ? 'is-cancelled' : ''}">
          <div class="ticket-header">
            <div>
              <span class="badge badge-accent">${tk.tenHangVe || 'Standard'} PASS</span>
              <h3 style="font-size: 1.15rem; margin-top: 4px;">${tk.tenSuKien}</h3>
            </div>
            ${statusBadgeHtml}
          </div>
          <div class="ticket-body">
            <small class="text-muted">MÃ VÉ CỦA BẠN: <strong>${tk.maDangKy}</strong></small>
            <div class="qr-display" style="${isCancelled ? 'opacity: 0.35; position: relative;' : ''}">
              <img src="${buildQrUrl(tk.qrCode || tk.maDangKy)}" alt="QR Code" />
            </div>
            ${isCancelled ? `
              <small style="color: #f87171; font-weight: 600;">Vé này đã bị hủy — Vị trí vé đã được giải phóng</small>
            ` : `
              <small class="text-muted">Xuất trình mã này tại cổng tiếp đón</small>
            `}
            <div style="margin-top: 14px; font-size: 0.88rem; color: var(--text-secondary);">
              📍 ${tk.diaDiem || 'Địa điểm sự kiện'}<br>
              ⏱️ ${formatDate(tk.ngayBatDau)}
            </div>

            ${(!isCancelled && !isChecked) ? `
              <div style="margin-top: 16px; width: 100%; border-top: 1px dashed rgba(255,255,255,0.12); padding-top: 12px; text-align: center;">
                <button type="button" class="btn btn-sm btn-outline" style="border-color: rgba(239, 68, 68, 0.5); color: #f87171; width: 100%; font-size: 0.85rem;" onclick="cancelAttendeeTicket(${tk.id}, '${tk.maDangKy}', '${cleanEventTitle}')">
                  ❌ Hủy vé tham dự
                </button>
              </div>
            ` : ''}
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

// Hàm hủy vé dành cho người tham dự
window.cancelAttendeeTicket = async function(ticketId, maDangKy, tenSuKien) {
  const filterInput = document.getElementById('attendeeEmailFilter');
  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  const targetEmail = (filterInput?.value?.trim() || user?.email || '').trim();

  if (!confirm(`⚠️ XÁC NHẬN HỦY VÉ:\nBạn có chắc chắn muốn hủy vé "${maDangKy}" tham dự sự kiện:\n"${tenSuKien}" không?\n\nSau khi bạn hủy vé thành công, chỗ ngồi này sẽ được hoàn trả vào hệ thống cho những người khác có thể đăng ký.`)) {
    return;
  }

  try {
    const res = await api.patch(`/api/my-tickets/${ticketId}/cancel`, { email: targetEmail });
    alert(`✅ ${res.message || 'Hủy vé thành công!'}`);

    // Tải lại dữ liệu sự kiện và danh sách vé
    await loadBaseEvents();
    await loadAttendeeTickets(targetEmail);
    if (document.getElementById('attendeeEventsList')) {
      await loadAttendeeEvents();
    }
    if (document.getElementById('landingEventsGrid')) {
      await loadLandingPage();
    }
  } catch (err) {
    alert(`❌ Lỗi hủy vé: ${err.message || 'Không thể hủy vé'}`);
  }
};

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

async function openBookTicketModal(eventId, eventName) {
  document.getElementById('bookModalEventId').value = eventId;
  document.getElementById('bookModalEventTitle').textContent = `Đăng ký vé: ${eventName}`;
  const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
  if (user) {
    document.getElementById('bookModalFullName').value = user.hoTen || '';
    document.getElementById('bookModalEmail').value = user.email || '';
  }

  const tiersListContainer = document.getElementById('bookModalTiersList');
  const select = document.getElementById('bookModalTicketSelect');
  const submitBtn = document.getElementById('btnSubmitBookTicket');

  try {
    const tiers = await api.get(`/api/tickets?eventId=${eventId}`);

    // Hiển thị danh sách các hạng vé kèm số lượng còn lại chi tiết
    if (tiersListContainer) {
      if (tiers && tiers.length > 0) {
        tiersListContainer.innerHTML = tiers.map(t => {
          const isTierSoldOut = t.conLai <= 0;
          return `
            <div class="tier-availability-card ${isTierSoldOut ? 'sold-out' : ''}">
              <div class="tier-name">
                <span>${t.tenHangVe}</span>
                <small class="text-muted">(${formatCurrency(t.gia)})</small>
              </div>
              <div class="tier-quota">
                ${isTierSoldOut
                  ? '<span style="color: #f87171;">🔴 Hết vé</span>'
                  : `<span style="color: #34d399;">🟢 Còn ${t.conLai} / ${t.soLuong} vé</span>`
                }
              </div>
            </div>
          `;
        }).join('');
      } else {
        tiersListContainer.innerHTML = '<small class="text-muted">Đang cập nhật số lượng vé...</small>';
      }
    }

    // Nạp dropdown chọn vé kèm thông tin còn vé
    if (select) {
      if (tiers && tiers.length > 0) {
        select.innerHTML = tiers.map(t => {
          const isTierSoldOut = t.conLai <= 0;
          return `<option value="${t.tenHangVe}" ${isTierSoldOut ? 'disabled' : ''}>Vé ${t.tenHangVe} - ${formatCurrency(t.gia)} ${isTierSoldOut ? '[ĐÃ HẾT VÉ]' : `(Còn ${t.conLai} vé)`}</option>`;
        }).join('');

        const availableOpt = Array.from(select.options).find(opt => !opt.disabled);
        if (availableOpt) {
          select.value = availableOpt.value;
        }
      } else {
        select.innerHTML = `
          <option value="VIP">Vé VIP (Chỗ ngồi ưu tiên + Lounge) - 2.390.000 đ</option>
          <option value="Professional">Vé Professional (Hội thảo + Workshop) - 1.490.000 đ</option>
          <option value="Standard">Vé Standard (Tiêu chuẩn) - 790.000 đ</option>
        `;
      }
    }

    // Kiểm tra nếu tất cả các hạng vé đều đã hết
    const allSoldOut = tiers && tiers.length > 0 && tiers.every(t => t.conLai <= 0);
    if (submitBtn) {
      if (allSoldOut) {
        submitBtn.disabled = true;
        submitBtn.textContent = '🔴 Sự kiện đã hết vé';
        submitBtn.style.opacity = '0.6';
        submitBtn.style.cursor = 'not-allowed';
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Xác nhận đặt vé & Nhận mã QR';
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    }
  } catch (e) {
    if (select) {
      select.innerHTML = `
        <option value="VIP">Vé VIP (Chỗ ngồi ưu tiên + Lounge) - 2.390.000 đ</option>
        <option value="Professional">Vé Professional (Hội thảo + Workshop) - 1.490.000 đ</option>
        <option value="Standard">Vé Standard (Tiêu chuẩn) - 790.000 đ</option>
      `;
    }
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

// ================= DIỄN GIẢ & PHIÊN NỘI DUNG =================
window.openAssignSpeakerModal = async function(sessionId) {
  try {
    const data = await api.get(`/api/sessions/${sessionId}/speakers`, true);
    const session = data.session;
    const assigned = data.assignedSpeakers || [];
    const available = data.availableSpeakers || [];

    const sessionIdInput = document.getElementById('assignModalSessionId');
    if (sessionIdInput) sessionIdInput.value = session.id;

    const titleEl = document.getElementById('assignModalSessionTitle');
    if (titleEl) {
      titleEl.innerHTML = `Phiên: <strong style="color: #60a5fa;">${session.tenPhien}</strong> (${session.maPhien}) • Sự kiện: <em>${session.tenSuKien || 'Chưa rõ'}</em>`;
    }

    // Render assigned speakers
    const currentListEl = document.getElementById('assignModalCurrentSpeakersList');
    if (currentListEl) {
      if (assigned.length === 0) {
        currentListEl.innerHTML = '<p class="text-muted" style="font-size: 0.85rem; font-style: italic; margin: 4px 0;">Chưa có diễn giả nào được gán cho phiên này.</p>';
      } else {
        currentListEl.innerHTML = assigned.map(sp => `
          <div class="assigned-speaker-row">
            <div class="assigned-speaker-info">
              <img class="assigned-speaker-avatar" src="${sp.avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2'}" alt="${sp.tenDienGia}" />
              <div>
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${sp.tenDienGia}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${sp.chuyenNganh || 'Chuyên gia'} • Mã: ${sp.maDienGia}</div>
              </div>
            </div>
            <button type="button" class="btn-remove-speaker" onclick="removeSpeakerFromSession(${session.id}, ${sp.id}, '${sp.tenDienGia.replace(/'/g, "\\'")}')">
              ✕ Hủy gán
            </button>
          </div>
        `).join('');
      }
    }

    // Populate available speakers select
    const selectEl = document.getElementById('assignSpeakerSelect');
    const submitBtn = document.getElementById('btnSubmitAssignSpeaker');
    if (selectEl) {
      if (available.length === 0) {
        selectEl.innerHTML = '<option value="">-- Tất cả diễn giả đã được gán vào phiên này --</option>';
        if (submitBtn) submitBtn.disabled = true;
      } else {
        selectEl.innerHTML = '<option value="">-- Chọn diễn giả để gán --</option>' +
          available.map(sp => `<option value="${sp.id}">${sp.tenDienGia} (${sp.chuyenNganh || sp.maDienGia})</option>`).join('');
        if (submitBtn) submitBtn.disabled = false;
      }
    }

    openModal('assignSpeakerModal');
  } catch (err) {
    alert(err.message || 'Không thể tải thông tin diễn giả của phiên');
  }
};

window.removeSpeakerFromSession = async function(sessionId, speakerId, speakerName) {
  if (!confirm(`Bạn có chắc chắn muốn hủy gán diễn giả "${speakerName}" khỏi phiên này?`)) return;
  try {
    await api.delete(`/api/sessions/${sessionId}/speakers/${speakerId}`, true);
    alert('Đã hủy gán diễn giả thành công!');
    await window.openAssignSpeakerModal(sessionId);
    await loadBtcSessions();
  } catch (err) {
    alert(err.message || 'Lỗi khi hủy gán diễn giả');
  }
};

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
        resetAiChatHistory();
        applyUserSession(null);
      }
    } else {
      openModal('authModal');
    }
  });

  // Helper to format AI message (supports markdown bold, italic, code blocks, inline code)
  function formatAiMessage(text) {
    if (!text) return '';
    // Escape HTML first
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Handle code blocks: ```lang ... ```
    escaped = escaped.replace(/```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)```/g, (match, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Handle inline code: `code`
    escaped = escaped.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Handle bold: **text**
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Handle italic: *text*
    escaped = escaped.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

    return escaped;
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
      clearLoginAlert();
      localStorage.setItem('event_token', res.token);
      localStorage.setItem('event_user', JSON.stringify(res.user));

      closeModal('authModal');
      formEl?.reset();

      // Enforce Portal of the authenticated user role immediately without reload/reset
      await applyUserSession(res.user);
    } catch (err) {
      const data = err.data || {};
      if (err.status === 429 || data.isLocked || data.conLaiGiay) {
        showLoginAlert(err.message, 'lock', data.conLaiGiay || 180);
      } else if (data.soLanConLai !== undefined) {
        showLoginAlert(err.message, 'warning');
      } else {
        showLoginAlert(err.message || 'Đăng nhập thất bại! Vui lòng kiểm tra lại tài khoản và mật khẩu.', 'error');
      }
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

  // Admin Search Accounts Filter
  document.getElementById('adminAccountSearchInput')?.addEventListener('input', (e) => {
    const term = (e.target.value || '').trim().toLowerCase();
    if (!state.cachedAdminAccounts) return;
    if (!term) {
      renderAdminAccountsTable(state.cachedAdminAccounts);
      return;
    }
    const filtered = state.cachedAdminAccounts.filter(acc => 
      (acc.tenDangNhap && acc.tenDangNhap.toLowerCase().includes(term)) ||
      (acc.hoTen && acc.hoTen.toLowerCase().includes(term)) ||
      (acc.email && acc.email.toLowerCase().includes(term)) ||
      (acc.vaiTro && acc.vaiTro.toLowerCase().includes(term)) ||
      (acc.trangThai && acc.trangThai.toLowerCase().includes(term))
    );
    renderAdminAccountsTable(filtered);
  });

  // Admin Account Table Actions: Sửa, Khóa/Mở, Xóa
  document.getElementById('adminAccountTableBody')?.addEventListener('click', async (e) => {
    // 1. Chỉnh sửa tài khoản
    const editBtn = e.target.closest('[data-admin-edit]');
    if (editBtn) {
      const id = Number(editBtn.dataset.adminEdit);
      const acc = (state.cachedAdminAccounts || []).find(a => a.id === id);
      if (!acc) return;

      document.getElementById('editAccountId').value = acc.id;
      document.getElementById('editAccountUsername').value = acc.tenDangNhap || '';
      document.getElementById('editAccountFullName').value = acc.hoTen || '';
      document.getElementById('editAccountEmail').value = acc.email || '';
      document.getElementById('editAccountRole').value = acc.vaiTro || 'NguoiThamDu';
      document.getElementById('editAccountStatus').value = acc.trangThai || 'HoatDong';
      document.getElementById('editAccountPassword').value = '';

      openModal('adminEditAccountModal');
      return;
    }

    // 2. Khóa / Mở khóa tài khoản
    const lockBtn = e.target.closest('[data-admin-lock]');
    if (lockBtn) {
      const id = Number(lockBtn.dataset.adminLock);
      const username = lockBtn.dataset.username || 'tài khoản này';
      const name = lockBtn.dataset.name || '';
      const isLocked = lockBtn.dataset.status === 'Khoa';

      if (id === state.currentUser?.id) {
        alert('⚠️ Bạn không thể tự khóa tài khoản quản trị của chính mình.');
        return;
      }

      const confirmMsg = isLocked
        ? `Bạn có muốn MỞ KHÓA cho tài khoản "${username}" (${name})?\nNgười dùng này sẽ có thể đăng nhập lại vào hệ thống.`
        : `Bạn có chắc chắn muốn KHÓA tài khoản "${username}" (${name})?\nNgười dùng này sẽ bị chặn và không thể đăng nhập vào hệ thống!`;

      if (!confirm(confirmMsg)) return;

      try {
        const res = await api.patch(`/api/accounts/${id}/toggle-lock`, {}, true);
        alert(`✅ ${res.message}`);
        await loadAdminAccounts();
      } catch (err) {
        alert(`❌ Lỗi: ${err.message || 'Không thể thay đổi trạng thái tài khoản'}`);
      }
      return;
    }

    // 3. Xóa tài khoản vĩnh viễn
    const delBtn = e.target.closest('[data-admin-delete]');
    if (delBtn) {
      const id = Number(delBtn.dataset.adminDelete);
      const username = delBtn.dataset.username || 'tài khoản này';
      const name = delBtn.dataset.name || '';

      if (id === state.currentUser?.id) {
        alert('⚠️ Bạn không thể tự xóa tài khoản quản trị của chính mình.');
        return;
      }

      if (!confirm(`⚠️ CẢNH BÁO XÓA:\nBạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản "${username}" (${name}) khỏi hệ thống không?\nHành động này không thể hoàn tác!`)) {
        return;
      }

      try {
        const res = await api.delete(`/api/accounts/${id}`, true);
        alert(`✅ ${res.message}`);
        await loadAdminAccounts();
      } catch (err) {
        alert(`❌ Lỗi xóa tài khoản: ${err.message || 'Không thể xóa tài khoản'}`);
      }
      return;
    }
  });

  // Admin Submit Edit Account Form
  document.getElementById('adminEditAccountForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editAccountId').value;
    const tenDangNhap = document.getElementById('editAccountUsername').value.trim();
    const hoTen = document.getElementById('editAccountFullName').value.trim();
    const email = document.getElementById('editAccountEmail').value.trim();
    const vaiTro = document.getElementById('editAccountRole').value;
    const trangThai = document.getElementById('editAccountStatus').value;
    const matKhau = document.getElementById('editAccountPassword').value;

    if (!tenDangNhap || !hoTen || !email || !vaiTro) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    const submitBtn = document.getElementById('btnSubmitEditAccount');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    try {
      const payload = { tenDangNhap, hoTen, email, vaiTro, trangThai };
      if (matKhau && matKhau.trim()) {
        payload.matKhau = matKhau.trim();
      }

      const res = await api.put(`/api/accounts/${id}`, payload, true);
      alert(`✅ ${res.message || 'Cập nhật tài khoản thành công!'}`);
      closeModal('adminEditAccountModal');
      await loadAdminAccounts();
    } catch (err) {
      alert(`❌ Lỗi cập nhật: ${err.message || 'Không thể lưu thay đổi'}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
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

  // ================= KIỂM TRA TRÙNG LỊCH PHIÊN NỘI DUNG =================
  let btcSessionConflictTimer = null;

  async function checkBtcSessionTimeConflict() {
    const eventSelect = document.getElementById('btcSessionEventSelect');
    const startInput = document.getElementById('btcSessionStartTime');
    const durationInput = document.getElementById('btcSessionDuration');
    const alertBox = document.getElementById('sessionTimeConflictAlert');
    const validNotice = document.getElementById('sessionTimeValidNotice');
    const msgEl = document.getElementById('sessionConflictMsg');
    const detailEl = document.getElementById('sessionConflictDetail');
    const submitBtn = document.getElementById('btnSaveBtcSession');

    if (!eventSelect || !startInput || !durationInput) return { hasConflict: false };

    const suKienId = eventSelect.value;
    const ngayGio = startInput.value;
    const thoiLuong = durationInput.value || 60;

    // Nếu chưa chọn sự kiện hoặc chưa chọn thời gian bắt đầu
    if (!suKienId || !ngayGio) {
      if (alertBox) alertBox.style.display = 'none';
      if (validNotice) validNotice.style.display = 'none';
      startInput.classList.remove('input-conflict-error');
      durationInput.classList.remove('input-conflict-error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.title = '';
      }
      return { hasConflict: false };
    }

    try {
      const res = await api.get(
        `/api/sessions/check-conflict?suKienId=${suKienId}&ngayGio=${encodeURIComponent(ngayGio)}&thoiLuong=${thoiLuong}`
      );

      if (res.hasConflict) {
        // Cảnh báo ngay lập tức trên giao diện
        if (alertBox) {
          alertBox.style.display = 'flex';
          if (msgEl) msgEl.textContent = res.message;
          if (detailEl && res.conflictingSession) {
            const cs = res.conflictingSession;
            detailEl.innerHTML = `
              <strong>Phiên trùng:</strong> ${cs.tenPhien} (Mã: <code>${cs.maPhien}</code>)<br/>
              <strong>Thời lượng:</strong> ${cs.thoiLuong} phút | <strong>Phòng:</strong> ${cs.phong || 'Chính'}
            `;
          }
        }
        if (validNotice) validNotice.style.display = 'none';

        startInput.classList.add('input-conflict-error');
        durationInput.classList.add('input-conflict-error');

        // Khóa không cho bấm lưu phiên bị trùng
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.title = 'Không thể lưu: Phiên bị trùng lịch trong cùng sự kiện!';
        }

        return { hasConflict: true, message: res.message };
      } else {
        // Không trùng -> Bật trạng thái hợp lệ
        if (alertBox) alertBox.style.display = 'none';
        if (validNotice) {
          validNotice.style.display = 'flex';
          const validMsg = document.getElementById('sessionValidMsg');
          if (validMsg) validMsg.textContent = res.message || 'Khung giờ hợp lệ, không bị trùng lịch với phiên nào khác.';
        }

        startInput.classList.remove('input-conflict-error');
        durationInput.classList.remove('input-conflict-error');

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.title = '';
        }

        return { hasConflict: false };
      }
    } catch (err) {
      console.warn('Lỗi kiểm tra trùng lịch:', err);
      return { hasConflict: false };
    }
  }

  function debouncedBtcSessionConflictCheck() {
    clearTimeout(btcSessionConflictTimer);
    btcSessionConflictTimer = setTimeout(checkBtcSessionTimeConflict, 150);
  }

  document.getElementById('btcSessionEventSelect')?.addEventListener('change', checkBtcSessionTimeConflict);
  document.getElementById('btcSessionStartTime')?.addEventListener('input', debouncedBtcSessionConflictCheck);
  document.getElementById('btcSessionStartTime')?.addEventListener('change', checkBtcSessionTimeConflict);
  document.getElementById('btcSessionDuration')?.addEventListener('input', debouncedBtcSessionConflictCheck);
  document.getElementById('btcSessionDuration')?.addEventListener('change', checkBtcSessionTimeConflict);

  // BTC Session Form Submit
  document.getElementById('btcSessionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    // Kiểm tra trực tiếp thời gian trước khi submit
    const conflictCheck = await checkBtcSessionTimeConflict();
    if (conflictCheck.hasConflict) {
      alert(conflictCheck.message || 'Cảnh báo: Thời gian phiên mới bị trùng với phiên đã có trong cùng sự kiện! Không thể đăng ký phiên đó.');
      document.getElementById('sessionTimeConflictAlert')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      const dienGiaVal = form.get('dienGiaId');
      const thoiLuongVal = form.get('thoiLuong');

      await api.post('/api/sessions', {
        suKienId: Number(form.get('suKienId')),
        maPhien: form.get('maPhien'),
        tenPhien: form.get('tenPhien'),
        ngayGio: form.get('ngayGio'),
        thoiLuong: thoiLuongVal ? Number(thoiLuongVal) : 60,
        phong: form.get('phong'),
        moTa: form.get('moTa'),
        dienGiaId: dienGiaVal ? Number(dienGiaVal) : null
      }, true);

      alert('Thêm phiên hội thảo thành công');
      formEl?.reset();

      // Khôi phục giá trị mặc định cho thời lượng (60 phút)
      const durationInput = document.getElementById('btcSessionDuration');
      if (durationInput) durationInput.value = '60';

      // Ẩn các hộp cảnh báo và xóa highlight lỗi
      const alertBox = document.getElementById('sessionTimeConflictAlert');
      const validNotice = document.getElementById('sessionTimeValidNotice');
      if (alertBox) alertBox.style.display = 'none';
      if (validNotice) validNotice.style.display = 'none';
      document.getElementById('btcSessionStartTime')?.classList.remove('input-conflict-error');
      document.getElementById('btcSessionDuration')?.classList.remove('input-conflict-error');
      const submitBtn = document.getElementById('btnSaveBtcSession');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.title = '';
      }

      await loadBtcSessions();
    } catch (err) {
      if (err.status === 409 || err.data?.hasConflict) {
        const alertBox = document.getElementById('sessionTimeConflictAlert');
        const msgEl = document.getElementById('sessionConflictMsg');
        if (alertBox) {
          alertBox.style.display = 'flex';
          if (msgEl) msgEl.textContent = err.message;
        }
        document.getElementById('btcSessionStartTime')?.classList.add('input-conflict-error');
        document.getElementById('btcSessionDuration')?.classList.add('input-conflict-error');
        alert(err.message || 'Lỗi: Trùng thời gian phiên trong cùng sự kiện!');
      } else {
        alert(err.message || 'Lỗi thêm phiên');
      }
    }
  });

  // Assign Speaker Form (Modal)
  document.getElementById('assignSpeakerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sessionId = document.getElementById('assignModalSessionId').value;
    const speakerId = document.getElementById('assignSpeakerSelect').value;
    if (!sessionId || !speakerId) {
      alert('Vui lòng chọn diễn giả để gán');
      return;
    }
    try {
      await api.post(`/api/sessions/${sessionId}/speakers`, { dienGiaId: Number(speakerId) }, true);
      alert('Gán diễn giả vào phiên thành công!');
      await window.openAssignSpeakerModal(sessionId);
      await loadBtcSessions();
    } catch (err) {
      alert(err.message || 'Lỗi khi gán diễn giả');
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

  // BTC AI Generate Notification & Direct Broadcast
  let currentGeneratedNotification = null;

  // Cập nhật thông tin sự kiện mục tiêu và số người nhận theo bước chọn sự kiện trước đó
  const updateAiNotificationTargetInfo = async () => {
    const eventSelect = document.getElementById('aiNotificationEvent');
    const targetEventNameEl = document.getElementById('aiNotificationTargetEventName');
    const targetCountEl = document.getElementById('aiNotificationTargetCount');
    if (!eventSelect) return;

    const eventId = Number(eventSelect.value);
    const eventName = eventSelect.options[eventSelect.selectedIndex]?.text || currentGeneratedNotification?.eventName || 'Sự kiện đã chọn';

    if (targetEventNameEl) targetEventNameEl.textContent = eventName;

    if (targetCountEl) {
      targetCountEl.textContent = 'Đang đếm người nhận...';
      try {
        const regs = await api.get('/api/registrations', true).catch(() => []);
        const eventRegs = regs.filter(r => r.suKienId === eventId && r.trangThai !== 'Huy');
        const uniqueEmails = new Set(eventRegs.map(r => (r.email || '').toLowerCase().trim()).filter(Boolean));
        targetCountEl.textContent = `${uniqueEmails.size} người nhận`;
      } catch (e) {
        targetCountEl.textContent = 'Người tham dự';
      }
    }
  };

  document.getElementById('aiNotificationEvent')?.addEventListener('change', () => {
    const actionsBox = document.getElementById('aiNotificationActions');
    if (actionsBox && !actionsBox.classList.contains('hidden')) {
      updateAiNotificationTargetInfo();
    }
  });

  document.getElementById('btnAiGenerateNotification')?.addEventListener('click', async () => {
    const type = document.getElementById('aiNotificationType').value;
    const eventId = document.getElementById('aiNotificationEvent').value;
    const message = document.getElementById('aiNotificationPrompt').value;
    const outBox = document.getElementById('aiNotificationResult');
    const actionsBox = document.getElementById('aiNotificationActions');
    const statusBox = document.getElementById('aiNotificationStatus');

    outBox.textContent = 'AI đang khởi tạo nội dung...';
    if (actionsBox) actionsBox.classList.add('hidden');
    if (statusBox) {
      statusBox.classList.add('hidden');
      statusBox.textContent = '';
    }

    try {
      const res = await api.post('/api/ai/generate-notification', { type, message, eventId }, true);
      const content = res.content || '';
      outBox.textContent = content || JSON.stringify(res, null, 2);

      currentGeneratedNotification = {
        title: res.title || `Thông báo sự kiện: ${res.eventName || 'AI EventHub'}`,
        content: content,
        type: type,
        eventId: Number(eventId),
        eventName: res.eventName
      };

      if (actionsBox && content) {
        actionsBox.classList.remove('hidden');
        await updateAiNotificationTargetInfo();
      }
    } catch (e) {
      outBox.textContent = 'Lỗi tạo thông báo: ' + e.message;
      if (actionsBox) actionsBox.classList.add('hidden');
    }
  });

  // Gửi thông báo trực tiếp đến những người đã đăng ký sự kiện đã chọn ở bước trước
  document.getElementById('btnSendAiNotification')?.addEventListener('click', async () => {
    const eventSelect = document.getElementById('aiNotificationEvent');
    const eventId = Number(eventSelect?.value);
    const eventName = eventSelect?.options[eventSelect.selectedIndex]?.text || currentGeneratedNotification?.eventName || 'sự kiện đã chọn';
    const outBox = document.getElementById('aiNotificationResult');
    const content = (outBox?.innerText || outBox?.textContent || currentGeneratedNotification?.content || '').trim();
    const type = document.getElementById('aiNotificationType')?.value || currentGeneratedNotification?.type || 'MoiThamDu';
    const title = currentGeneratedNotification?.title || `Thông báo sự kiện: ${eventName}`;
    const sendBtn = document.getElementById('btnSendAiNotification');
    const statusBox = document.getElementById('aiNotificationStatus');

    if (!eventId) {
      alert('Vui lòng chọn sự kiện ở bước trên trước khi gửi.');
      return;
    }

    if (!content) {
      alert('Vui lòng sinh nội dung thông báo bằng AI trước khi gửi.');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn gửi email thông báo này đến tất cả người đã đăng ký tham gia sự kiện:\n"${eventName}" không?`)) {
      return;
    }

    const originalBtnHtml = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi email...';

    if (statusBox) {
      statusBox.className = 'mt-2';
      statusBox.style.background = 'rgba(59, 130, 246, 0.15)';
      statusBox.style.border = '1px solid rgba(59, 130, 246, 0.3)';
      statusBox.style.color = '#38bdf8';
      statusBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Hệ thống đang điều phối gửi email tới người tham dự qua SMTP, vui lòng đợi trong giây lát...';
      statusBox.classList.remove('hidden');
    }

    try {
      const res = await api.post('/api/ai/broadcast-notification', {
        eventIds: [eventId],
        title,
        content,
        type
      }, true);

      if (statusBox) {
        statusBox.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBox.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        statusBox.style.color = '#34d399';
        statusBox.innerHTML = `✅ <strong>Thành công:</strong> ${res.message}`;
      }

      alert(`✅ ${res.message}`);
    } catch (err) {
      if (statusBox) {
        statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        statusBox.style.color = '#f87171';
        statusBox.innerHTML = `❌ <strong>Lỗi:</strong> ${err.message || 'Không thể gửi email thông báo'}`;
        statusBox.classList.remove('hidden');
      }
      alert('Lỗi: ' + (err.message || 'Không thể gửi thông báo'));
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalBtnHtml;
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
    const eventId = Number(form.get('eventId'));
    const submitBtn = formEl.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Xác nhận đặt vé & Nhận mã QR';

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '🤖 AI đang soạn thông báo & gửi email...';
      }

      const res = await api.post('/api/registrations', {
        eventId,
        fullName: form.get('fullName'),
        email,
        phone: form.get('phone'),
        ticketType: form.get('ticketType')
      });

      closeModal('bookTicketModal');
      formEl?.reset();

      // Hiển thị modal thông báo thành công kèm thông điệp AI & trạng thái email
      const successModal = document.getElementById('ticketSuccessModal');
      if (successModal) {
        const eventObj = state.events.find(ev => ev.id === eventId);
        document.getElementById('successTicketEventName').textContent = eventObj?.tenSuKien || res.notification?.title || 'Sự kiện AI EventHub';
        document.getElementById('successMaDangKy').textContent = res.maDangKy || 'REG';
        document.getElementById('successTicketType').textContent = res.ticketType || 'VIP';

        const qrContainer = document.getElementById('successQrContainer');
        if (qrContainer) {
          qrContainer.innerHTML = `
            <img src="${buildQrUrl(res.qrCode || res.maDangKy)}" width="110" height="110" style="border-radius: 6px; border: 1px solid #cbd5e1; display: block; margin: 0 auto;" />
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px; font-weight: 600;">${res.qrCode || res.maDangKy}</div>
          `;
        }

        const emailBadge = document.getElementById('successEmailBadge');
        const emailDesc = document.getElementById('successEmailDesc');
        const emailRes = res.notification?.emailResult;

        if (emailRes?.sent) {
          emailBadge.textContent = 'ĐÃ GỬI VÀO HÒM THƯ';
          emailBadge.style.background = '#10b981';
          emailDesc.innerHTML = `✅ Thư xác nhận đăng ký cùng mã QR và lịch trình chi tiết đã được gửi đến email <strong>${email}</strong>.`;
        } else {
          emailBadge.textContent = 'ĐÃ TỰ ĐỘNG SINH & SẴN SÀNG';
          emailBadge.style.background = '#6366f1';
          emailDesc.innerHTML = `📨 Hệ thống AI đã tạo trọn bộ thông báo và nhắc lịch gửi tới <strong>${email}</strong>. <em>(Mẹo: Nhập SMTP_USER và SMTP_PASS vào file .env để chuyển tiếp trực tiếp vào hộp thư Gmail cá nhân).</em>`;
        }

        document.getElementById('successAiContent').textContent = res.notification?.aiContent || 'Thông báo đăng ký thành công đã được lưu vào hệ thống.';
        openModal('ticketSuccessModal');
      } else {
        alert(`🎉 Đăng ký thành công!\n- Mã vé: ${res.maDangKy}\n- Mã QR: ${res.qrCode}\n- Hạng vé: ${res.ticketType}\n\n🤖 AI đã tự động soạn thông báo xác nhận và gửi email nhắc lịch trình tới: ${email}`);
      }

      const filterInput = document.getElementById('attendeeEmailFilter');
      if (filterInput) filterInput.value = email;

      const user = state.currentUser || JSON.parse(localStorage.getItem('event_user') || 'null');
      if (user && user.vaiTro === 'NguoiThamDu') {
        const ticketNavBtn = document.querySelector('#view-attendee [data-target="attendee-tickets"]');
        if (ticketNavBtn) ticketNavBtn.click();
      }
      await loadBaseEvents();
      await loadAttendeeTickets(email);
      if (document.getElementById('attendeeEventsList')) await loadAttendeeEvents();
      if (document.getElementById('landingEventsGrid')) await loadLandingPage();
    } catch (err) {
      alert(err.message || 'Đặt vé thất bại');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  });

  // Attendee Event Search & Filters
  const attendeeSearchInput = document.getElementById('attendeeEventSearchInput');
  const attendeeClearBtn = document.getElementById('btnAttendeeClearSearch');
  if (attendeeSearchInput) {
    attendeeSearchInput.addEventListener('input', (e) => {
      attendeeEventFilters.keyword = e.target.value;
      if (attendeeClearBtn) attendeeClearBtn.classList.toggle('hidden', !e.target.value);
      loadAttendeeEvents();
    });
  }

  attendeeClearBtn?.addEventListener('click', () => {
    if (attendeeSearchInput) attendeeSearchInput.value = '';
    attendeeEventFilters.keyword = '';
    attendeeClearBtn.classList.add('hidden');
    loadAttendeeEvents();
  });

  document.querySelectorAll('#attendeeStatusPills .status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#attendeeStatusPills .status-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      attendeeEventFilters.status = btn.dataset.status;
      loadAttendeeEvents();
    });
  });

  document.getElementById('attendeeCategoryFilter')?.addEventListener('change', (e) => {
    attendeeEventFilters.category = e.target.value;
    loadAttendeeEvents();
  });

  document.getElementById('attendeeSortFilter')?.addEventListener('change', (e) => {
    attendeeEventFilters.sortBy = e.target.value;
    loadAttendeeEvents();
  });

  document.getElementById('btnAttendeeResetFilters')?.addEventListener('click', () => {
    resetAttendeeEventFilters();
  });

  // Landing Page Event Search & Status Filters
  const landingSearchInput = document.getElementById('landingEventSearchInput');
  const landingClearBtn = document.getElementById('btnLandingClearSearch');
  if (landingSearchInput) {
    landingSearchInput.addEventListener('input', (e) => {
      landingEventFilters.keyword = e.target.value;
      if (landingClearBtn) landingClearBtn.classList.toggle('hidden', !e.target.value);
      loadLandingPage();
    });
  }

  landingClearBtn?.addEventListener('click', () => {
    if (landingSearchInput) landingSearchInput.value = '';
    landingEventFilters.keyword = '';
    landingClearBtn.classList.add('hidden');
    loadLandingPage();
  });

  document.querySelectorAll('#landingStatusPills .status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#landingStatusPills .status-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      landingEventFilters.status = btn.dataset.status;
      loadLandingPage();
    });
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
