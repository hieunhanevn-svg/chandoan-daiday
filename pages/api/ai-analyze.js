import fs from 'fs';
import path from 'path';

// Map tên TH → file ảnh tham chiếu tương ứng
const REF_MAP = {
  'TH1': 'ref_TH1.png',
  'TH2': 'ref_TH2.png',
  'TH3': 'ref_TH3.png',
  'TH4': 'ref_TH4.png',
  'TH5': 'ref_TH5.png',
  'TH6': 'ref_TH6.png',
  'Binh_thuong': null,
};

function getRefKey(name) {
  if (!name) return null;
  for (const key of Object.keys(REF_MAP)) {
    if (name.includes(key) || name.toLowerCase().includes(key.toLowerCase())) return key;
  }
  if (name.includes('Đúng') || name.includes('Bình')) return 'Binh_thuong';
  return null;
}

function loadRef(filename) {
  if (!filename) return '';
  try {
    const p = path.join(process.cwd(), 'public', filename);
    return fs.readFileSync(p).toString('base64');
  } catch(e) { return ''; }
}

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích lỗi đấu dây điện kế 3 pha gián tiếp.

BẠN NHẬN ĐƯỢC:
- Số liệu + kết quả thuật toán Naive Bayes → ƯU TIÊN SỐ 1
- Hình 1: Giản đồ vector THỰC TẾ của điện kế đang kiểm tra
- Hình 2: Thư viện mẫu của ĐÚNG TRƯỜNG HỢP đó — gồm tất cả biến thể theo từng pha

LƯU Ý QUAN TRỌNG VỀ HÌNH 2:
Hình 2 hiển thị TẤT CẢ biến thể của trường hợp lỗi (theo từng pha A/B/C).
Nhiệm vụ: so sánh Hình 1 với từng biến thể trong Hình 2 để xác định ĐÚNG pha bị lỗi.
Ví dụ: Hình 2 của TH2 có 3 hình (Pha A đảo / Pha B đảo / Pha C đảo)
→ Hình 1 trông giống hình nào nhất → đó là pha bị lỗi.

CÁCH ĐỌC GIẢN ĐỒ:
Màu: Đỏ=Pha A, Vàng=Pha B, Xanh=Pha C
Nét LIỀN = U (điện áp) | Nét ĐỨT = I (dòng điện)

Dấu hiệu theo từng loại lỗi:
- Mất dòng: thiếu nét đứt của màu đó (Ix=0)
- Mất áp: thiếu nét liền của màu đó (Ux=0)
- CT đảo: nét đứt màu X nằm PHÍA ĐỐI DIỆN nét liền màu X (qua tâm)
- TH5 hoán vị: nét đứt màu X nằm ở vị trí pha khác (lệch ~120°)

XÁC ĐỊNH PHA BỊ LỖI — ưu tiên:
① ratioX (nếu có): ratio≈-1 → CT đảo | ratio≈0 → mất tín hiệu
② phi: |phi|>90° → CT nghi ngờ đảo
③ So sánh trực quan Hình 1 với Hình 2

FORMAT TRẢ LỜI — đúng 4 phần:

🔍 SO SÁNH VỚI THƯ VIỆN MẪU:
[Hình 1 giống biến thể nào trong Hình 2? Nêu cụ thể màu nào bị lỗi và dấu hiệu nhìn thấy]

🤖 KẾT LUẬN 1 — Theo AI:
[TH cụ thể (trong Top 3 thuật toán) + lý do kết hợp số liệu và hình ảnh]

🔌 KẾT LUẬN 2 — Pha bị lỗi:
[Tên pha + loại lỗi + bằng chứng số và hình ảnh]
Mẫu đúng: "Pha A bị đảo cực tính CT — ratioA=-1.04, Ia (đỏ đứt) nằm ngược Ua (đỏ liền)"
Mẫu đúng: "Pha B mất dòng — Ib=0, không thấy nét đứt vàng trên giản đồ"
Mẫu đúng: "Pha A và C bị hoán vị dòng áp — P≈0, nét đứt lệch 120°"

⚠️ LƯU Ý:
[Mâu thuẫn hoặc cần kiểm tra. Ghi "Nhất quán" nếu không có vấn đề]

Tối đa 180 chữ. Tiếng Việt. Rõ ràng, thực tế.`;

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

  // Load ảnh tham chiếu đúng TH (dựa trên Hạng 1 thuật toán)
  const top1Name = top3[0]?.name || '';
  const refKey = getRefKey(top1Name);
  const refFile = REF_MAP[refKey] || null;
  const refB64 = loadRef(refFile);

  // Phân tích pha nghi ngờ từ số liệu
  const rA = m.ratioA ? parseFloat(m.ratioA) : null;
  const rB = m.ratioB ? parseFloat(m.ratioB) : null;
  const rC = m.ratioC ? parseFloat(m.ratioC) : null;
  const phiA = parseFloat(d.phiA)||0;
  const phiB = parseFloat(d.phiB)||0;
  const phiC = parseFloat(d.phiC)||0;

  const phaLines = [];
  if (m.hasPabc) {
    const interp = (r, ph, col) => {
      if (r === null) return `${ph}(${col}): không có dữ liệu`;
      if (r < -0.5)           return `${ph}(${col}): ratio=${r.toFixed(2)} → CT ĐẢO — nét đứt ${col} nằm ngược U ${col}`;
      if (Math.abs(r) < 0.25) return `${ph}(${col}): ratio=${r.toFixed(2)} → MẤT TÍN HIỆU`;
      return `${ph}(${col}): ratio=${r.toFixed(2)} → Bình thường`;
    };
    phaLines.push(interp(rA,'Pha A','ĐỎ'));
    phaLines.push(interp(rB,'Pha B','VÀNG'));
    phaLines.push(interp(rC,'Pha C','XANH'));
  } else {
    const interp = (phi, ph, col) => {
      if (Math.abs(phi) > 90) return `${ph}(${col}): phi=${phi}° → CT nghi ngờ đảo (|phi|>90°)`;
      return `${ph}(${col}): phi=${phi}° → Bình thường`;
    };
    phaLines.push(interp(phiA,'Pha A','ĐỎ'));
    phaLines.push(interp(phiB,'Pha B','VÀNG'));
    phaLines.push(interp(phiC,'Pha C','XANH'));
  }

  const userMsg = `
=== KẾT QUẢ THUẬT TOÁN (ưu tiên số 1) ===
Hạng 1: ${top3[0]?.name || '—'}
Hạng 2: ${top3[1]?.name || '—'}
Hạng 3: ${top3[2]?.name || '—'}

CHỈ SỐ CHÍNH:
  P_ratio=${m.P_ratio} | numFlipped=${m.numFlipped} | has120=${m.has120}
  Có Pa/Pb/Pc: ${m.hasPabc}

PHÂN TÍCH TỪNG PHA:
${phaLines.map(l=>'  '+l).join('\n')}

=== HÌNH ẢNH ===
Hình 1: Giản đồ THỰC TẾ
Hình 2: Thư viện mẫu của "${top1Name}" — so sánh để xác định đúng pha bị lỗi
(Chỉ kết luận trong phạm vi Top 3 thuật toán)`;

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
        max_tokens:600,
        system: SYSTEM_PROMPT,
        messages:[{ role:'user', content }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      return res.status(resp.status).json({ error: err.error?.message || 'Lỗi API' });
    }
    const data = await resp.json();
    return res.status(200).json({
      analysis: data.content[0].text.trim(),
      refFile: refFile || 'none',
    });

  } catch(err) {
    return res.status(500).json({ error: 'Lỗi: '+err.message });
  }
}
