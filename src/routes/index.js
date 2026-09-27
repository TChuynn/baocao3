const express = require('express');
const { login, register, getProfile, listAccounts, createAccount, updateAccountRole } = require('../controllers/authController');
const { listEvents, getEventById, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');
const { generateNotification, summarizeFeedback, chatbot } = require('../controllers/aiController');
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
  listReports
} = require('../controllers/managementController');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.post('/api/auth/login', login);
router.post('/api/auth/register', register);
router.get('/api/accounts', authMiddleware(['QuanTriVien']), listAccounts);
router.post('/api/accounts', authMiddleware(['QuanTriVien']), createAccount);
router.put('/api/accounts/:id/role', authMiddleware(['QuanTriVien']), updateAccountRole);
router.get('/api/auth/profile', authMiddleware(['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn', 'NguoiThamDu']), getProfile);

router.get('/api/dashboard/summary', authMiddleware(['QuanTriVien', 'BanToChuc']), getDashboardSummary);
router.get('/api/events', listEvents);
router.get('/api/events/:id', getEventById);
router.post('/api/events', authMiddleware(['BanToChuc']), createEvent);
router.put('/api/events/:id', authMiddleware(['BanToChuc']), updateEvent);
router.delete('/api/events/:id', authMiddleware(['BanToChuc']), deleteEvent);

router.get('/api/sessions', listSessions);
router.post('/api/sessions', authMiddleware(['BanToChuc']), createSession);

router.get('/api/speakers', listSpeakers);
router.post('/api/speakers', authMiddleware(['BanToChuc']), createSpeaker);

router.get('/api/tickets', listTickets);
router.post('/api/tickets', authMiddleware(['BanToChuc', 'QuanTriVien']), createTicket);

router.post('/api/registrations', registerGuest);
router.get('/api/registrations', authMiddleware(['QuanTriVien', 'BanToChuc', 'NhanVienCheckIn']), listRegistrations);
router.post('/api/checkin', authMiddleware(['NhanVienCheckIn', 'BanToChuc', 'QuanTriVien']), checkinTicket);
router.get('/api/reports', authMiddleware(['QuanTriVien', 'BanToChuc']), listReports);

router.post('/api/ai/generate-notification', authMiddleware(['BanToChuc']), generateNotification);
router.post('/api/ai/summarize-feedback', authMiddleware(['BanToChuc', 'QuanTriVien']), summarizeFeedback);
router.post('/api/ai/chatbot', chatbot);

module.exports = router;
