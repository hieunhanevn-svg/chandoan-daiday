// ================================================================
// AI VISION — So sánh giản đồ thực tế với ảnh 6 TH mẫu
// Claude nhận 2 ảnh: (1) giản đồ hiện tại + (2) bảng 6 TH tham chiếu
// ================================================================

import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích giản đồ vector điện kế 3 pha gián tiếp.

BẠN SẼ NHẬN ĐƯỢC 2 HÌNH ẢNH:
- Hình 1: Giản đồ vector THỰC TẾ của điện kế đang kiểm tra
- Hình 2: Bảng tham chiếu 6 trường hợp lỗi (mẫu chuẩn để so sánh)

NHIỆM VỤ:
So sánh trực quan Hình 1 với từng trường hợp trong Hình 2, xác định
hình dáng nào giống nhất, kết hợp với số liệu thuật toán để đưa ra nhận xét.

QUY TẮC BẮT BUỘC:
1. Thuật toán Naive Bayes đã tính Top 3 — chỉ đề xuất trong phạm vi đó
2. CÓ THỂ điều chỉnh thứ tự ưu tiên nếu hình ảnh cho thấy khác
3. KHÔNG được đề xuất TH nằm ngoài Top 3
4. Nếu hình ảnh mâu thuẫn số liệu → cảnh báo KTV kiểm tra lại đầu vào

KIẾN THỨC ĐỌC GIẢN ĐỒ:
Màu: Đỏ=Pha A, Vàng=Pha B, Xanh=Pha C
Nét LIỀN dày = U (điện áp) — vị trí chuẩn: Ua lên (~90°), Ub phải dưới (~-30°), Uc trái dưới (~-150°)
Nét ĐỨT mảnh = I (dòng điện)

So sánh với bảng mẫu trong Hình 2:
- Bình thường: I trễ sau U cùng màu góc nhỏ, hình đối xứng đẹp
- TH1: Thiếu hẳn 1 nét đứt (I=0 một pha)
- TH2: Đúng 1 nét đứt nằm PHÍA ĐỐI DIỆN U cùng màu (góc >90°)
- TH3: Đúng 2 nét đứt phía đối diện U tương ứng
- TH4: Cả 3 nét đứt đều phía đối diện U
- TH5: 1 nét đứt ở vị trí pha KHÁC (lệch ~120° bất thường), P≈0
- TH6: Giống TH1 về tỷ lệ P nhưng KHÔNG thiếu nét đứt, có 2 nét đứt sai chiều

PHÂN BIỆT TH1 vs TH6 (đều P≈2/3 — dễ nhầm nhất):
- TH1: Trong Hình 1 thấy thiếu hẳn 1 nét đứt (pha đó I=0)
- TH6: Trong Hình 1 đủ 3 nét đứt nhưng 2 cái nằm sai chiều so với U cùng màu

CẤU TRÚC TRẢ LỜI:

🔍 SO SÁNH VỚI BẢNG MẪU:
[Mô tả: Hình 1 trông giống nhất với mẫu nào trong Hình 2? Điểm giống và khác?]

🤖 ĐÁNH GIÁ AI:
[Dựa trên so sánh hình ảnh, trong Top 3 thuật toán đã cho, AI nhận xét:
 đồng ý Hạng 1, hay thấy Hạng 2/3 phù hợp hơn về mặt hình ảnh?]

📋 KẾT LUẬN:
["AI xác nhận [TH]" HOẶC "AI thấy [TH khác trong Top3] phù hợp hơn về hình ảnh"]

Nếu phát hiện bất thường:
⚠️ LƯU Ý: [Nêu cụ thể]

Tối đa 130 chữ. Tiếng Việt. Ngắn gọn, thực tế cho KTV hiện trường.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key chưa cấu hình' });

  const { imageBase64, diagnosisTop3, metrics, rawData } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Thiếu ảnh giản đồ' });

  // Đọc ảnh tham chiếu 6 TH từ public/
  let refBase64 = '';
  try {
    const refPath = path.join(process.cwd(), 'public', 'reference_6cases.png');
    const refBuffer = fs.readFileSync(refPath);
    refBase64 = refBuffer.toString('base64');
  } catch (e) {
    console.log('Không đọc được ảnh tham chiếu:', e.message);
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const top3 = diagnosisTop3 || [];
  const m = metrics || {};
  const d = rawData || {};

  const userMsg = `THUẬT TOÁN ĐÃ XÁC ĐỊNH TOP 3:
Hạng 1: ${top3[0]?.name || '—'}
Hạng 2: ${top3[1]?.name || '—'}
Hạng 3: ${top3[2]?.name || '—'}
(Chỉ được đề xuất trong phạm vi 3 trường hợp trên)

SỐ LIỆU TÍNH TOÁN:
- phiA=${d.phiA}°, phiB=${d.phiB}°, phiC=${d.phiC}° (Gốc ${d.phiMode}°)
- P_ratio = ${m.P_ratio} (≈+1: đúng | ≈+0.33: TH2 | ≈0: TH5 | âm: đảo nhiều CT)
- Số pha bị đảo = ${m.numFlipped}
- has120offset = ${m.has120}
${m.hasPabc
  ? `- ratioA=${m.ratioA} | ratioB=${m.ratioB} | ratioC=${m.ratioC}
  (≈+1: đúng chiều | ≈-1: CT đảo | ≈0: mất tín hiệu)`
  : '- Không có Pa/Pb/Pc từng pha'}

Hình 1 là giản đồ THỰC TẾ. Hình 2 là bảng 6 TH mẫu để so sánh.
Hãy so sánh trực quan và đưa ra nhận xét.`;

  // Xây dựng content — 2 ảnh nếu có ảnh tham chiếu, 1 ảnh nếu không
  const imageContent = [];

  // Ảnh 1: giản đồ thực tế
  imageContent.push({
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: base64Data },
  });

  // Ảnh 2: bảng tham chiếu 6 TH (nếu đọc được)
  if (refBase64) {
    imageContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: refBase64 },
    });
  }

  imageContent.push({ type: 'text', text: userMsg });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: imageContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Lỗi Claude API' });
    }

    const data = await response.json();
    return res.status(200).json({
      analysis: data.content[0].text.trim(),
      usedReference: !!refBase64,
    });

  } catch (err) {
    return res.status(500).json({ error: 'Lỗi phân tích: ' + err.message });
  }
}
