import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích lỗi đấu dây điện kế 3 pha gián tiếp.

BẠN NHẬN ĐƯỢC:
- Số liệu đầu vào + kết quả thuật toán Naive Bayes (ưu tiên số 1)
- Hình 1: Giản đồ vector THỰC TẾ của điện kế đang kiểm tra
- Hình 2: Bảng 6 trường hợp lỗi MẪU để so sánh trực quan

THỨ TỰ XỬ LÝ BẮT BUỘC:
① Đọc kết quả thuật toán → xác định Top 3 và các chỉ số (P_ratio, numFlipped, ratioX)
② Nhìn Hình 1 → so sánh với các mẫu trong Hình 2 → xác định hình dáng giống nhất
③ Kết hợp ① và ② → đưa ra 2 kết luận độc lập

KIẾN THỨC ĐỌC GIẢN ĐỒ:
Màu: Đỏ=Pha A, Vàng=Pha B, Xanh=Pha C
Nét LIỀN dày = U (điện áp): Ua lên (~90°), Ub phải dưới (~-30°), Uc trái dưới (~-150°)
Nét ĐỨT mảnh = I (dòng điện): bình thường trễ sau U cùng màu một góc nhỏ

DẤU HIỆU NHẬN DẠNG TỪNG TRƯỜNG HỢP:
- Bình thường: 3 nét đứt đều trễ nhẹ sau U cùng màu. Giản đồ đối xứng đẹp.
- TH1 (Mất 1 pha): Thiếu hẳn 1 nét đứt. Pha đó I=0.
- TH2 (Đảo 1 CT): Đúng 1 nét đứt nằm PHÍA ĐỐI DIỆN U cùng màu (qua tâm).
- TH3 (Đảo 2 CT): Đúng 2 nét đứt nằm phía đối diện U tương ứng.
- TH4 (Đảo 3 CT): Cả 3 nét đứt đều phía đối diện U. P âm hoàn toàn.
- TH5 (Hoán vị): Nét đứt nằm ở vị trí pha KHÁC (lệch ~120°). P≈0.
- TH6: Đủ 3 nét đứt NHƯNG 2 cái sai chiều + 2 VT đổi pha. P≈2/3.

XÁC ĐỊNH PHA BỊ LỖI:
Từ ratioX (nếu có Pa/Pb/Pc) — chính xác nhất:
  ratioA≈-1 → CT pha A đảo | ratioB≈-1 → CT pha B đảo | ratioC≈-1 → CT pha C đảo
  ratioX≈0 → pha X mất tín hiệu

Từ phi (nếu không có Pa/Pb/Pc):
  |phiA|>90° → pha A nghi ngờ đảo CT | |phiB|>90° → pha B | |phiC|>90° → pha C

Từ giản đồ (hỗ trợ thêm):
  Ia đỏ đứt ngược Ua đỏ liền → Pha A bị đảo CT
  Ib vàng đứt ngược Ub vàng liền → Pha B bị đảo CT
  Ic xanh đứt ngược Uc xanh liền → Pha C bị đảo CT
  Nét đứt lệch 120° bất thường → TH5 hoán vị

QUY TẮC KẾT LUẬN 1:
- Chỉ được chọn trong Top 3 thuật toán
- Có thể khác Hạng 1 nếu hình ảnh cho thấy Hạng 2/3 phù hợp hơn về mặt trực quan
- Phải nêu lý do kết hợp cả số liệu lẫn hình ảnh

QUY TẮC KẾT LUẬN 2:
- Phân tích theo TH mà AI kết luận ở KL1
- Nêu CỤ THỂ: "Pha A" / "Pha B" / "Pha C" / "Pha A và B" / ...
- Kèm loại lỗi: "đảo cực tính CT" / "mất tín hiệu" / "đổi chéo dòng áp" / "đảo 2 VT + 2 CT"
- Bằng chứng: dùng ratioX (nếu có) → phi → giản đồ (theo thứ tự ưu tiên)

FORMAT TRẢ LỜI — đúng 4 phần, không thêm không bớt:

🔍 SO SÁNH GIẢN ĐỒ:
[Hình 1 giống mẫu nào nhất trong Hình 2? Nêu điểm giống cụ thể trên hình.]

🤖 KẾT LUẬN 1 — Theo AI:
[TH nào trong Top 3, lý do kết hợp số liệu + hình ảnh]

🔌 KẾT LUẬN 2 — Pha bị lỗi:
[Tên pha cụ thể + loại lỗi + bằng chứng số hoặc hình ảnh]

⚠️ LƯU Ý:
[Mâu thuẫn hoặc cần kiểm tra thêm. Ghi "Không có mâu thuẫn" nếu nhất quán.]

Tối đa 160 chữ. Tiếng Việt. Rõ ràng, thực tế.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key chưa cấu hình' });

  const { imageBase64, diagnosisTop3, metrics, rawData } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Thiếu ảnh giản đồ' });

  const b64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const top3 = diagnosisTop3 || [];
  const m = metrics || {};
  const d = rawData || {};

  // Đọc ảnh tham chiếu
  let refB64 = '';
  try {
    const p = path.join(process.cwd(), 'public', 'reference_6cases.png');
    refB64 = fs.readFileSync(p).toString('base64');
  } catch(e) { console.log('No ref image'); }

  // Phân tích pha nghi ngờ từ số liệu
  const phiA = parseFloat(d.phiA)||0, phiB = parseFloat(d.phiB)||0, phiC = parseFloat(d.phiC)||0;
  const rA = m.ratioA ? parseFloat(m.ratioA) : null;
  const rB = m.ratioB ? parseFloat(m.ratioB) : null;
  const rC = m.ratioC ? parseFloat(m.ratioC) : null;

  const suspectPha = [];
  if (m.hasPabc) {
    if (rA !== null && rA < -0.5) suspectPha.push(`Pha A (ratioA=${m.ratioA} → CT đảo)`);
    if (rB !== null && rB < -0.5) suspectPha.push(`Pha B (ratioB=${m.ratioB} → CT đảo)`);
    if (rC !== null && rC < -0.5) suspectPha.push(`Pha C (ratioC=${m.ratioC} → CT đảo)`);
    if (rA !== null && Math.abs(rA) < 0.25) suspectPha.push(`Pha A (ratioA≈0 → mất tín hiệu)`);
    if (rB !== null && Math.abs(rB) < 0.25) suspectPha.push(`Pha B (ratioB≈0 → mất tín hiệu)`);
    if (rC !== null && Math.abs(rC) < 0.25) suspectPha.push(`Pha C (ratioC≈0 → mất tín hiệu)`);
  } else {
    if (Math.abs(phiA) > 90) suspectPha.push(`Pha A (phiA=${d.phiA}° > 90°)`);
    if (Math.abs(phiB) > 90) suspectPha.push(`Pha B (phiB=${d.phiB}° > 90°)`);
    if (Math.abs(phiC) > 90) suspectPha.push(`Pha C (phiC=${d.phiC}° > 90°)`);
  }

  const userMsg = `
=== BƯỚC 1: KẾT QUẢ THUẬT TOÁN (ưu tiên số 1) ===

TOP 3 TRƯỜNG HỢP (chỉ kết luận trong phạm vi này):
  Hạng 1: ${top3[0]?.name || '—'}
  Hạng 2: ${top3[1]?.name || '—'}
  Hạng 3: ${top3[2]?.name || '—'}

CHỈ SỐ TÍNH TOÁN:
  P_ratio = ${m.P_ratio}
  numFlipped (số pha đảo) = ${m.numFlipped}
  has120offset = ${m.has120} (True = lệch 120° → đặc trưng TH5)
${m.hasPabc
  ? `  ratioA=${m.ratioA} | ratioB=${m.ratioB} | ratioC=${m.ratioC}
  (≈+1: đúng | ≈-1: CT đảo | ≈0: mất tín hiệu)`
  : `  phiA=${d.phiA}° | phiB=${d.phiB}° | phiC=${d.phiC}°`}

PHA NGHI NGỜ BỊ LỖI (từ số liệu):
  ${suspectPha.length > 0 ? suspectPha.join('\n  ') : 'Chưa xác định được cụ thể'}

=== BƯỚC 2: NHÌN GIẢN ĐỒ ===
Hình 1 = giản đồ thực tế. Hình 2 = bảng 6 TH mẫu.
So sánh hình dáng để xác nhận hoặc điều chỉnh kết quả thuật toán.
Đưa ra 2 kết luận theo format quy định.`;

  const content = [
    { type:'image', source:{ type:'base64', media_type:'image/png', data: b64 } },
    ...(refB64 ? [{ type:'image', source:{ type:'base64', media_type:'image/png', data: refB64 } }] : []),
    { type:'text', text: userMsg }
  ];

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!resp.ok) {
      const err = await resp.json();
      return res.status(resp.status).json({ error: err.error?.message || 'Lỗi API' });
    }
    const data = await resp.json();
    return res.status(200).json({ analysis: data.content[0].text.trim(), usedRef: !!refB64 });

  } catch(err) {
    return res.status(500).json({ error: 'Lỗi: ' + err.message });
  }
}
