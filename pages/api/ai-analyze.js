import fs from 'fs';
import path from 'path';

const REF_MAP = {
  'TH1':'ref_TH1.png','TH2':'ref_TH2.png','TH3':'ref_TH3.png',
  'TH4':'ref_TH4.png','TH5':'ref_TH5.png','TH6':'ref_TH6.png',
  'Binh_thuong': null,
};

function getRefKey(name) {
  if (!name) return null;
  for (const key of Object.keys(REF_MAP)) {
    if (name.includes(key)) return key;
  }
  if (name.includes('Đúng') || name.includes('Bình')) return 'Binh_thuong';
  return null;
}

function loadRef(filename) {
  if (!filename) return '';
  try {
    return fs.readFileSync(path.join(process.cwd(),'public',filename)).toString('base64');
  } catch(e) { return ''; }
}

// ================================================================
// SYSTEM PROMPT — Thứ tự bắt buộc: TÍNH SỐ TRƯỚC → NHÌN HÌNH SAU
// AI phải hoàn thành phân tích số liệu trước khi xem hình
// ================================================================
const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích lỗi đấu dây điện kế 3 pha gián tiếp.

QUY TRÌNH BẮT BUỘC — PHẢI THỰC HIỆN THEO THỨ TỰ NÀY:

══════════════════════════════════════════════════════
GIAI ĐOẠN 1: PHÂN TÍCH SỐ LIỆU (bắt buộc làm trước)
══════════════════════════════════════════════════════
Dựa HOÀN TOÀN vào số liệu được cung cấp, thực hiện:

1a. Đọc P_ratio và đối chiếu:
    ≈ +1.0  → Bình thường
    ≈ +0.67 → TH1 hoặc TH6
    ≈ +0.33 → TH2
    ≈  0.0  → TH5
    ≈ -0.33 → TH3
    ≈ -1.0  → TH4

1b. Đọc numFlipped (số pha đảo):
    0 flip → Bình thường hoặc TH1 hoặc TH5
    1 flip → TH2
    2 flip → TH3 hoặc TH6
    3 flip → TH4

1c. Nếu có ratioX từng pha — XÁC ĐỊNH PHA LỖI NGAY:
    ratioA ≈ -1.0 → CT pha A đảo ngược → nét đứt ĐỎ nằm ngược Ua
    ratioB ≈ -1.0 → CT pha B đảo ngược → nét đứt VÀNG nằm ngược Ub
    ratioC ≈ -1.0 → CT pha C đảo ngược → nét đứt XANH nằm ngược Uc
    ratioX ≈  0.0 → pha X mất tín hiệu → không có nét đứt màu X
    ratioX ≈ +1.0 → pha X bình thường

1d. Nếu không có ratioX — dùng phi:
    |phiA| > 90° → pha A nghi đảo
    |phiB| > 90° → pha B nghi đảo
    |phiC| > 90° → pha C nghi đảo

1e. Đối chiếu kết quả tự phân tích với Top 3 thuật toán:
    → Thuật toán và phân tích của bạn có nhất quán không?
    → Nếu nhất quán: tăng độ tin cậy
    → Nếu khác: ghi nhận điểm khác biệt

SAU KHI hoàn thành Giai đoạn 1, mới chuyển sang:

══════════════════════════════════════════════════════
GIAI ĐOẠN 2: XÁC NHẬN BẰNG HÌNH ẢNH (làm sau)
══════════════════════════════════════════════════════
Màu: Đỏ=Pha A, Vàng=Pha B, Xanh=Pha C
Nét LIỀN dày = U (điện áp)
Nét ĐỨT mảnh = I (dòng điện)

2a. Từ kết quả Giai đoạn 1, bạn ĐÃ BIẾT pha nghi ngờ.
    Nhìn vào ĐÚNG MÀU ĐÓ trong Hình 1 để xác nhận:
    → CT đảo: nét đứt màu X có nằm ngược phía nét liền màu X không?
    → Mất tín hiệu: nét đứt màu X có bị thiếu không?
    → TH5: nét đứt có ở vị trí pha khác (lệch ~120°) không?

2b. So sánh DẠNG LỖI (không so màu cụ thể) với Hình 2:
    Hình 2 là thư viện mẫu tham chiếu — chỉ cho biết dạng lỗi trông như thế nào
    Hình 1 trông có cùng PATTERN với mẫu nào trong Hình 2?

2c. Hình ảnh có XÁC NHẬN kết quả Giai đoạn 1 không?
    → Xác nhận: tăng độ tin cậy tổng thể
    → Mâu thuẫn: nêu rõ mâu thuẫn ở phần Lưu ý

QUY TẮC KẾT LUẬN:
- Chỉ được chọn trong Top 3 thuật toán đã cho
- Có thể thay đổi thứ tự nếu phân tích số liệu cho thấy khác
- KHÔNG đề xuất TH ngoài Top 3

FORMAT TRẢ LỜI — BẮT BUỘC đúng 4 phần:

🔢 PHÂN TÍCH SỐ LIỆU:
[Trình bày ngắn gọn kết quả Giai đoạn 1:
 P_ratio nói lên điều gì? ratioX hoặc phi xác định pha nào?
 Kết quả tự phân tích có khớp Top 3 không?]

🔍 XÁC NHẬN GIẢN ĐỒ:
[Nhìn đúng màu đã xác định ở trên trong Hình 1.
 Hình ảnh xác nhận hay mâu thuẫn với phân tích số?
 Hình 1 giống dạng mẫu nào trong Hình 2?]

🤖 KẾT LUẬN 1 — Theo AI, trường hợp xảy ra:
[TH cụ thể trong Top 3 + lý do KẾT HỢP từ số liệu VÀ hình ảnh]

🔌 KẾT LUẬN 2 — Pha bị lỗi và loại lỗi:
[Pha cụ thể + loại lỗi + bằng chứng số (ưu tiên) + bằng chứng hình ảnh (xác nhận)]
Ví dụ: "Pha A bị đảo cực tính CT — ratioA=−1.04 (bằng chứng số), 
         Ia đỏ đứt nằm ngược Ua đỏ liền (bằng chứng hình)"

⚠️ LƯU Ý:
[Nếu số liệu và hình ảnh mâu thuẫn → nêu rõ. Nếu nhất quán → "Hai nguồn nhất quán, độ tin cậy cao."]

Tối đa 200 chữ. Tiếng Việt. Rõ ràng, thực tế cho KTV hiện trường.`;

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

  // Load ảnh tham chiếu đúng TH
  const refKey = getRefKey(top3[0]?.name || '');
  const refB64 = loadRef(REF_MAP[refKey] || null);

  // Phân tích pha nghi ngờ từ số liệu — truyền sẵn cho AI
  const rA = m.ratioA ? parseFloat(m.ratioA) : null;
  const rB = m.ratioB ? parseFloat(m.ratioB) : null;
  const rC = m.ratioC ? parseFloat(m.ratioC) : null;

  const phaLines = [];
  if (m.hasPabc) {
    const interp = (r, ph, col) => {
      if (r === null) return `${ph}(${col}): không có dữ liệu`;
      if (r < -0.5)           return `${ph}(${col}): ratio=${r.toFixed(2)} → CT ĐẢO NGƯỢC ← nhìn nét đứt ${col} sẽ nằm NGƯỢC chiều nét liền ${col}`;
      if (Math.abs(r) < 0.25) return `${ph}(${col}): ratio=${r.toFixed(2)} → MẤT TÍN HIỆU ← không thấy nét đứt ${col} trên giản đồ`;
      return `${ph}(${col}): ratio=${r.toFixed(2)} → Bình thường`;
    };
    phaLines.push(interp(rA,'Pha A','ĐỎ'));
    phaLines.push(interp(rB,'Pha B','VÀNG'));
    phaLines.push(interp(rC,'Pha C','XANH'));
  } else {
    const interp = (phi, ph, col) =>
      Math.abs(parseFloat(phi)||0) > 90
        ? `${ph}(${col}): phi=${phi}° → |phi|>90° nghi đảo CT ← nét đứt ${col} có thể nằm ngược chiều`
        : `${ph}(${col}): phi=${phi}° → Trong vùng bình thường`;
    phaLines.push(interp(d.phiA,'Pha A','ĐỎ'));
    phaLines.push(interp(d.phiB,'Pha B','VÀNG'));
    phaLines.push(interp(d.phiC,'Pha C','XANH'));
  }

  const userMsg = `
╔══════════════════════════════════════════════════════╗
║  GIAI ĐOẠN 1: SỐ LIỆU — ĐỌC VÀ PHÂN TÍCH TRƯỚC    ║
╚══════════════════════════════════════════════════════╝

TOP 3 THUẬT TOÁN (chỉ kết luận trong phạm vi này):
  Hạng 1: ${top3[0]?.name || '—'}
  Hạng 2: ${top3[1]?.name || '—'}
  Hạng 3: ${top3[2]?.name || '—'}

CHỈ SỐ TÍNH TOÁN:
  P_ratio = ${m.P_ratio}
    (≈+1.0: bình thường | ≈+0.67: TH1/TH6 | ≈+0.33: TH2 | ≈0: TH5 | ≈-0.33: TH3 | ≈-1.0: TH4)
  numFlipped = ${m.numFlipped} pha bị đảo
  has120offset = ${m.has120}
  Có Pa/Pb/Pc: ${m.hasPabc}

PHÂN TÍCH TỪNG PHA — ĐÂY LÀ BẰNG CHỨNG SỐ QUAN TRỌNG NHẤT:
${phaLines.map(l => '  ' + l).join('\n')}

→ Từ số liệu trên, bạn xác định pha nào nghi ngờ bị lỗi? Loại lỗi gì?
→ Kết quả này có khớp với Top 3 thuật toán không?

╔══════════════════════════════════════════════════════╗
║  GIAI ĐOẠN 2: HÌNH ẢNH — XÁC NHẬN SAU KHI PHÂN TÍCH SỐ  ║
╚══════════════════════════════════════════════════════╝

Hình 1 = giản đồ THỰC TẾ (độ phân giải cao).
Hình 2 = thư viện mẫu "${top3[0]?.name || '—'}" — gồm các biến thể theo từng pha.

Sau khi đã xác định pha nghi ngờ từ số liệu:
→ Nhìn vào ĐÚNG MÀU ĐÓ trong Hình 1 để xác nhận
→ So sánh DẠNG LỖI với Hình 2

Bây giờ hãy đưa ra 4 phần kết luận theo format quy định.`;

  const content = [
    { type:'image', source:{ type:'base64', media_type:'image/png', data: b64 } },
    ...(refB64 ? [{ type:'image', source:{ type:'base64', media_type:'image/png', data: refB64 } }] : []),
    { type:'text', text: userMsg }
  ];

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': apiKey,
        'anthropic-version':'2023-06-01',
      },
      body: JSON.stringify({
        model:'claude-sonnet-4-6',
        max_tokens:700,
        system: SYSTEM_PROMPT,
        messages:[{ role:'user', content }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      return res.status(resp.status).json({ error: err.error?.message || 'Lỗi API' });
    }
    const data = await resp.json();
    return res.status(200).json({ analysis: data.content[0].text.trim() });

  } catch(err) {
    return res.status(500).json({ error: 'Lỗi: ' + err.message });
  }
}
