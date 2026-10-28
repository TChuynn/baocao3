const express = require('express');
const { login, register, getProfile, listAccounts, createAccount, updateAccountRole } = require('../controllers/authController');
const { listEvents, getEventById, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');
const { generateNotification, summarizeFeedback, chatbot, broadcastNotification } = require('../controllers/aiController');
const { authMiddleware } = require('../middleware/auth');
const {
  getDashboardSummary,
  listSessions,
  createSession,
  listSpeakers,
  createSpeaker,
  listTickets,
  createTicket,
  registerGuest,
  listRegistrations,
  checkinTicket,
  undoCheckinTicket,
  getCheckinStats,
  listReports,
  createReport,
  getFinancialOverview,
  getMyTickets,
  createFeedback,
  listFeedbacks
} = require('../controllers/managementController');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Auth & Accounts
router.post('/api/auth/login', login);
router.post('/api/auth/register', register);
router.get('/api/accounts', authMiddleware(['QuanTriVien']), listAccounts);
router.post('/api/accounts', authMiddleware(['QuanTriVien']), createAccount);
router.put('/api/accounts/:id/role', authMiddleware(['QuanTriVien']), updateAccountRole);
router.get('/api/auth/profile', authMiddleware(['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'NguoiThamDu', 'KeToan']), getProfile);

// Dashboard Summary (Admin, BTC, KeToan)
router.get('/api/dashboard/summary', authMiddleware(['QuanTriVien', 'BanToChuc', 'KeToan']), getDashboardSummary);

// Events
router.get('/api/events', listEvents);
router.get('/api/events/:id', getEventById);
router.post('/api/events', authMiddleware(['QuanTriVien', 'BanToChuc']), createEvent);
router.put('/api/events/:id', authMiddleware(['QuanTriVien', 'BanToChuc']), updateEvent);
router.delete('/api/events/:id', authMiddleware(['QuanTriVien', 'BanToChuc']), deleteEvent);

// Sessions & Speakers
router.get('/api/sessions', listSessions);
router.post('/api/sessions', authMiddleware(['QuanTriVien', 'BanToChuc']), createSession);
router.get('/api/speakers', listSpeakers);
router.post('/api/speakers', authMiddleware(['QuanTriVien', 'BanToChuc']), createSpeaker);

// Tickets & Registration
router.get('/api/tickets', listTickets);
router.post('/api/tickets', authMiddleware(['QuanTriVien', 'BanToChuc']), createTicket);
router.post('/api/registrations', registerGuest);
router.get('/api/registrations', authMiddleware(['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'KeToan']), listRegistrations);

// Check-in (Staff, Organizer, Admin)
router.post('/api/checkin', authMiddleware(['NhanVienCheckIn', 'BanToChuc', 'QuanTriVien']), checkinTicket);
router.post('/api/checkin/undo', authMiddleware(['NhanVienCheckIn', 'BanToChuc', 'QuanTriVien']), undoCheckinTicket);
router.get('/api/checkin/stats', authMiddleware(['NhanVienCheckIn', 'BanToChuc', 'QuanTriVien']), getCheckinStats);

// Accountant & Reports
router.get('/api/reports', authMiddleware(['QuanTriVien', 'BanToChuc', 'KeToan']), listReports);
router.post('/api/reports', authMiddleware(['QuanTriVien', 'KeToan']), createReport);
router.get('/api/financial/overview', authMiddleware(['QuanTriVien', 'KeToan']), getFinancialOverview);

// Attendee & Public
router.get('/api/my-tickets', getMyTickets);
router.post('/api/feedback', createFeedback);
router.get('/api/feedback', listFeedbacks);

// AI Services
router.post('/api/ai/generate-notification', authMiddleware(['BanToChuc', 'QuanTriVien']), generateNotification);
router.post('/api/ai/broadcast-notification', authMiddleware(['BanToChuc', 'QuanTriVien']), broadcastNotification);
router.post('/api/ai/summarize-feedback', authMiddleware(['BanToChuc', 'QuanTriVien']), summarizeFeedback);
router.post('/api/ai/chatbot', chatbot);

module.exports = router;
