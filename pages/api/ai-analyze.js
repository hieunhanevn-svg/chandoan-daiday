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
  if (!filename) return null;
  try {
    return fs.readFileSync(path.join(process.cwd(),'public',filename)).toString('base64');
  } catch(e) { return null; }
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

NHIỆM VỤ:
Thuật toán Naive Bayes đã gợi ý 3 trường hợp có thể xảy ra.
Bạn phân tích SÂU từng trường hợp — giải thích TẠI SAO thuật toán đưa ra trường hợp đó
(dựa trên số liệu) VÀ giản đồ vector có xác nhận không (dựa trên hình ảnh).
Mục tiêu: KTV hiểu được căn cứ của từng trường hợp để lựa chọn chính xác.

CÁCH ĐỌC GIẢN ĐỒ:
Màu: Đỏ=Pha A, Vàng=Pha B, Xanh=Pha C
Nét LIỀN dày = U (điện áp): Ua lên (~90°), Ub phải dưới (~-30°), Uc trái dưới (~-150°)
Nét ĐỨT mảnh = I (dòng điện)
CT đảo = nét đứt màu X nằm PHÍA ĐỐI DIỆN nét liền màu X (qua tâm)
Mất tín hiệu = không có nét đứt màu đó
TH5 = nét đứt lệch ~120° sang vị trí pha khác

BẠN NHẬN ĐƯỢC:
- Số liệu + kết quả thuật toán chi tiết
- Hình 1: Giản đồ thực tế (phân tích chính)
- Hình 2, 3, 4: Mẫu tham chiếu của Hạng 1, 2, 3

QUY TẮC PHÂN TÍCH TỪNG TRƯỜNG HỢP:
Với MỖI trường hợp (kể cả bình thường), cần phân tích ĐỦ 3 tầng:
  Tầng 1 — LÝ DO SỐ LIỆU: Tại sao thuật toán cho điểm cao trường hợp này?
    Giải thích bằng P_ratio, numFlipped, ratioX, has120 — số nào ủng hộ TH này?
  Tầng 2 — ĐẶC TRƯNG GIẢN ĐỒ: Nếu đúng là TH này, giản đồ phải trông thế nào?
    Mô tả cụ thể: nét màu nào ở đâu, hướng nào, thiếu hay thừa
  Tầng 3 — ĐỐI CHIẾU HÌNH 1 VỚI MẪU: Hình 1 thực tế có khớp không?
    Nhìn đúng màu pha nghi ngờ, đối chiếu với mẫu tương ứng → Khớp/Không/Một phần

QUY TẮC CHUNG:
- Phân tích ĐỦ cả 3 hạng — không bỏ qua hạng nào
- Không đề xuất TH ngoài 3 hạng đã cho
- Gợi ý 1 lựa chọn cuối cùng của AI dựa trên tổng hợp cả số liệu lẫn hình ảnh

FORMAT TRẢ LỜI BẮT BUỘC:

🔢 TÓM TẮT SỐ LIỆU:
[P_ratio=X (gợi ý TH nào?), pha nghi ngờ từ ratioX/phi, has120 có không]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 PHÂN TÍCH CHI TIẾT TỪNG TRƯỜNG HỢP:

▶ Hạng 1 — [Tên TH]:
  Lý do số liệu: [P_ratio=X phù hợp vì..., numFlipped=Y vì..., ratioX nào ủng hộ...]
  Đặc trưng giản đồ: [nếu đúng TH này, Hình 1 phải thấy gì cụ thể]
  Đối chiếu Hình 1 ↔ Hình 2 (mẫu): [mô tả thực tế thấy gì, so với mẫu thế nào]
  Kết luận: [KHỚP ✅ / KHÔNG KHỚP ❌ / MỘT PHẦN ⚠️] — [giải thích]

▶ Hạng 2 — [Tên TH]:
  Lý do số liệu: [tại sao thuật toán vẫn cho điểm TH này — số nào gần đúng?]
  Đặc trưng giản đồ: [nếu đúng TH này, Hình 1 phải thấy gì]
  Đối chiếu Hình 1 ↔ Hình 3 (mẫu): [mô tả và so sánh]
  Kết luận: [KHỚP ✅ / KHÔNG KHỚP ❌ / MỘT PHẦN ⚠️] — [giải thích]

▶ Hạng 3 — [Tên TH]:
  Lý do số liệu: [tại sao thuật toán vẫn cho điểm TH này]
  Đặc trưng giản đồ: [nếu đúng TH này, Hình 1 phải thấy gì]
  Đối chiếu Hình 1 ↔ Hình 4 (mẫu): [mô tả và so sánh]
  Kết luận: [KHỚP ✅ / KHÔNG KHỚP ❌ / MỘT PHẦN ⚠️] — [giải thích]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 GỢI Ý CỦA AI — 1 LỰA CHỌN:
[Tên TH được AI chọn] vì [lý do tổng hợp: số liệu ủng hộ thế nào + giản đồ xác nhận thế nào]

🔌 PHA BỊ LỖI (theo gợi ý trên):
[Pha cụ thể + loại lỗi + bằng chứng mạnh nhất]

⚠️ LƯU Ý:
[Điểm bất thường cần KTV kiểm tra thêm, hoặc "Số liệu và giản đồ nhất quán"]

Tiếng Việt. Rõ ràng, thực tế. Tối đa 400 chữ.`;

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

  // Load ảnh tham chiếu cho CẢ 3 TH trong Top 3
  const refImages = top3.map((th, i) => {
    const key = getRefKey(th?.name || '');
    const b64ref = loadRef(REF_MAP[key] || null);
    return b64ref ? { index: i+1, name: th?.name, b64: b64ref } : null;
  }).filter(Boolean);

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
KẾT QUẢ THUẬT TOÁN — DIỄN GIẢI BẰNG NGÔN NGỮ KỸ THUẬT THỰC TẾ:

Hạng 1: ${top3[0]?.name || '—'}
Hạng 2: ${top3[1]?.name || '—'}
Hạng 3: ${top3[2]?.name || '—'}

DIỄN GIẢI CÁC CHỈ SỐ ĐO LƯỜNG TỔNG QUÁT:
• Tỷ lệ công suất (P đo / P tính toán):
  ${explainRatio(ratio)}

• Số pha CT đấu ngược:
  ${explainFlipped(m.numFlipped)}

• Hiện tượng góc lệch 120°:
  ${explainHas120(m.has120)}

• Phân tích từng pha${m.hasPabc ? ' (dựa trên công suất đo Pa/Pb/Pc — độ tin cậy cao)' : ' (dựa trên góc lệch phi — không có Pa/Pb/Pc)'}:
${phaLines.map(l=>'  - '+l).join('\n')}

PHÂN TÍCH CHI TIẾT TỪNG TRƯỜNG HỢP — LÝ DO VÀ ĐẶC TRƯNG:
${thFeatureLines}

HÌNH ẢNH:
  Hình 1 = Giản đồ thực tế (phân tích chính)
${refImages.map(r=>`  Hình ${r.index+1} = Mẫu tham chiếu: ${r.name}`).join('\n')}

QUAN TRỌNG — BẮT BUỘC PHÂN TÍCH ĐỦ 3 HẠNG:
Phải viết đủ ▶ Hạng 1, ▶ Hạng 2, VÀ ▶ Hạng 3 trước khi viết phần Gợi ý.
Nếu phân tích mỗi hạng ngắn gọn để đủ chỗ cho cả 3 hạng.
Mỗi hạng cần có: Lý do số liệu + Đặc trưng giản đồ + Đối chiếu Hình 1 + Kết luận KHỚP/KHÔNG KHỚP.
Dùng ngôn ngữ thực tế, không dùng ký hiệu toán học khó hiểu.`;

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
