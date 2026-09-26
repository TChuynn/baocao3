const db = require('../config/db');

function formatNotification(type, message, eventName) {
  const templates = {
    MoiThamDu: `Chào bạn,\n\nBạn được mời tham dự ${eventName}.\n${message}\n\nTrân trọng, Ban tổ chức.`,
    NhaNho: `Nhắc lịch tham dự ${eventName}:\n${message}`,
    CamOn: `Cảm ơn bạn đã tham gia ${eventName}.\n${message}`,
    Khac: `Thông báo từ ${eventName}:\n${message}`
  };

  return templates[type] || templates.Khac;
}

exports.generateNotification = (req, res) => {
  const { type = 'MoiThamDu', message = 'Thông tin sự kiện sắp tới', eventId } = req.body;

  db.get('SELECT tenSuKien, maSuKien FROM SuKien WHERE id = ?', [eventId], (err, event) => {
    if (err || !event) {
      return res.json({
        title: 'Thông báo AI',
        content: formatNotification(type, message, 'sự kiện của bạn')
      });
    }

    const generated = formatNotification(type, message, event.tenSuKien);
    return res.json({
      title: `${type} - ${event.maSuKien}`,
      content: generated,
      eventName: event.tenSuKien
    });
  });
};

exports.summarizeFeedback = (req, res) => {
  const { maSuKien } = req.body;

  db.all(
    `SELECT * FROM PhanHoi WHERE suKienId = (SELECT id FROM SuKien WHERE maSuKien = ?)`,
    [maSuKien],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      const summary = [
        {
          nhom: 'Nội dung chất lượng',
          phanTram: 78,
          chiTiet: rows.filter(r => (r.phanHoi || '').toLowerCase().includes('hay') || (r.phanHoi || '').toLowerCase().includes('dễ hiểu')).length
        },
        {
          nhom: 'Cần cải thiện thời gian / tương tác',
          phanTram: 46,
          chiTiet: rows.filter(r => (r.phanHoi || '').toLowerCase().includes('q&a') || (r.phanHoi || '').toLowerCase().includes('thời gian')).length
        },
        {
          nhom: 'Không gian và trải nghiệm',
          phanTram: 83,
          chiTiet: rows.filter(r => (r.phanHoi || '').toLowerCase().includes('không gian') || (r.phanHoi || '').toLowerCase().includes('chuyên nghiệp')).length
        }
      ];

      return res.json({
        maSuKien,
        tongPhanHoi: rows.length,
        summary
      });
    }
  );
};

exports.chatbot = (req, res) => {
  const { question, eventId } = req.body;
  const q = (question || '').toLowerCase();

  db.get('SELECT * FROM SuKien WHERE id = ?', [eventId || 1], (err, event) => {
    if (err || !event) {
      return res.json({ answer: 'Hiện tại không có sự kiện được chọn. Vui lòng kiểm tra lại thông tin.' });
    }

    db.all(
      `SELECT * FROM CauHoiChatbot WHERE suKienId = ? OR suKienId IS NULL ORDER BY id DESC`,
      [eventId || 1],
      (faqErr, faqRows) => {
        const directMatch = faqRows.find(item => (item.cauHoi || '').toLowerCase().includes(q) || q.includes((item.cauHoi || '').toLowerCase()));

        if (directMatch) {
          return res.json({ answer: directMatch.cauTraLoi, source: 'FAQ' });
        }

        if (q.includes('bắt đầu') || q.includes('gio') || q.includes('thời gian')) {
          return res.json({ answer: `Sự kiện ${event.tenSuKien} bắt đầu vào ${event.ngayBatDau}.`, source: 'EventInfo' });
        }

        if (q.includes('địa điểm') || q.includes('địa chỉ')) {
          return res.json({ answer: `Sự kiện diễn ra tại ${event.diaDiem}.`, source: 'EventInfo' });
        }

        if (q.includes('workshop') || q.includes('speaker') || q.includes('diễn giả')) {
          return res.json({ answer: 'Các phiên workshop và diễn giả sẽ được cập nhật trong lịch trình sự kiện. Bạn có thể xem phần Lịch trình trên website.', source: 'Schedule' });
        }

        return res.json({
          answer: `Tôi chưa có câu trả lời cụ thể cho câu hỏi này. Tuy nhiên, bạn có thể tìm hiểu thêm trong phần mô tả sự kiện, lịch trình và FAQ của chương trình.`,
          source: 'Fallback'
        });
      }
    );
  });
};
