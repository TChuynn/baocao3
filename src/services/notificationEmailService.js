const nodemailer = require('nodemailer');
const db = require('../config/db');
const { callGemini } = require('../controllers/aiController');

// Helper wrapper for SQLite queries with Promises
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

/**
 * Format datetime to Vietnamese readable string
 */
function formatVnDateTime(dateTimeStr) {
  if (!dateTimeStr) return 'Sắp thông báo';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    return dateTimeStr;
  }
}

/**
 * AI tự động soạn thảo nội dung xác nhận đăng ký và nhắc lịch trình sự kiện
 */
async function generateRegistrationNotice({ guestName, guestEmail, guestPhone, event, ticketTier, maDangKy, qrCode }) {
  const startTime = formatVnDateTime(event.ngayBatDau);
  const endTime = formatVnDateTime(event.ngayKetThuc);
  const venue = event.diaDiem || 'Địa điểm thông báo sau';
  const tierName = ticketTier?.tenHangVe || 'Standard';
  const tierPrice = Number(ticketTier?.gia || 0).toLocaleString('vi-VN') + ' đ';

  const defaultNotice = `Kính gửi anh/chị ${guestName},

Ban tổ chức AI EventHub xin trân trọng chúc mừng anh/chị đã đăng ký thành công vé tham dự sự kiện "${event.tenSuKien}".

THÔNG TIN VÉ & ĐĂNG KÝ:
- Mã đăng ký: ${maDangKy}
- Hạng vé: ${tierName} (${tierPrice})
- Mã Check-in QR: ${qrCode}

LỊCH TRÌNH VÀ ĐỊA ĐIỂM SỰ KIỆN:
- Thời gian bắt đầu: ${startTime}
- Thời gian kết thúc: ${endTime}
- Địa điểm tổ chức: ${venue}

LƯU Ý QUAN TRỌNG KHI THAM DỰ:
1. Quý khách vui lòng có mặt trước giờ khai mạc 15-30 phút để làm thủ tục check-in nhận thẻ đeo thuận lợi.
2. Vui lòng xuất trình mã QR Check-in (${qrCode}) hoặc mã đăng ký trên điện thoại tại bàn lễ tân để nhân viên quét mã.
3. Trang phục lịch sự, chuyên nghiệp phù hợp với không khí sự kiện.

Ban tổ chức rất hân hạnh được đón tiếp anh/chị tại sự kiện!

Trân trọng,
Ban tổ chức AI EventHub`;

  try {
    const prompt = `Bạn là trợ lý AI chuyên nghiệp của nền tảng quản lý sự kiện AI EventHub.
Khách hàng "${guestName}" vừa đăng ký thành công vé tham dự sự kiện "${event.tenSuKien}".
Hãy soạn một bức thư thông báo xác nhận đăng ký thành công và nhắc lịch trình sự kiện thật chỉn chu, trang trọng, ấm áp và chuyên nghiệp.

Dữ liệu sự kiện:
- Người nhận: ${guestName} (Email: ${guestEmail})
- Tên sự kiện: ${event.tenSuKien}
- Thời gian: Từ ${startTime} đến ${endTime}
- Địa điểm: ${venue}
- Hạng vé: ${tierName} (Giá: ${tierPrice})
- Mã đăng ký: ${maDangKy}
- Mã check-in QR: ${qrCode}

Yêu cầu nội dung:
1. Lời chúc mừng nồng nhiệt và cảm ơn khách hàng đã đăng ký tham gia sự kiện.
2. Xác nhận chi tiết mã vé, hạng vé và quyền lợi tham gia.
3. Nhắc nhở rõ ràng về lịch trình (thời gian bắt đầu, kết thúc, địa điểm), khuyên nên đến trước 20 phút để check-in.
4. Hướng dẫn check-in bằng mã QR Check-in (${qrCode}) tại quầy tiếp đón.
5. Lời chúc trải nghiệm sự kiện tuyệt vời và chữ ký đại diện Ban tổ chức sự kiện AI EventHub.
6. Viết bằng tiếng Việt tự nhiên, ngắt dòng thành các đoạn và mục rõ ràng, chuyên nghiệp.`;

    const aiText = await callGemini(prompt);
    if (aiText && aiText.trim()) {
      return {
        content: aiText.trim(),
        source: 'Gemini-AI'
      };
    }
  } catch (err) {
    console.warn('[AI Notification Service] Gemini fallback used:', err.message);
  }

  return {
    content: defaultNotice,
    source: 'Template-Smart'
  };
}

/**
 * Xây dựng giao diện HTML email cao cấp, hỗ trợ hiển thị mã QR trực tiếp
 */
function buildEmailHtml({ guestName, event, ticketTier, maDangKy, qrCode, aiContent }) {
  const startTime = formatVnDateTime(event.ngayBatDau);
  const endTime = formatVnDateTime(event.ngayKetThuc);
  const venue = event.diaDiem || 'Địa điểm thông báo sau';
  const tierName = ticketTier?.tenHangVe || 'Standard';
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrCode)}`;

  const formattedAiHtml = aiContent
    .split('\n\n')
    .map(p => `<p style="margin: 0 0 12px 0; line-height: 1.6; color: #334155;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận đăng ký & Nhắc lịch: ${event.tenSuKien}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 32px 30px; text-align: center;">
              <div style="display: inline-block; padding: 6px 14px; background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(165, 180, 252, 0.3); border-radius: 20px; color: #c7d2fe; font-size: 13px; font-weight: 600; margin-bottom: 12px;">
                ✨ AI EVENTHUB CONFIRMATION
              </div>
              <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                Đăng ký vé thành công!
              </h1>
              <p style="margin: 0; color: #e0e7ff; font-size: 16px; font-weight: 500;">
                ${event.tenSuKien}
              </p>
            </td>
          </tr>

          <!-- Ticket & QR Code Card -->
          <tr>
            <td style="padding: 24px 30px 10px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px;">
                <tr>
                  <td width="60%" style="vertical-align: top; padding-right: 15px;">
                    <div style="font-size: 12px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px;">THÔNG TIN THAM DỰ</div>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">${guestName}</div>
                    
                    <div style="margin-top: 14px; font-size: 13px; color: #64748b;">
                      <div><strong>Hạng vé:</strong> <span style="display: inline-block; padding: 2px 8px; background: #e0e7ff; color: #4338ca; border-radius: 4px; font-weight: 600;">${tierName}</span></div>
                      <div style="margin-top: 6px;"><strong>Mã đăng ký:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #0f172a; font-weight: 600;">${maDangKy}</code></div>
                      <div style="margin-top: 6px;"><strong>Mã QR Check-in:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #4338ca; font-weight: 600;">${qrCode}</code></div>
                    </div>
                  </td>
                  <td width="40%" align="center" style="vertical-align: middle; border-left: 1px solid #e2e8f0; padding-left: 15px;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 600;">MÃ CHECK-IN</div>
                    <img src="${qrImageUrl}" alt="Check-in QR" width="130" height="130" style="display: block; border-radius: 8px; border: 1px solid #cbd5e1;" />
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Xuất trình khi đến quầy</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Event Schedule & Location Card -->
          <tr>
            <td style="padding: 10px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px;">
                <tr>
                  <td>
                    <div style="font-size: 14px; color: #1e3a8a; font-weight: 700; margin-bottom: 8px;">
                      📅 LỊCH TRÌNH & ĐỊA ĐIỂM TỔ CHỨC
                    </div>
                    <div style="font-size: 13px; color: #1e40af; line-height: 1.6;">
                      <div><strong>Bắt đầu:</strong> ${startTime}</div>
                      <div><strong>Kết thúc:</strong> ${endTime}</div>
                      <div><strong>Địa điểm:</strong> ${venue}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- AI Personalized Message -->
          <tr>
            <td style="padding: 20px 30px;">
              <div style="display: inline-block; padding: 4px 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; color: #065f46; font-size: 12px; font-weight: 600; margin-bottom: 12px;">
                🤖 Thông điệp cá nhân hóa từ Trợ lý AI EventHub
              </div>
              <div style="background: #fafafa; border: 1px solid #f1f5f9; border-radius: 10px; padding: 20px; font-size: 14px;">
                ${formattedAiHtml}
              </div>
            </td>
          </tr>

          <!-- Reminders & Tips -->
          <tr>
            <td style="padding: 0 30px 24px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px;">
                <tr>
                  <td style="font-size: 12px; color: #92400e; line-height: 1.5;">
                    <strong>💡 Lời khuyên cho bạn:</strong> Hãy lưu ảnh mã QR hoặc chụp màn hình email này trước khi khởi hành để check-in nhanh nhất mà không cần kết nối mạng tại sự kiện.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6;">
              <div>Đây là email tự động được tạo bởi <strong>AI EventHub Platform</strong>.</div>
              <div style="margin-top: 4px;">Mọi thắc mắc xin vui lòng liên hệ Ban tổ chức qua cổng thông tin sự kiện.</div>
              <div style="margin-top: 8px; color: #94a3b8;">© 2025 AI EventHub. All rights reserved.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Xây dựng giao diện HTML email thông báo từ Ban tổ chức (AI Studio) gửi tới Người tham dự
 */
function buildBroadcastEmailHtml({ attendeeName, eventNames, title, content, type }) {
  const typeLabels = {
    MoiThamDu: 'Thư mời tham dự chính thức',
    NhaNho: 'Nhắc nhở lịch trình & Chuẩn bị',
    CamOn: 'Thư cảm ơn từ Ban tổ chức',
    Khac: 'Thông báo sự kiện'
  };
  const typeBadge = typeLabels[type] || 'Thông báo từ Ban tổ chức';
  const eventsDisplay = Array.isArray(eventNames) && eventNames.length > 0 
    ? eventNames.join(' • ') 
    : 'Sự kiện AI EventHub';

  const formattedAiHtml = (content || '')
    .split('\n\n')
    .map(p => `<p style="margin: 0 0 14px 0; line-height: 1.68; color: #334155;">${p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Thông báo từ Ban tổ chức'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #4338ca 100%); padding: 32px 30px; text-align: center;">
              <div style="display: inline-block; padding: 6px 14px; background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(165, 180, 252, 0.3); border-radius: 20px; color: #c7d2fe; font-size: 13px; font-weight: 600; margin-bottom: 12px;">
                📢 ${typeBadge}
              </div>
              <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 22px; font-weight: 700; line-height: 1.35;">
                ${title || 'Thông báo từ Ban tổ chức'}
              </h1>
              <p style="margin: 0; color: #e0e7ff; font-size: 14.5px; font-weight: 500;">
                🎯 ${eventsDisplay}
              </p>
            </td>
          </tr>

          <!-- Recipient Greeting Card -->
          <tr>
            <td style="padding: 24px 30px 10px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-left: 4px solid #6366f1; border-radius: 8px; padding: 14px 18px;">
                <tr>
                  <td>
                    <div style="font-size: 12.5px; color: #64748b;">Kính gửi người tham dự:</div>
                    <div style="font-size: 17px; font-weight: 700; color: #0f172a; margin-top: 3px;">
                      ${attendeeName || 'Quý khách'}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Notification Content (Generated by AI) -->
          <tr>
            <td style="padding: 15px 30px 20px 30px;">
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px 24px; font-size: 14.5px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);">
                ${formattedAiHtml}
              </div>
            </td>
          </tr>

          <!-- Events Included Notice -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px;">
                <tr>
                  <td style="font-size: 12.5px; color: #1e40af; line-height: 1.5;">
                    <strong>ℹ️ Thông tin gửi từ sự kiện:</strong> ${eventsDisplay}.<br/>
                    Bạn nhận được thông báo này do đã đăng ký vé tham dự sự kiện trên nền tảng AI EventHub.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6;">
              <div>Thông báo được khởi tạo và gửi bởi <strong>Ban tổ chức qua AI Studio (AI EventHub)</strong>.</div>
              <div style="margin-top: 4px;">Chúc bạn có những trải nghiệm tuyệt vời cùng sự kiện!</div>
              <div style="margin-top: 8px; color: #94a3b8;">© 2025 AI EventHub. All rights reserved.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Gửi email qua SMTP (nodemailer)
 */
async function sendEmail({ to, subject, html, text }) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass || pass === 'your_app_password_here') {
    console.log(`[Email Service - Mô phỏng] 📨 Đã chuẩn bị email gửi tới: ${to}`);
    console.log(`[Email Service - Mô phỏng] 📌 Tiêu đề: ${subject}`);
    console.log(`[Email Service - Hướng dẫn] Để gửi email thực tế vào hộp thư Gmail, vui lòng điền SMTP_USER và SMTP_PASS (Mật khẩu ứng dụng 16 ký tự) trong file .env.`);
    return {
      sent: false,
      simulated: true,
      message: 'SMTP chưa được cấu hình. Hệ thống đã lưu thông báo AI và mô phỏng gửi thành công.',
      recipient: to
    };
  }

  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: user,
      pass: pass
    }
  });

  const fromAddress = process.env.SMTP_FROM || `"AI EventHub" <${user}>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to: to,
    subject: subject,
    text: text,
    html: html
  });

  console.log(`[Email Service] ✅ Đã gửi email thực tế thành công tới: ${to} (MessageId: ${info.messageId})`);
  return {
    sent: true,
    simulated: false,
    messageId: info.messageId,
    recipient: to
  };
}

/**
 * Điều phối toàn bộ quy trình: AI sinh thông báo -> Lưu DB ThongBao -> Gửi email xác nhận & nhắc lịch
 */
async function processRegistrationNotificationAndEmail({ guest, event, ticketTier, maDangKy, qrCode }) {
  try {
    // 1. AI sinh nội dung thông báo
    const aiResult = await generateRegistrationNotice({
      guestName: guest.hoTen,
      guestEmail: guest.email,
      guestPhone: guest.soDienThoai,
      event,
      ticketTier,
      maDangKy,
      qrCode
    });

    const title = `Xác nhận vé & Nhắc lịch: ${event.tenSuKien}`;
    const subject = `[AI EventHub] Xác nhận vé thành công & Nhắc lịch trình: ${event.tenSuKien}`;

    // 2. Lưu vào bảng ThongBao của database
    const maThongBao = `NOTI-REG-${Date.now()}`;
    try {
      await dbRun(
        `INSERT INTO ThongBao (maThongBao, suKienId, tieuDe, noiDung, loaiThongBao, nguoiGuiId)
         VALUES (?, ?, ?, ?, 'MoiThamDu', 1)`,
        [maThongBao, event.id, title, aiResult.content]
      );
    } catch (dbErr) {
      console.warn('[AI Notification Service] Không thể lưu bảng ThongBao:', dbErr.message);
    }

    // 3. Xây dựng nội dung HTML email và gửi
    const html = buildEmailHtml({
      guestName: guest.hoTen,
      event,
      ticketTier,
      maDangKy,
      qrCode,
      aiContent: aiResult.content
    });

    let emailResult = { sent: false, simulated: true };
    try {
      emailResult = await sendEmail({
        to: guest.email,
        subject: subject,
        html: html,
        text: aiResult.content
      });
    } catch (emailErr) {
      console.error('[AI Notification Service] Lỗi khi gửi email:', emailErr.message);
      emailResult = {
        sent: false,
        error: emailErr.message,
        recipient: guest.email
      };
    }

    return {
      success: true,
      title,
      aiContent: aiResult.content,
      aiSource: aiResult.source,
      emailResult
    };
  } catch (error) {
    console.error('[AI Notification Service] Lỗi quy trình thông báo:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateRegistrationNotice,
  buildEmailHtml,
  buildBroadcastEmailHtml,
  sendEmail,
  processRegistrationNotificationAndEmail
};
