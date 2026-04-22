// ================================================================
// AI VISION — Phân tích giản đồ vector + số liệu
// Quy tắc: AI có thể sắp xếp lại thứ tự ưu tiên trong Top 3
//          KHÔNG được đề xuất TH nằm ngoài Top 3
// ================================================================

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích giản đồ vector điện kế 3 pha gián tiếp.

QUY TẮC BẮT BUỘC:
1. Thuật toán Naive Bayes đã tính Top 3 trường hợp có khả năng nhất
2. Bạn CHỈ được đề xuất trong phạm vi Top 3 đó — không được đưa ra TH nằm ngoài
3. Bạn CÓ THỂ đánh giá lại thứ tự ưu tiên dựa trên hình ảnh giản đồ
   Ví dụ: Thuật toán xếp TH2 > TH5, nhưng nhìn giản đồ bạn thấy TH5 phù hợp hơn
   → Được phép nói "Giản đồ cho thấy TH5 có thể phù hợp hơn TH2"
4. Nếu đồng ý hoàn toàn với thuật toán → xác nhận và giải thích tại sao
5. Nếu thấy mâu thuẫn số liệu vs hình ảnh → đề nghị KTV kiểm tra lại đầu vào

KIẾN THỨC GIẢN ĐỒ VECTOR:
Màu sắc: Đỏ=Pha A, Vàng=Pha B, Xanh=Pha C
Nét LIỀN dày = U (điện áp): Ua lên ~90°, Ub phải dưới ~-30°, Uc trái dưới ~-150°
Nét ĐỨT mảnh = I (dòng điện)

Dấu hiệu nhận dạng từng TH trên giản đồ:
- Bình thường: Ia,Ib,Ic đều trễ sau U cùng màu góc nhỏ. Hình đối xứng đẹp.
- TH1 (Mất 1 pha): Thiếu 1 nét đứt hoàn toàn (pha đó không có I)
- TH2 (Đảo 1 CT): Đúng 1 nét đứt nằm PHÍA ĐỐI DIỆN với nét liền cùng màu
- TH3 (Đảo 2 CT): Đúng 2 nét đứt nằm phía đối diện U cùng màu
- TH4 (Đảo 3 CT): Cả 3 nét đứt đều phía đối diện U tương ứng
- TH5 (Hoán vị): 1 nét đứt nằm ở vị trí pha KHÁC (lệch ~120° bất thường), P≈0
- TH6 (Đảo 2VT+2CT): Ub,Uc đổi vị trí + 2 nét đứt phía đối diện, không mất pha nào

PHÂN BIỆT KHÓ — TH1 vs TH6 (đều ratio≈2/3):
- TH1: Có đúng 1 pha không có nét đứt (I=0)
- TH6: Tất cả 3 pha đều có nét đứt, nhưng 2 nét đứt nằm sai chiều

CẤU TRÚC TRẢ LỜI BẮT BUỘC:

📐 NHÌN GIẢN ĐỒ:
[Mô tả ngắn gọn điều nổi bật thấy được: vector nào sai chiều, thiếu vector nào, hay lệch 120°]

🤖 ĐÁNH GIÁ AI:
[Trong phạm vi Top 3 của thuật toán, AI nhận xét:
 - Đồng ý với Hạng 1? Hay thấy Hạng 2/3 phù hợp hơn với giản đồ?
 - Lý do dựa trên hình ảnh cụ thể]

📋 KẾT LUẬN:
[1 câu: "AI xác nhận [TH]" HOẶC "AI đánh giá [TH_khác trong Top3] có thể phù hợp hơn dựa trên giản đồ"]

Nếu thấy điều bất thường không khớp số liệu:
⚠️ LƯU Ý: [Nêu cụ thể, đề nghị KTV kiểm tra lại số liệu đầu vào]

GIỚI HẠN: Tối đa 120 chữ. Tiếng Việt. Ngắn gọn, thực tế.`;

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

  const userMsg = `THUẬT TOÁN ĐÃ XÁC ĐỊNH TOP 3:
Hạng 1: ${top3[0]?.name || '—'}
Hạng 2: ${top3[1]?.name || '—'}
Hạng 3: ${top3[2]?.name || '—'}

LƯU Ý: Bạn chỉ được đề xuất trong phạm vi 3 trường hợp trên.

SỐ LIỆU ĐẦU VÀO:
- Ua=${d.Ua}V, Ub=${d.Ub}V, Uc=${d.Uc}V
- Ia=${d.Ia}A, Ib=${d.Ib}A, Ic=${d.Ic}A
- phiA=${d.phiA}°, phiB=${d.phiB}°, phiC=${d.phiC}° (Gốc ${d.phiMode}°)
- P_tổng đo: ${d.Ptotal}W
${d.Pa_do !== '' && d.Pa_do != null ? `- Pa_đo=${d.Pa_do}W, Pb_đo=${d.Pb_do}W, Pc_đo=${d.Pc_do}W` : ''}

KẾT QUẢ THUẬT TOÁN:
- P_ratio = ${m.P_ratio} (≈+1.0: đúng | ≈+0.33: TH2 | ≈0: TH5 | âm: đảo nhiều CT)
- Số pha bị đảo = ${m.numFlipped}
- has120offset = ${m.has120} (True = lệch 120° → đặc trưng TH5)
${m.hasPabc ? `- ratioA=${m.ratioA} | ratioB=${m.ratioB} | ratioC=${m.ratioC}
  (≈+1: đúng chiều | ≈-1: CT đảo ngược | ≈0: mất tín hiệu)` : '- Không có Pa/Pb/Pc từng pha'}

Hãy nhìn giản đồ vector trong ảnh, so sánh với số liệu và đưa ra đánh giá.`;

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
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64Data },
            },
            { type: 'text', text: userMsg },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Lỗi Claude API' });
    }

    const data = await response.json();
    return res.status(200).json({ analysis: data.content[0].text.trim() });

  } catch (err) {
    return res.status(500).json({ error: 'Lỗi phân tích: ' + err.message });
  }
}
