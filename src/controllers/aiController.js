const db = require('../config/db');

// Helper wrapper for SQLite queries with Promises
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

/**
 * Call Google Gemini API (Interactions API /v1beta/interactions) using native fetch
 */
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      model: model,
      input: prompt,
      generation_config: {
        thinking_level: 'minimal'
      }
    }),
    signal: AbortSignal.timeout(60000)
  });

  const rawData = await res.text();
  let json;
  try {
    json = JSON.parse(rawData);
  } catch (parseErr) {
    throw new Error(`Invalid JSON from Gemini API (${res.status}): ${rawData.slice(0, 200)}`);
  }

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Gemini API HTTP ${res.status}: ${json.error?.message || rawData.slice(0, 200)}`);
  }

  let answer = '';
  if (json.steps && Array.isArray(json.steps)) {
    const modelStep = json.steps.find(s => s.type === 'model_output');
    if (modelStep && modelStep.content && Array.isArray(modelStep.content)) {
      const textItem = modelStep.content.find(c => c.type === 'text' && c.text);
      if (textItem) answer = textItem.text;
    }
  }

  if (!answer && typeof json.output === 'string') {
    answer = json.output;
  }

  return answer || '';
}

function formatNotification(type, message, eventName) {
  const templates = {
    MoiThamDu: `Chào bạn,\n\nBạn được mời tham dự ${eventName}.\n${message}\n\nTrân trọng, Ban tổ chức.`,
    NhaNho: `Nhắc lịch tham dự ${eventName}:\n${message}`,
    CamOn: `Cảm ơn bạn đã tham gia ${eventName}.\n${message}`,
    Khac: `Thông báo từ ${eventName}:\n${message}`
  };

  return templates[type] || templates.Khac;
}

exports.generateNotification = async (req, res) => {
  const { type = 'MoiThamDu', message = 'Thông tin sự kiện sắp tới', eventId } = req.body;

  try {
    const event = await dbGet('SELECT tenSuKien, maSuKien FROM SuKien WHERE id = ?', [eventId || 1]);
    const eventName = event ? event.tenSuKien : 'Sự kiện AI EventHub';
    const eventCode = event ? event.maSuKien : 'EVT';

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        const prompt = `Bạn là trợ lý AI chuyên nghiệp của nền tảng AI EventHub.
Hãy soạn thảo một thông báo sự kiện ngắn gọn, chỉn chu, trang trọng nhưng hấp dẫn.
- Loại thông báo: ${type}
- Tên sự kiện: ${eventName}
- Ghi chú/Nội dung chính từ ban tổ chức: ${message}

Yêu cầu:
- Viết bằng tiếng Việt tự nhiên, trang trọng.
- Có lời chào và lời kết của Ban tổ chức sự kiện.
- Độ dài khoảng 3-5 câu, định dạng rõ ràng, ngắn gọn.`;

        const aiText = await callGemini(prompt);
        if (aiText && aiText.trim()) {
          return res.json({
            title: `${type} - ${eventCode}`,
            content: aiText.trim(),
            eventName: eventName,
            source: 'Gemini-AI'
          });
        }
      } catch (geminiErr) {
        console.warn('[Gemini AI] Notification fallback:', geminiErr.message);
      }
    }

    const generated = formatNotification(type, message, eventName);
    return res.json({
      title: `${type} - ${eventCode}`,
      content: generated,
      eventName: eventName,
      source: 'Template'
    });
  } catch (err) {
    return res.json({
      title: 'Thông báo AI',
      content: formatNotification(type, message, 'sự kiện của bạn'),
      source: 'Template'
    });
  }
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

/**
 * Build rich system prompt that empowers Gemini to answer ALL general questions
 * while seamlessly incorporating comprehensive system and event knowledge.
 */
function buildFullSystemPrompt({ question, events, sessions, speakers, tickets, faqs }) {
  // Format events list
  const eventsList = events && events.length > 0
    ? events.map(e => `- ID: ${e.id} | Mã: ${e.maSuKien} | ${e.tenSuKien} (${e.trangThai}): Từ ${e.ngayBatDau} đến ${e.ngayKetThuc} tại ${e.diaDiem}. Mô tả: ${e.moTa || ''}`).join('\n')
    : 'Chưa có thông tin sự kiện.';

  // Format sessions list
  const sessionsList = sessions && sessions.length > 0
    ? sessions.map(s => `- [${s.tenSuKien || 'Sự kiện #' + s.suKienId}] Phiên: ${s.tenPhien} (${s.ngayGio}, Phòng/Địa điểm: ${s.diaDiem || ''} ${s.phong || ''}): ${s.moTa || ''}`).join('\n')
    : 'Chưa có thông tin phiên.';

  // Format speakers list
  const speakersList = speakers && speakers.length > 0
    ? speakers.map(sp => `- ${sp.tenDienGia} (${sp.chuyenNganh || 'Chuyên gia'}): ${sp.gioiThieu || ''}`).join('\n')
    : 'Chưa có thông tin diễn giả.';

  // Format tickets list
  const ticketsList = tickets && tickets.length > 0
    ? tickets.map(t => `- [${t.tenSuKien || 'Sự kiện #' + t.suKienId}] Hạng vé ${t.tenHangVe}: ${Number(t.gia).toLocaleString('vi-VN')} VNĐ (${t.moTa || ''}) - Trạng thái: ${t.trangThai || 'Còn vé'}`).join('\n')
    : 'Vé được phân phối trực tiếp trên hệ thống.';

  // Format FAQs
  const faqList = faqs && faqs.length > 0
    ? faqs.slice(0, 8).map(f => `Q: ${f.cauHoi}\nA: ${f.cauTraLoi}`).join('\n\n')
    : '';

  return `Bạn là Trợ lý Trí tuệ Nhân tạo thông minh, đa năng và thân thiện, được phát triển trên nền tảng Google Gemini và được tích hợp trực tiếp vào hệ thống Quản lý & Tổ chức Sự kiện "AI EventHub".

PHONG CÁCH VÀ NĂNG LỰC CỦA BẠN:
1. Bạn có đầy đủ năng lực, kiến thức sâu rộng và sự thông minh như Gemini bình thường:
   - Bạn có thể trò chuyện tự nhiên, giải thích mọi kiến thức đời sống, khoa học, lịch sử, văn hóa, lập trình (viết code), dịch thuật, sáng tác (thơ, văn, email), giải toán và tư vấn mọi vấn đề.
   - Bạn KHÔNG bị giới hạn là chỉ được trả lời về sự kiện. Người dùng hỏi bất kỳ chủ đề gì bạn đều có thể trả lời nhiệt tình, thông thái, hữu ích như Gemini tiêu chuẩn.
2. ĐỒNG THỜI, bạn được tích hợp cơ sở dữ liệu và hiểu biết toàn diện về hệ thống "AI EventHub":
   - Khi người dùng hỏi về hệ thống, cách sử dụng các tính năng (đăng ký, đăng nhập, quét vé QR, quản lý sự kiện, các vai trò Admin, Ban tổ chức, Nhân viên, Người tham dự...).
   - Khi người dùng hỏi về bất kỳ sự kiện nào đang có trên hệ thống, lịch trình các phiên họp, danh sách diễn giả, các hạng vé và giá vé...
   - Bạn hãy sử dụng thông tin chi tiết của hệ thống dưới đây để trả lời thật chính xác, cụ thể và cập nhật nhất.

NGUYÊN TẮC TRẢ LỜI:
- Đối với câu hỏi chung không liên quan đến sự kiện/hệ thống (ví dụ: viết thơ, viết code, hỏi kiến thức khoa học, xã hội, hỏi linh tinh): Hãy trả lời tự nhiên, sâu sắc, hữu ích như Gemini bình thường. Tuyệt đối KHÔNG gượng ép lôi sự kiện vào câu trả lời nếu người dùng không hỏi.
- Đối với câu hỏi liên quan đến hệ thống hoặc các sự kiện: Dựa vào DỮ LIỆU HỆ THỐNG để trả lời chi tiết và chính xác.
- Khi người dùng chào hỏi hoặc hỏi bạn là ai: Hãy chào thân thiện, giới thiệu bạn là Trợ lý AI (Gemini) của hệ thống AI EventHub, sẵn sàng giải đáp mọi thắc mắc chung cũng như hỗ trợ thông tin về các sự kiện trên hệ thống.
- Định dạng: Trả lời bằng tiếng Việt (hoặc ngôn ngữ người dùng yêu cầu), sử dụng markdown rõ ràng, ngắt đoạn tự nhiên, in đậm các ý chính và dùng gạch đầu dòng khi liệt kê.

=== DỮ LIỆU HỆ THỐNG "AI EVENTHUB" ĐƯỢC TÍCH HỢP ===
* Tên hệ thống: AI EventHub - Nền tảng quản lý, tổ chức và vận hành sự kiện ứng dụng trí tuệ nhân tạo toàn diện.
* Các vai trò trong hệ thống:
  1. Quản trị viên (Admin / QuanTriVien): Quản lý toàn bộ tài khoản người dùng, phân quyền các vai trò, kích hoạt/khóa tài khoản, xem thống kê hệ thống.
  2. Ban tổ chức (Organizer / BanToChuc): Khởi tạo và quản lý sự kiện, phiên nội dung, diễn giả, phát hành các hạng vé, AI Studio tạo thông báo tự động và phân tích phản hồi.
  3. Nhân viên Check-in (Staff / NhanVienCheckin): Quét mã QR vé trực tiếp qua camera thiết bị hoặc nhập mã vé để xác thực và check-in khách mời tại cổng theo thời gian thực.
  4. Người tham dự (Attendee / NguoiThamDu): Khám phá các sự kiện, xem lịch trình & diễn giả, đăng ký mua vé nhận vé điện tử kèm mã QR, gửi đánh giá phản hồi, trò chuyện với Trợ lý AI.

* Danh sách tất cả sự kiện trong hệ thống:
${eventsList}

* Danh sách các phiên nội dung / lịch trình:
${sessionsList}

* Danh sách diễn giả tiêu biểu:
${speakersList}

* Bảng giá vé các sự kiện:
${ticketsList}

${faqList ? `* Câu hỏi thường gặp FAQ:\n${faqList}\n` : ''}
=== CÂU HỎI CỦA NGƯỜI DÙNG ===
"${question}"`;
}

// Fallback rule-based search if Gemini API is unreachable
function handleLocalFallback(q, events, faqs, res) {
  const directMatch = (faqs || []).find(item => {
    const itemQ = (item.cauHoi || '').toLowerCase();
    return itemQ.includes(q) || q.includes(itemQ);
  });

  if (directMatch) {
    return res.json({ answer: directMatch.cauTraLoi, source: 'FAQ' });
  }

  if (q.includes('sự kiện') || q.includes('hội nghị') || q.includes('event')) {
    const names = (events || []).map(e => `• ${e.tenSuKien} (${e.trangThai}) - ${e.diaDiem}`).join('\n');
    return res.json({
      answer: `Hiện tại hệ thống AI EventHub đang có các sự kiện sau:\n${names}\n\nBạn có thể hỏi chi tiết về bất kỳ sự kiện nào!`,
      source: 'EventsList'
    });
  }

  if (q.includes('vai trò') || q.includes('role') || q.includes('chức năng')) {
    return res.json({
      answer: `Hệ thống AI EventHub hỗ trợ 4 vai trò chính:\n1. Quản trị viên (Admin): Quản trị người dùng & phân quyền\n2. Ban tổ chức: Quản lý sự kiện, lịch trình, diễn giả, vé\n3. Nhân viên Check-in: Quét mã QR xác thực vé tại cổng\n4. Người tham dự: Xem sự kiện, đặt vé, nhận mã QR và tương tác với AI`,
      source: 'SystemInfo'
    });
  }

  return res.json({
    answer: `Xin chào! Tôi là Trợ lý AI của nền tảng AI EventHub. Tôi có thể hỗ trợ bạn tìm hiểu mọi thông tin về sự kiện, lịch trình, diễn giả, giá vé, cũng như giải đáp các câu hỏi kiến thức chung. Bạn cần trợ giúp gì hôm nay?`,
    source: 'Fallback'
  });
}

exports.chatbot = async (req, res) => {
  const { question, eventId } = req.body;
  const q = (question || '').trim();

  if (!q) {
    return res.json({
      answer: 'Xin chào! Tôi là Trợ lý AI của nền tảng AI EventHub (được vận hành bởi Google Gemini). Tôi có thể hỗ trợ gì cho bạn hôm nay?',
      source: 'Default'
    });
  }

  try {
    // Gather all system data asynchronously in parallel
    const [events, sessions, speakers, tickets, faqs] = await Promise.all([
      dbAll('SELECT * FROM SuKien ORDER BY id ASC'),
      dbAll(`
        SELECT p.*, s.tenSuKien 
        FROM PhienNoiDung p 
        LEFT JOIN SuKien s ON p.suKienId = s.id 
        ORDER BY p.id ASC
      `),
      dbAll('SELECT * FROM DienGia ORDER BY id ASC'),
      dbAll(`
        SELECT h.*, s.tenSuKien 
        FROM HangVe h 
        LEFT JOIN SuKien s ON h.suKienId = s.id 
        ORDER BY h.id ASC
      `),
      dbAll('SELECT * FROM CauHoiChatbot ORDER BY id ASC')
    ]);

    // Check if Gemini API is available
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        const prompt = buildFullSystemPrompt({
          question: q,
          events,
          sessions,
          speakers,
          tickets,
          faqs
        });

        const geminiAnswer = await callGemini(prompt);
        if (geminiAnswer && geminiAnswer.trim()) {
          return res.json({
            answer: geminiAnswer.trim(),
            source: 'Gemini-AI',
            model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
          });
        }
      } catch (geminiError) {
        console.warn('[Gemini AI] Chuyển sang fallback FAQ do lỗi gọi API:', geminiError.message);
      }
    }

    // Fallback: rule-based & FAQ
    return handleLocalFallback(q.toLowerCase(), events, faqs, res);
  } catch (error) {
    console.error('[Chatbot Error]', error);
    return res.status(500).json({
      answer: 'Xin lỗi, hệ thống đang gặp sự cố kết nối. Vui lòng thử lại sau giây lát.',
      source: 'Error'
    });
  }
};
