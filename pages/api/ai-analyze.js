import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích lỗi đấu dây điện kế 3 pha gián tiếp.

BẠN NHẬN ĐƯỢC:
- Số liệu đầu vào và kết quả thuật toán Naive Bayes (ưu tiên hàng đầu)
- Hình 1: Giản đồ vector thực tế của điện kế đang kiểm tra
- Hình 2: Bảng 6 trường hợp lỗi mẫu để so sánh trực quan

THỨ TỰ XỬ LÝ BẮT BUỘC:
Bước 1 — Đọc kỹ kết quả thuật toán (Top 3, P_ratio, numFlipped, ratioX)
Bước 2 — Nhìn Hình 1 (giản đồ thực tế), so sánh với Hình 2 (6 mẫu)
Bước 3 — Kết hợp cả hai → đưa ra 2 kết luận

KIẾN THỨC ĐỌC GIẢN ĐỒ:
Màu: Đỏ=Pha A, Vàng=Pha B, Xanh=Pha C
Nét LIỀN dày = U (điện áp)
Nét ĐỨT mảnh = I (dòng điện)

Cách xác định pha bị lỗi từ giản đồ:
- CT đảo (TH2/3/4): nét đứt của pha đó nằm PHÍA ĐỐI DIỆN nét liền cùng màu
  → Ia đỏ đứt ngược Ua đỏ liền = Pha A bị đảo CT
  → Ib vàng đứt ngược Ub vàng liền = Pha B bị đảo CT
  → Ic xanh đứt ngược Uc xanh liền = Pha C bị đảo CT
- Mất tín hiệu (TH1): không có nét đứt của pha đó
- Hoán vị (TH5): nét đứt 1 pha nằm ở vị trí pha khác (lệch ~120°)
- TH6: đủ 3 nét đứt nhưng 2 cái sai chiều so với U cùng màu

Dùng ratioX để xác định pha lỗi (nếu có):
- ratioX ≈ -1.0 → pha X bị đảo CT (chắc chắn nhất)
- ratioX ≈ 0 → pha X mất tín hiệu
- ratioX ≈ +1.0 → pha X bình thường

QUY TẮC KẾT LUẬN:
- KẾT LUẬN 1: Chỉ được chọn trong Top 3 thuật toán đã cho
  CÓ THỂ khác Hạng 1 nếu hình ảnh cho thấy Hạng 2/3 phù hợp hơn
- KẾT LUẬN 2: Xác định pha cụ thể dựa trên:
  Ưu tiên 1: ratioX (nếu có Pa/Pb/Pc) — chính xác nhất
  Ưu tiên 2: phi > 90° — CT đảo
  Ưu tiên 3: Nhìn giản đồ — nét đứt nào nằm ngược

FORMAT TRẢ LỜI BẮT BUỘC — đúng 4 phần này:

━━━━━━━━━━━━━━━━━━━━━
🔍 SO SÁNH GIẢN ĐỒ
[1-2 câu: Hình 1 trông giống mẫu nào nhất trong Hình 2? Điểm giống cụ thể.]

━━━━━━━━━━━━━━━━━━━━━
🤖 KẾT LUẬN 1 — Theo AI, trường hợp có thể xảy ra:
[Nêu TH trong Top 3, lý do ngắn gọn kết hợp thuật toán + hình ảnh]

━━━━━━━━━━━━━━━━━━━━━
🔌 KẾT LUẬN 2 — Theo kết quả Hạng 1 thuật toán, pha bị lỗi:
[Nêu cụ thể: "Pha A" / "Pha B" / "Pha C" / "Pha B và C" / "Cả 3 pha"
 Kèm bằng chứng: ratioX hoặc phi hoặc vị trí nét đứt trên giản đồ]

━━━━━━━━━━━━━━━━━━━━━
⚠️ LƯU Ý (nếu có):
[Nếu thấy mâu thuẫn hoặc cần KTV kiểm tra thêm. Bỏ qua nếu không có.]

Tổng cộng tối đa 150 chữ. Tiếng Việt. Rõ ràng, thực tế.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key chưa cấu hình' });

  const { imageBase64, diagnosisTop3, metrics, rawData } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Thiếu ảnh giản đồ' });

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const top3 = diagnosisTop3 || [];
  const m = metrics || {};
  const d = rawData || {};

  // Đọc ảnh tham chiếu 6 TH
  let refBase64 = '';
  try {
    const refPath = path.join(process.cwd(), 'public', 'reference_6cases.png');
    refBase64 = fs.readFileSync(refPath).toString('base64');
  } catch (e) {
    console.log('Không đọc được ảnh tham chiếu');
  }

  // Phân tích pha bị lỗi từ số liệu để hỗ trợ AI
  const flipInfo = [];
  if (m.hasPabc) {
    if (m.ratioA && parseFloat(m.ratioA) < -0.5) flipInfo.push(`Pha A (ratioA=${m.ratioA}≈-1)`);
    if (m.ratioB && parseFloat(m.ratioB) < -0.5) flipInfo.push(`Pha B (ratioB=${m.ratioB}≈-1)`);
    if (m.ratioC && parseFloat(m.ratioC) < -0.5) flipInfo.push(`Pha C (ratioC=${m.ratioC}≈-1)`);
  } else {
    if (Math.abs(parseFloat(d.phiA)||0) > 90) flipInfo.push(`Pha A (|phiA|=${Math.abs(parseFloat(d.phiA))}°>90°)`);
    if (Math.abs(parseFloat(d.phiB)||0) > 90) flipInfo.push(`Pha B (|phiB|=${Math.abs(parseFloat(d.phiB))}°>90°)`);
    if (Math.abs(parseFloat(d.phiC)||0) > 90) flipInfo.push(`Pha C (|phiC|=${Math.abs(parseFloat(d.phiC))}°>90°)`);
  }

  const userMsg = `
=== BƯỚC 1: KẾT QUẢ THUẬT TOÁN (ưu tiên hàng đầu) ===

TOP 3 TRƯỜNG HỢP (chỉ được kết luận trong phạm vi này):
  Hạng 1: ${top3[0]?.name || '—'}
  Hạng 2: ${top3[1]?.name || '—'}
  Hạng 3: ${top3[2]?.name || '—'}

CÁC CHỈ SỐ TÍNH TOÁN:
  P_ratio = ${m.P_ratio}
  (≈+1.0: đúng | ≈+0.67: TH1 hoặc TH6 | ≈+0.33: TH2 | ≈0: TH5 | ≈-0.33: TH3 | ≈-1.0: TH4)
  
  Số pha bị đảo (numFlipped) = ${m.numFlipped}
  has120offset = ${m.has120} (True = lệch 120° → đặc trưng TH5)
  
${m.hasPabc ? `  ratioX từng pha (đây là bằng chứng mạnh nhất):
  ratioA = ${m.ratioA} | ratioB = ${m.ratioB} | ratioC = ${m.ratioC}
  (≈+1: đúng chiều | ≈-1: CT đảo ngược | ≈0: mất tín hiệu)` 
: `  Không có Pa/Pb/Pc → dùng phi để xác định:
  phiA=${d.phiA}° | phiB=${d.phiB}° | phiC=${d.phiC}°
  (|phi|>90° → CT có thể đảo)`}

${flipInfo.length > 0 
  ? `  → Pha nghi ngờ bị lỗi theo số liệu: ${flipInfo.join(', ')}`
  : '  → Không xác định được pha lỗi cụ thể từ số liệu'}

=== BƯỚC 2: NHÌN GIẢN ĐỒ ===
Hình 1 = giản đồ thực tế. Hình 2 = bảng 6 TH mẫu.
So sánh hình dáng, xác định mẫu nào giống nhất.

Hãy đưa ra 2 kết luận theo format đã quy định.`;

  // Gửi 2 ảnh cho Claude
  const content = [];
  content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data } });
  if (refBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: refBase64 } });
  }
  content.push({ type: 'text', text: userMsg });

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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
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
