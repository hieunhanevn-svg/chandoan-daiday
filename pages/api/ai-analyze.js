import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích lỗi đấu dây điện kế 3 pha gián tiếp.

BẠN NHẬN ĐƯỢC:
- Số liệu + kết quả thuật toán Naive Bayes → ƯU TIÊN SỐ 1
- Hình 1: Giản đồ vector THỰC TẾ của điện kế đang kiểm tra
- Hình 2: Bảng 6 TH mẫu → CHỈ LÀ VÍ DỤ VỀ DẠNG LỖI

QUAN TRỌNG VỀ HÌNH 2 (bảng mẫu):
Mỗi ô trong Hình 2 chỉ minh họa MỘT PHÁ VÍ DỤ bị lỗi.
Trên thực tế, PHÁ BỊ LỖI CÓ THỂ LÀ BẤT KỲ pha nào (A, B, hoặc C).
Ví dụ: Mẫu TH1 vẽ Pha B mất dòng, nhưng thực tế có thể là Pha A hoặc C mất dòng.
→ KHÔNG so sánh màu sắc chính xác với mẫu.
→ CHỈ so sánh DẠNG LỖI (pattern): có nét đứt nào thiếu không? có nét đứt nào ngược không? lệch 120° không?

CÁCH XÁC ĐỊNH PHA BỊ LỖI — theo thứ tự ưu tiên:

① ratioX (nếu có Pa/Pb/Pc) — CHÍNH XÁC NHẤT, không phụ thuộc tải:
   ratioA ≈ -1.0 → CT pha A đảo ngược (nét đứt ĐỎ nằm phía đối diện Ua đỏ liền)
   ratioB ≈ -1.0 → CT pha B đảo ngược (nét đứt VÀNG nằm phía đối diện Ub vàng liền)
   ratioC ≈ -1.0 → CT pha C đảo ngược (nét đứt XANH nằm phía đối diện Uc xanh liền)
   ratioX ≈ 0   → pha X mất tín hiệu (không có nét đứt của màu đó)

② phi (nếu không có Pa/Pb/Pc):
   |phiA| > 90° → pha A nghi ngờ đảo CT
   |phiB| > 90° → pha B nghi ngờ đảo CT
   |phiC| > 90° → pha C nghi ngờ đảo CT

③ Nhìn giản đồ thực tế (Hình 1) để XÁC NHẬN:
   Màu sắc: Đỏ=Pha A, Vàng=Pha B, Xanh=Pha C
   Nét LIỀN dày = U (điện áp)
   Nét ĐỨT mảnh = I (dòng điện)
   
   Sau khi biết pha nghi ngờ từ ①②, nhìn vào màu đó trong Hình 1:
   - Nét đứt cùng màu có nằm ngược phía nét liền không? → CT đảo
   - Nét đứt cùng màu có bị thiếu không? → mất tín hiệu
   - Nét đứt có ở vị trí pha khác (lệch 120°) không? → hoán vị TH5

DẠNG LỖI NHẬN DẠNG TỪ GIẢN ĐỒ (bất kể pha nào):
- TH1: Thiếu hẳn 1 nét đứt (màu nào đó không có I)
- TH2: Đúng 1 nét đứt nằm phía ĐỐI DIỆN nét liền cùng màu
- TH3: Đúng 2 nét đứt nằm phía đối diện nét liền cùng màu
- TH4: Cả 3 nét đứt đều phía đối diện nét liền
- TH5: Nét đứt 1 màu nằm ở vị trí màu khác (lệch ~120°)
- TH6: Đủ 3 nét đứt nhưng 2 cái sai chiều (Ub/Uc hoán đổi)

QUY TẮC KẾT LUẬN:
KL1: Chọn trong Top 3 thuật toán. Có thể đổi thứ tự nếu hình ảnh thuyết phục hơn.
KL2: Nêu tên pha cụ thể + loại lỗi + bằng chứng theo thứ tự ①②③

FORMAT TRẢ LỜI:

🔍 NHẬN XÉT GIẢN ĐỒ:
[Mô tả những gì thấy trong Hình 1: nét đứt màu nào nằm ngược/thiếu/lệch.
 So sánh DẠNG LỖI (không so màu chính xác) với Hình 2]

🤖 KẾT LUẬN 1 — Theo AI, trường hợp xảy ra:
[TH cụ thể trong Top 3 + lý do kết hợp số liệu và hình ảnh]

🔌 KẾT LUẬN 2 — Pha bị lỗi:
[Tên pha + loại lỗi + bằng chứng]
Ví dụ đúng: "Pha A bị đảo cực tính CT — ratioA=-1.04 xác nhận, giản đồ: Ia (đỏ đứt) nằm ngược Ua (đỏ liền)"
Ví dụ đúng: "Pha B mất tín hiệu — Ib=0, không thấy nét đứt vàng trên giản đồ"
Ví dụ đúng: "Pha A và C bị đổi chéo dòng áp — has120=True, P≈0, nét đứt lệch 120°"

⚠️ LƯU Ý:
[Mâu thuẫn hoặc cần kiểm tra. Ghi "Nhất quán" nếu không có vấn đề]

Tối đa 180 chữ. Tiếng Việt. Rõ ràng, thực tế cho KTV hiện trường.`;

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
  } catch(e) {}

  // Tính toán pha nghi ngờ từ số liệu — truyền cho AI
  const rA = m.ratioA ? parseFloat(m.ratioA) : null;
  const rB = m.ratioB ? parseFloat(m.ratioB) : null;
  const rC = m.ratioC ? parseFloat(m.ratioC) : null;
  const phiA = parseFloat(d.phiA)||0;
  const phiB = parseFloat(d.phiB)||0;
  const phiC = parseFloat(d.phiC)||0;

  // Phân tích chi tiết từng pha từ số liệu
  const phaAnalysis = [];

  if (m.hasPabc) {
    // Có Pa/Pb/Pc — chính xác nhất
    const interpretX = (r, name, col) => {
      if (r === null) return `${name}: không có dữ liệu`;
      if (r < -0.5)  return `${name} (${col}): ratio=${r.toFixed(2)} → CT ĐẢO NGƯỢC — nét đứt ${col} nằm phía đối diện U ${col}`;
      if (r >  0.75) return `${name} (${col}): ratio=${r.toFixed(2)} → Bình thường`;
      if (Math.abs(r) < 0.25) return `${name} (${col}): ratio=${r.toFixed(2)} → MẤT TÍN HIỆU — không có nét đứt ${col}`;
      return `${name} (${col}): ratio=${r.toFixed(2)} → Bất thường nhẹ`;
    };
    phaAnalysis.push(interpretX(rA, 'Pha A', 'ĐỎ'));
    phaAnalysis.push(interpretX(rB, 'Pha B', 'VÀNG'));
    phaAnalysis.push(interpretX(rC, 'Pha C', 'XANH'));
  } else {
    // Không có Pa/Pb/Pc — dùng phi
    const interpretPhi = (phi, name, col) => {
      if (Math.abs(phi) > 90) return `${name} (${col}): phi=${phi}° → CT có thể đảo (|phi|>90°)`;
      return `${name} (${col}): phi=${phi}° → Trong vùng bình thường`;
    };
    phaAnalysis.push(interpretPhi(phiA, 'Pha A', 'ĐỎ'));
    phaAnalysis.push(interpretPhi(phiB, 'Pha B', 'VÀNG'));
    phaAnalysis.push(interpretPhi(phiC, 'Pha C', 'XANH'));
  }

  const userMsg = `
=== KẾT QUẢ THUẬT TOÁN (ưu tiên số 1) ===

TOP 3 TRƯỜNG HỢP (chỉ kết luận trong phạm vi này):
  Hạng 1: ${top3[0]?.name || '—'}
  Hạng 2: ${top3[1]?.name || '—'}
  Hạng 3: ${top3[2]?.name || '—'}

CHỈ SỐ TÍNH TOÁN:
  P_ratio = ${m.P_ratio}
  numFlipped = ${m.numFlipped} pha bị đảo
  has120offset = ${m.has120}
  Có Pa/Pb/Pc từng pha: ${m.hasPabc}

PHÂN TÍCH TỪNG PHA TỪ SỐ LIỆU:
${phaAnalysis.map(p => '  ' + p).join('\n')}

=== NHÌN GIẢN ĐỒ (bước 2) ===
Hình 1 = giản đồ THỰC TẾ.
Hình 2 = bảng 6 TH MẪU (chỉ minh họa dạng lỗi, pha cụ thể có thể khác).

Dựa vào phân tích pha ở trên, hãy nhìn vào đúng màu đó trong Hình 1 để xác nhận.
Sau đó so sánh DẠNG LỖI (không so màu cụ thể) với Hình 2.
Đưa ra 2 kết luận.`;

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
    return res.status(200).json({
      analysis: data.content[0].text.trim(),
      usedRef: !!refB64
    });

  } catch(err) {
    return res.status(500).json({ error: 'Lỗi: ' + err.message });
  }
}
