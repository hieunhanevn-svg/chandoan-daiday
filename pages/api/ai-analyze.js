import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

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

// Load toàn bộ ảnh (dùng khi không crop được)
function loadRefFull(filename) {
  if (!filename) return null;
  try {
    return fs.readFileSync(path.join(process.cwd(),'public',filename)).toString('base64');
  } catch(e) { return null; }
}

// Layout panel từng TH:
// TH1: 3 cột × 2 hàng → col(A=0,B=1,C=2), row(mất I=0, mất U=1)
// TH2: 3 cột × 1 hàng → col(A=0, B=1, C=2)
// TH3: 3 cột × 1 hàng → col(A&B=0, A&C=1, B&C=2)
// TH4: 1 panel → không crop
// TH5: 3 cột × 1 hàng → col(A&B=0, A&C=1, B&C=2)
// TH6: 3 cột × 1 hàng → col(A&B=0, A&C=1, B&C=2)

async function loadRefCropped(filename, thKey, suspectedPhases) {
  if (!filename) return null;
  const imgPath = path.join(process.cwd(), 'public', filename);
  if (!fs.existsSync(imgPath)) return null;

  // TH4 chỉ có 1 panel — trả về nguyên
  if (thKey === 'TH4') return loadRefFull(filename);

  // Xác định cột cần cắt
  let col = 0;
  const phases = suspectedPhases || [];

  if (thKey === 'TH1') {
    // col: A=0, B=1, C=2 (ưu tiên pha đầu tiên bị nghi ngờ)
    const ph = phases[0] || 'A';
    col = ph === 'A' ? 0 : ph === 'B' ? 1 : 2;
  } else if (thKey === 'TH2') {
    // col: A=0, B=1, C=2
    const ph = phases[0] || 'A';
    col = ph === 'A' ? 0 : ph === 'B' ? 1 : 2;
  } else if (thKey === 'TH3' || thKey === 'TH5' || thKey === 'TH6') {
    // col: A&B=0, A&C=1, B&C=2
    const sorted = [...phases].sort().join('');
    col = sorted.includes('A') && sorted.includes('B') && !sorted.includes('C') ? 0
        : sorted.includes('A') && sorted.includes('C') ? 1
        : 2; // B&C hoặc mặc định
  }

  try {
    const meta = await sharp(imgPath).metadata();
    const W = meta.width, H = meta.height;
    const cols = thKey === 'TH1' ? 3 : (W > 600 ? 3 : 1);
    const rows = thKey === 'TH1' ? 2 : 1;
    const panelW = Math.floor(W / cols);
    const panelH = Math.floor(H / rows);

    const buffer = await sharp(imgPath)
      .extract({ left: col * panelW, top: 0, width: panelW, height: panelH })
      .png()
      .toBuffer();
    return buffer.toString('base64');
  } catch(e) {
    console.log('Crop error:', e.message, '→ dùng ảnh gốc');
    return loadRefFull(filename);
  }
}

// Xác định pha nghi ngờ bị lỗi từ ratioX hoặc phi
function getSuspectedPhases(m, d) {
  const rA = m.ratioA ? parseFloat(m.ratioA) : null;
  const rB = m.ratioB ? parseFloat(m.ratioB) : null;
  const rC = m.ratioC ? parseFloat(m.ratioC) : null;
  const phases = [];

  if (m.hasPabc) {
    if (rA !== null && rA < -0.5) phases.push('A');
    if (rB !== null && rB < -0.5) phases.push('B');
    if (rC !== null && rC < -0.5) phases.push('C');
    if (rA !== null && Math.abs(rA) < 0.25) phases.push('A');
    if (rB !== null && Math.abs(rB) < 0.25) phases.push('B');
    if (rC !== null && Math.abs(rC) < 0.25) phases.push('C');
  } else {
    // Dùng phi đã quy đổi
    const phiMode = d.phiMode || '180';
    function effPhi(p) {
      const v = parseFloat(p) || 0;
      return phiMode === '360' && v > 180 ? v - 360 : v;
    }
    if (Math.abs(effPhi(d.phiA)) > 90) phases.push('A');
    if (Math.abs(effPhi(d.phiB)) > 90) phases.push('B');
    if (Math.abs(effPhi(d.phiC)) > 90) phases.push('C');
  }

  return [...new Set(phases)]; // bỏ trùng
}

// Đặc trưng giản đồ của từng TH — AI dùng để đối chiếu
const TH_FEATURES = {
  'Binh_thuong': 'Cả 3 nét đứt (Ia/Ib/Ic) đều trễ nhẹ sau U cùng màu. Giản đồ ĐỐI XỨNG đều 3 pha. Không có nét nào ngược chiều hay thiếu.',
  'TH1': 'THIẾU HẲN 1 nét đứt (I=0) HOẶC 1 nét liền (U=0). Hai pha còn lại bình thường. Giống mẫu TH1 trong Hình tham chiếu.',
  'TH2': 'ĐÚNG 1 nét đứt nằm PHÍA ĐỐI DIỆN nét liền CÙNG MÀU (qua tâm). Hai nét đứt còn lại bình thường. Giống mẫu TH2.',
  'TH3': 'ĐÚNG 2 nét đứt nằm phía đối diện U cùng màu. 1 nét đứt còn lại bình thường. Giống mẫu TH3.',
  'TH4': 'CẢ 3 nét đứt đều nằm phía đối diện U tương ứng. Giản đồ ĐỐI XỨNG nhưng I ngược hoàn toàn. Giống mẫu TH4.',
  'TH5': 'Nét đứt của 1 pha nằm Ở VỊ TRÍ PHA KHÁC (lệch ~120° bất thường). Giản đồ MẤT đối xứng rõ rệt. P≈0. Giống mẫu TH5.',
  'TH6': 'Đủ 3 nét đứt NHƯNG 2 cái nằm sai chiều + Ub/Uc hoán đổi vị trí. Không có pha nào I=0. Giống mẫu TH6.',
};

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích giản đồ vector điện kế 3 pha gián tiếp.
Người đọc là kỹ thuật viên điện lực ngoài hiện trường, KHÔNG phải kỹ sư lập trình.

══════════════════════════════════════════════════════════
TUYỆT ĐỐI KHÔNG dùng bất kỳ ký hiệu kỹ thuật nào:
P_ratio, numFlipped, ratioA, ratioB, ratioC, has120,
phi (φ), cosφ, hasPabc, ratio, flip, miss, score,
hay bất kỳ ký hiệu dạng "tên_biến = giá_trị" nào.
Kể cả trong phần tóm tắt — KHÔNG được viết ký hiệu.
══════════════════════════════════════════════════════════

BẠN NHẬN ĐƯỢC:
- Mô tả tình trạng đo lường đã diễn giải sẵn bằng ngôn ngữ thực tế
  → Dùng nguyên văn cách diễn đạt đó, đừng viết lại thành ký hiệu
- Hình 1: Giản đồ vector thực tế (đây là hình chính cần phân tích)
- Hình 2, 3, 4: Mẫu tham chiếu của Hạng 1, Hạng 2, Hạng 3

CÁCH ĐỌC GIẢN ĐỒ:
Màu: Đỏ=Pha A, Vàng=Pha B, Xanh=Pha C
Nét LIỀN dày = điện áp (U): Ua hướng lên, Ub hướng phải xuống, Uc hướng trái xuống
Nét ĐỨT mảnh = dòng điện (I)
Biến dòng đảo ngược = nét đứt màu X nằm PHÍA ĐỐI DIỆN nét liền cùng màu (qua tâm)
Mất tín hiệu = không có nét đứt của màu đó
Đổi chéo 2 pha = nét đứt 1 màu nằm ở vị trí pha khác (lệch ~120°)

NHIỆM VỤ — phân tích SÂU từng trường hợp:
Tầng 1: Giải thích bằng ngôn ngữ thực tế TẠI SAO các chỉ số đo lường ủng hộ trường hợp đó
Tầng 2: Nếu đúng trường hợp đó, giản đồ phải trông thế nào (mô tả màu, hướng nét cụ thể)
Tầng 3: Đối chiếu Hình 1 với mẫu tương ứng — khớp hay không, thấy gì cụ thể

QUY TẮC:
- Phân tích ĐỦ cả 3 hạng, không bỏ hạng nào
- Không đề xuất trường hợp ngoài 3 hạng đã cho
- Gợi ý 1 lựa chọn cuối cùng của AI

FORMAT TRẢ LỜI BẮT BUỘC:

🔢 TÓM TẮT TÌNH TRẠNG ĐO ĐẾM:
[Dùng ngôn ngữ thực tế mô tả: điện kế đang ghi bao nhiêu % công suất,
 pha nào có vấn đề, có dấu hiệu gì bất thường — TUYỆT ĐỐI không viết ký hiệu]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 PHÂN TÍCH CHI TIẾT TỪNG TRƯỜNG HỢP:

▶ Hạng 1 — [Tên trường hợp]:
  Lý do số liệu: [Giải thích bằng ngôn ngữ thực tế tại sao các chỉ số đo lường ủng hộ trường hợp này — không dùng ký hiệu]
  Đặc trưng giản đồ: [Nếu đúng trường hợp này thì trên giản đồ phải thấy gì — mô tả màu sắc và hướng nét cụ thể]
  Đối chiếu Hình 1 ↔ Hình 2 (mẫu tham chiếu): [Thực tế thấy gì trong Hình 1, so với mẫu thế nào]
  Kết luận: KHỚP ✅ / KHÔNG KHỚP ❌ / MỘT PHẦN ⚠️ — [lý do ngắn gọn]

▶ Hạng 2 — [Tên trường hợp]:
  Lý do số liệu: [Tại sao thuật toán vẫn xét trường hợp này dù không phải hạng 1 — giải thích bằng ngôn ngữ thực tế]
  Đặc trưng giản đồ: [Đặc trưng hình ảnh của trường hợp này]
  Đối chiếu Hình 1 ↔ Hình 3 (mẫu tham chiếu): [Mô tả và so sánh]
  Kết luận: KHỚP ✅ / KHÔNG KHỚP ❌ / MỘT PHẦN ⚠️ — [lý do]

▶ Hạng 3 — [Tên trường hợp]:
  Lý do số liệu: [Tại sao thuật toán vẫn xét trường hợp này — giải thích bằng ngôn ngữ thực tế]
  Đặc trưng giản đồ: [Đặc trưng hình ảnh]
  Đối chiếu Hình 1 ↔ Hình 4 (mẫu tham chiếu): [Mô tả và so sánh]
  Kết luận: KHỚP ✅ / KHÔNG KHỚP ❌ / MỘT PHẦN ⚠️ — [lý do]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 GỢI Ý CỦA AI:
[Tên trường hợp AI chọn] — vì [lý do thực tế kết hợp số liệu và giản đồ, không dùng ký hiệu]

🔌 PHA BỊ LỖI:
[Tên pha + loại lỗi + bằng chứng bằng ngôn ngữ thực tế]

⚠️ LƯU Ý:
[Điều cần KTV kiểm tra thêm, hoặc "Số liệu và giản đồ nhất quán với nhau"]

Tối đa 400 chữ. Tiếng Việt. Ngôn ngữ thực tế của người làm điện lực.`;

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

  // Xác định pha nghi ngờ từ số liệu
  const suspectedPhases = getSuspectedPhases(m, d);

  // Load ảnh tham chiếu — CẮT ĐÚNG Ô tương ứng với pha nghi ngờ
  const refImages = (await Promise.all(top3.map(async (th, i) => {
    const key = getRefKey(th?.name || '');
    const filename = REF_MAP[key] || null;
    const b64ref = await loadRefCropped(filename, key, suspectedPhases);
    return b64ref ? { index: i+1, name: th?.name, b64: b64ref, key, suspectedPhases } : null;
  }))).filter(Boolean);

  // ── Diễn giải số liệu bằng ngôn ngữ KTV hiểu ──────────────
  const rA = m.ratioA ? parseFloat(m.ratioA) : null;
  const rB = m.ratioB ? parseFloat(m.ratioB) : null;
  const rC = m.ratioC ? parseFloat(m.ratioC) : null;
  const ratio = parseFloat(m.P_ratio) || 0;

  // Diễn giải P_ratio bằng ngôn ngữ thực tế
  function explainRatio(r) {
    const pct = Math.abs(r * 100).toFixed(0);
    if (Math.abs(r - 1.0) <= 0.20)  return `Điện kế đang ghi đúng 100% công suất thực → phù hợp đấu dây đúng`;
    if (Math.abs(r - 0.667) <= 0.20) return `Điện kế chỉ ghi được 2/3 (~${pct}%) công suất thực → 1 pha mất tín hiệu hoặc 2 pha bị đảo+hoán vị`;
    if (Math.abs(r - 0.333) <= 0.20) return `Điện kế chỉ ghi được 1/3 (~${pct}%) công suất thực → 1 CT bị đấu ngược chiều`;
    if (Math.abs(r) <= 0.15)         return `Điện kế ghi gần bằng 0 → dòng và áp của 2 pha bị đổi chéo nhau, triệt tiêu công suất`;
    if (Math.abs(r + 0.333) <= 0.20) return `Điện kế ghi âm 1/3 (−${pct}%) → 2 CT bị đấu ngược, điện kế đang ghi ngược chiều`;
    if (Math.abs(r + 1.0) <= 0.20)   return `Điện kế ghi âm 100% → toàn bộ CT bị đấu ngược, điện kế quay ngược hoàn toàn`;
    return `Tỷ lệ công suất bất thường (${(r*100).toFixed(0)}%) → không khớp rõ ràng với trường hợp chuẩn nào`;
  }

  // Diễn giải ratioX từng pha bằng ngôn ngữ thực tế
  function explainRatioX(r, ph, col) {
    if (r === null) return `Pha ${ph} (${col}): Không có số liệu công suất từng pha`;
    if (r < -0.5)   return `Pha ${ph} (${col}): Công suất đo được ÂM trong khi tính toán ra DƯƠNG → CT pha ${ph} đang đấu NGƯỢC đầu S1-S2. Trên giản đồ: nét đứt ${col} nằm phía đối diện nét liền ${col}`;
    if (Math.abs(r) < 0.25) return `Pha ${ph} (${col}): Công suất đo gần bằng 0 dù dòng và áp vẫn có → pha ${ph} MẤT TÍN HIỆU (đứt cầu chì hoặc đứt dây nhi thứ). Trên giản đồ: không thấy nét đứt ${col}`;
    if (r > 0.75)   return `Pha ${ph} (${col}): Công suất đo khớp với tính toán → pha ${ph} ĐẤU ĐÚNG, bình thường`;
    return `Pha ${ph} (${col}): Công suất đo lệch nhẹ so với tính toán (${(r*100).toFixed(0)}%) → cần kiểm tra thêm`;
  }

  // Diễn giải phi (khi không có Pa/Pb/Pc)
  function explainPhi(phi, ph, col) {
    const p = Math.abs(parseFloat(phi)||0);
    if (p > 90) return `Pha ${ph} (${col}): Góc lệch ${phi}° vượt quá 90° → cos(φ) âm → CT pha ${ph} có thể đang đấu ngược. Trên giản đồ: nét đứt ${col} có thể nằm ngược phía nét liền ${col}`;
    return `Pha ${ph} (${col}): Góc lệch ${phi}° trong vùng bình thường (dưới 90°) → pha ${ph} bình thường`;
  }

  // Diễn giải has120
  function explainHas120(has120) {
    if (has120) return `Phát hiện góc lệch ~120° bất thường giữa các pha → dấu hiệu của đổi chéo cáp nhi thứ CT và VT giữa 2 pha (TH5)`;
    return `Không có hiện tượng lệch 120° bất thường → loại trừ khả năng đổi chéo cáp nhi thứ 2 pha (TH5)`;
  }

  // Diễn giải numFlipped
  function explainFlipped(n) {
    if (n === 0) return `Không phát hiện pha nào đấu ngược CT`;
    if (n === 1) return `Phát hiện 1 pha có CT đấu ngược chiều`;
    if (n === 2) return `Phát hiện 2 pha có CT đấu ngược chiều`;
    if (n === 3) return `Phát hiện cả 3 pha đều có CT đấu ngược chiều`;
    return `Phát hiện ${n} pha có CT đấu ngược`;
  }

  const phaLines = m.hasPabc
    ? [explainRatioX(rA,'A','ĐỎ'), explainRatioX(rB,'B','VÀNG'), explainRatioX(rC,'C','XANH')]
    : [explainPhi(d.phiA,'A','ĐỎ'), explainPhi(d.phiB,'B','VÀNG'), explainPhi(d.phiC,'C','XANH')];

  // Đặc trưng giản đồ của từng TH trong Top 3
  const thFeatureLines = top3.map((th, i) => {
    const key = getRefKey(th?.name || '');
    const feat = TH_FEATURES[key] || 'Xem hình mẫu tương ứng';
    const refNote = refImages.find(r => r.index === i+1)
      ? `(Hình ${i+2} = mẫu tham chiếu)`
      : '(Không có hình mẫu)';
    // Lý do thuật toán đưa TH này vào top 3
    const breakdown = th?.scoreBreakdown || [];
    const breakdownText = breakdown.length > 0
      ? breakdown.map(l => `    • ${l}`).join('\n')
      : '    • (Không có chi tiết điểm)';
    return `Hạng ${i+1} — ${th?.name}:\n  TẠI SAO THUẬT TOÁN ĐƯA VÀO TOP 3:\n${breakdownText}\n  ĐẶC TRƯNG GIẢN ĐỒ (nếu đúng TH này): ${feat}\n  ${refNote}`;
  }).join('\n\n');

  const userMsg = `
THUẬT TOÁN ĐÃ XẾP HẠNG 3 TRƯỜNG HỢP:
  Hạng 1: ${top3[0]?.name || '—'}
  Hạng 2: ${top3[1]?.name || '—'}
  Hạng 3: ${top3[2]?.name || '—'}

SỐ LIỆU ĐO LƯỜNG — ĐÃ DIỄN GIẢI:

• Điện kế đang ghi được bao nhiêu % công suất thực:
  ${explainRatio(ratio)}

• Tình trạng CT từng pha:
${phaLines.map(l=>'  - '+l).join('\n')}

• Tình trạng đấu ngược tổng quát:
  ${explainFlipped(m.numFlipped)}

• Hiện tượng đổi chéo cáp:
  ${explainHas120(m.has120)}

LÝ DO THUẬT TOÁN ĐƯA TỪNG TRƯỜNG HỢP VÀO KẾT QUẢ:
${thFeatureLines}

HÌNH ẢNH:
  Hình 1 = Giản đồ vector thực tế (phân tích chính)
${refImages.map(r=>`  Hình ${r.index+1} = Mẫu tham chiếu: ${r.name}${r.suspectedPhases?.length ? ` — đã cắt đúng ô pha ${r.suspectedPhases.join('+')} nghi ngờ` : ''}`).join('\n')}
  (Mỗi hình mẫu đã được cắt đúng biến thể pha nghi ngờ — so sánh trực tiếp với Hình 1)

YÊU CẦU BẮT BUỘC:
1. Phân tích ĐỦ CẢ 3 HẠNG — viết đủ ▶ Hạng 1, ▶ Hạng 2, ▶ Hạng 3
2. TUYỆT ĐỐI KHÔNG dùng ký hiệu kỹ thuật như: P_ratio, numFlipped, ratioA, ratioB, ratioC, has120, phi, cosφ — thay bằng câu giải thích thực tế
3. Mỗi hạng: lý do số liệu → đặc trưng giản đồ → đối chiếu hình → kết luận KHỚP/KHÔNG KHỚP
4. Viết ngắn gọn đủ 3 hạng, sau đó mới kết luận`;

  // Gửi: Hình 1 (thực tế) + Hình 2,3,4 (mẫu 3 TH)
  const content = [
    { type:'image', source:{ type:'base64', media_type:'image/png', data: b64 } },
    ...refImages.map(r=>({ type:'image', source:{ type:'base64', media_type:'image/png', data: r.b64 } })),
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
        max_tokens:1500,
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
