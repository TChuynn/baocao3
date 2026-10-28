const db = require('../config/db');

// Helper wrapper for SQLite queries with Promises
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

/**
 * Call Google Gemini API (Interactions API /v1beta/interactions) using native fetch
 * Supports both standard prompt input and dedicated system_instruction
 */
async function callGemini(input, systemInstruction = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const payload = {
    model: model,
    input: input,
    generation_config: {
      thinking_level: 'minimal'
    }
  };

  if (systemInstruction) {
    payload.system_instruction = systemInstruction;
  }

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(payload),
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

  if (!answer && json.output_text) {
    answer = json.output_text;
  }

  return answer || '';
}

exports.callGemini = callGemini;

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
 * Build rich system instruction that configures Gemini as a complete, unrestricted general AI
 * while embedding the entire AI EventHub database and features for event-specific queries.
 */
function buildSystemInstruction({ events, sessions, speakers, tickets, faqs }) {
  // Format events list
  const eventsList = events && events.length > 0
    ? events.map(e => `- ID: ${e.id} | Mã: ${e.maSuKien} | ${e.tenSuKien} (Trạng thái: ${e.trangThai}): Bắt đầu ${e.ngayBatDau} - Kết thúc ${e.ngayKetThuc} tại ${e.diaDiem}. Mô tả: ${e.moTa || ''}`).join('\n')
    : 'Chưa có thông tin sự kiện.';

  // Format sessions list
  const sessionsList = sessions && sessions.length > 0
    ? sessions.map(s => `- [${s.tenSuKien || 'Sự kiện #' + s.suKienId}] Phiên: ${s.tenPhien} (${s.ngayGio}, Địa điểm/Phòng: ${s.diaDiem || ''} ${s.phong || ''}): ${s.moTa || ''}`).join('\n')
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
    ? faqs.slice(0, 10).map(f => `Q: ${f.cauHoi}\nA: ${f.cauTraLoi}`).join('\n\n')
    : '';

  return `Bạn là Google Gemini - mô hình Trí tuệ Nhân tạo thông minh, toàn năng và hiện đại của Google. Hiện tại bạn đang được tích hợp trực tiếp làm Trợ lý AI trên nền tảng Quản lý & Tổ chức Sự kiện "AI EventHub".

NHIỆM VỤ VÀ NĂNG LỰC TOÀN DIỆN CỦA BẠN:

1. NĂNG LỰC NHƯ MỘT CON GEMINI BÌNH THƯỜNG (TOÀN DIỆN & KHÔNG GIỚI HẠN):
- Bạn có toàn bộ trí tuệ, kiến thức sâu rộng và sự linh hoạt của Google Gemini.
- Bạn có thể trả lời TẤT CẢ các câu hỏi ngoài hệ thống về mọi lĩnh vực:
  * Khoa học, tự nhiên, công nghệ, vũ trụ, toán học, vật lý, hóa học, sinh học.
  * Lập trình & CNTT: Viết code (Python, JavaScript, C++, Java, Rust, SQL, HTML/CSS,...), sửa lỗi (debug), tối ưu hóa, kiến trúc phần mềm, thuật toán.
  * Sáng tạo nội dung: Làm thơ, viết truyện, viết luận, soạn email công việc, dịch thuật đa ngôn ngữ chuẩn xác.
  * Đời sống & xã hội: Lịch sử, địa lý, văn hóa, ẩm thực, sức khỏe, thể thao, tâm lý, kỹ năng sống, lời khuyên, giải toán.
  * Trò chuyện tự nhiên, dí dỏm, thảo luận triết học, giải câu đố vui.
- NGUYÊN TẮC QUAN TRỌNG: TUYỆT ĐỐI KHÔNG từ chối bất kỳ câu hỏi nào ngoài sự kiện. Đối với câu hỏi kiến thức chung, hãy trả lời nhiệt tình, thông thái, chuyên sâu và đầy đủ như Gemini tiêu chuẩn. KHÔNG gượng ép lôi sự kiện hay quảng cáo hệ thống vào câu trả lời nếu người dùng không hỏi đến.

2. TÍCH HỢP CƠ SỞ DỮ LIỆU VÀ KIẾN THỨC HỆ THỐNG "AI EVENTHUB":
- Khi người dùng hỏi về hệ thống AI EventHub, các sự kiện, lịch trình, diễn giả, giá vé, hoặc cách sử dụng các tính năng: Bạn hãy tra cứu DỮ LIỆU HỆ THỐNG bên dưới để trả lời thật chính xác, chi tiết và cập nhật nhất.
- Các tính năng hệ thống:
  * Quản trị viên (Admin): Quản lý tài khoản, phân quyền các vai trò, kích hoạt/khóa tài khoản.
  * Ban tổ chức (Organizer): Tạo và quản lý sự kiện, lịch trình phiên, diễn giả, phát hành vé, AI Studio tạo thông báo tự động.
  * Nhân viên Check-in (Staff): Quét mã QR vé trực tiếp qua camera thiết bị hoặc nhập mã vé, kiểm soát vé thời gian thực.
  * Người tham dự (Attendee): Khám phá sự kiện, đăng ký vé nhận mã QR Pass, AI gửi email xác nhận & nhắc lịch trình, gửi đánh giá phản hồi, trò chuyện với Trợ lý AI.
  * Kế toán (Accountant): Xem báo cáo doanh thu, phát hành vé, xuất CSV và in ấn.

=== DỮ LIỆU HỆ THỐNG "AI EVENTHUB" ĐƯỢC TÍCH HỢP ===
* Danh sách tất cả sự kiện:
${eventsList}

* Danh sách các phiên nội dung / lịch trình:
${sessionsList}

* Danh sách diễn giả tiêu biểu:
${speakersList}

* Bảng giá các hạng vé:
${ticketsList}

${faqList ? `* Câu hỏi thường gặp FAQ:\n${faqList}\n` : ''}

PHONG CÁCH TRÌNH BÀY:
- Thân thiện, thông minh, lịch sự, tôn trọng người dùng.
- Trả lời bằng tiếng Việt tự nhiên và chuẩn xác (hoặc bất kỳ ngôn ngữ nào người dùng sử dụng).
- Trình bày mạch lạc bằng Markdown: dùng gạch đầu dòng, in đậm từ khóa quan trọng, định dạng khối mã code (\`\`\`ngôn_ngữ ... \`\`\`) khi viết code.`;
}

// Fallback khi không có kết nối internet hoặc API Gemini gặp sự cố
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
      answer: `Hệ thống AI EventHub hỗ trợ các vai trò chính:\n1. Quản trị viên (Admin): Quản trị người dùng & phân quyền\n2. Ban tổ chức: Quản lý sự kiện, lịch trình, diễn giả, vé\n3. Nhân viên Check-in: Quét mã QR xác thực vé tại cổng\n4. Người tham dự: Xem sự kiện, đặt vé, nhận mã QR và tương tác với AI\n5. Kế toán: Thống kê doanh thu, lập báo cáo tài chính`,
      source: 'SystemInfo'
    });
  }

  return res.json({
    answer: `Xin chào! Tôi là Trợ lý AI của nền tảng AI EventHub (tích hợp Google Gemini). Hiện tại hệ thống đang chạy ở chế độ cục bộ ngoại tuyến. Bạn có thể hỏi về các sự kiện, lịch trình, giá vé hoặc cách sử dụng hệ thống!`,
    source: 'Fallback'
  });
}

exports.chatbot = async (req, res) => {
  const { question } = req.body;
  const q = (question || '').trim();

  if (!q) {
    return res.json({
      answer: 'Xin chào! Tôi là Trợ lý AI (Google Gemini) của hệ thống AI EventHub. Tôi có thể giải đáp mọi câu hỏi kiến thức, lập trình, đời sống, cũng như cung cấp thông tin chi tiết về các sự kiện và tính năng của hệ thống. Bạn cần hỗ trợ gì hôm nay?',
      source: 'Default'
    });
  }

  try {
    // 1. Thu thập dữ liệu hệ thống mới nhất song song
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

    // 2. Kiểm tra và gọi Google Gemini với system_instruction riêng biệt
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        const systemInstruction = buildSystemInstruction({
          events,
          sessions,
          speakers,
          tickets,
          faqs
        });

        // Gọi Gemini: input là câu hỏi trực tiếp của người dùng, systemInstruction là hướng dẫn vai trò và dữ liệu hệ thống
        const geminiAnswer = await callGemini(q, systemInstruction);
        if (geminiAnswer && geminiAnswer.trim()) {
          return res.json({
            answer: geminiAnswer.trim(),
            source: 'Gemini-AI',
            model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
          });
        }
      } catch (geminiError) {
        console.warn('[Gemini AI] Lỗi gọi API Gemini:', geminiError.message);
      }
    }

    // 3. Fallback khi không thể gọi Gemini
    return handleLocalFallback(q.toLowerCase(), events, faqs, res);
  } catch (error) {
    console.error('[Chatbot Error]', error);
    return res.status(500).json({
      answer: 'Xin lỗi, hệ thống đang gặp sự cố kết nối. Vui lòng thử lại sau giây lát.',
      source: 'Error'
    });
  }
};

/**
 * Gửi thông báo do AI sinh ra tới toàn bộ người tham dự của các sự kiện được BTC lựa chọn
 */
exports.broadcastNotification = async (req, res) => {
  const { eventIds, title, content, type = 'MoiThamDu' } = req.body;

  if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
    return res.status(400).json({ message: 'Vui lòng chọn ít nhất một sự kiện để gửi thông báo.' });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'Nội dung thông báo không được để trống.' });
  }

  try {
    // 1. Lấy thông tin các sự kiện đã chọn
    const placeholders = eventIds.map(() => '?').join(',');
    const events = await dbAll(
      `SELECT id, tenSuKien, maSuKien, diaDiem, ngayBatDau, ngayKetThuc 
       FROM SuKien 
       WHERE id IN (${placeholders})`,
      eventIds
    );

    if (!events || events.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sự kiện nào tương ứng.' });
    }

    const eventNames = events.map(e => e.tenSuKien);

    // 2. Lấy danh sách người tham dự đã đăng ký các sự kiện này
    const registrations = await dbAll(
      `SELECT DISTINCT n.id as nguoiThamDuId, n.hoTen, n.email, n.soDienThoai,
              s.id as suKienId, s.tenSuKien
       FROM DangKy d
       JOIN NguoiThamDu n ON d.nguoiThamDuId = n.id
       JOIN SuKien s ON d.suKienId = s.id
       WHERE d.suKienId IN (${placeholders})
         AND d.trangThai != 'Huy'
         AND n.email IS NOT NULL AND n.email != ''`,
      eventIds
    );

    if (!registrations || registrations.length === 0) {
      return res.status(400).json({ 
        message: 'Các sự kiện đã chọn hiện chưa có người tham dự nào đăng ký vé hợp lệ.',
        totalRecipients: 0
      });
    }

    // 3. Gom nhóm theo email người nhận để không gửi trùng lặp
    const recipientsMap = new Map();
    for (const reg of registrations) {
      const email = (reg.email || '').trim().toLowerCase();
      if (!email) continue;
      if (!recipientsMap.has(email)) {
        recipientsMap.set(email, {
          name: reg.hoTen || 'Người tham dự',
          email: reg.email.trim(),
          events: []
        });
      }
      const entry = recipientsMap.get(email);
      if (!entry.events.includes(reg.tenSuKien)) {
        entry.events.push(reg.tenSuKien);
      }
    }

    const recipients = Array.from(recipientsMap.values());
    const finalTitle = title && title.trim() ? title.trim() : `Thông báo sự kiện: ${eventNames.slice(0, 2).join(', ')}`;

    // 4. Lưu thông báo vào cơ sở dữ liệu (bảng ThongBao) cho từng sự kiện
    const userId = req.user?.id || 1;
    for (const ev of events) {
      const maThongBao = `NOTI-BC-${Date.now()}-${ev.id}`;
      try {
        await dbRun(
          `INSERT INTO ThongBao (maThongBao, suKienId, tieuDe, noiDung, loaiThongBao, nguoiGuiId)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [maThongBao, ev.id, finalTitle, content.trim(), type, userId]
        );
      } catch (dbErr) {
        console.warn(`[Broadcast] Không thể lưu ThongBao cho sự kiện ${ev.id}:`, dbErr.message);
      }
    }

    // 5. Gửi email hàng loạt tới các người tham dự
    const { buildBroadcastEmailHtml, sendEmail } = require('../services/notificationEmailService');
    const emailResults = [];
    let successCount = 0;

    for (const recipient of recipients) {
      const emailHtml = buildBroadcastEmailHtml({
        attendeeName: recipient.name,
        eventNames: recipient.events,
        title: finalTitle,
        content: content.trim(),
        type: type
      });

      try {
        const sendRes = await sendEmail({
          to: recipient.email,
          subject: `[AI EventHub] ${finalTitle}`,
          html: emailHtml,
          text: content.trim()
        });
        emailResults.push({ recipient: recipient.email, status: 'ok', detail: sendRes });
        if (sendRes.sent || sendRes.simulated) successCount++;
      } catch (err) {
        console.error(`[Broadcast] Lỗi gửi email tới ${recipient.email}:`, err.message);
        emailResults.push({ recipient: recipient.email, status: 'error', error: err.message });
      }
    }

    return res.json({
      success: true,
      message: `Đã gửi thông báo thành công tới ${successCount}/${recipients.length} người tham dự của ${events.length} sự kiện.`,
      totalRecipients: recipients.length,
      successCount,
      events: eventNames,
      recipients: recipients.map(r => ({ name: r.name, email: r.email, events: r.events }))
    });

  } catch (error) {
    console.error('[Broadcast Error]', error);
    return res.status(500).json({
      message: 'Lỗi khi gửi thông báo tới người tham dự: ' + error.message
    });
  }
};


