// ══════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE — Kiến thức chọn lọc theo trường hợp cần phân tích
// ══════════════════════════════════════════════════════════════════

const KB_CORE = `
KIẾN THỨC CỐT LÕI:
• Pcalc = |Pa_tính| + |Pb_tính| + |Pc_tính| (tổng trị tuyệt đối — không phải đại số)
• P_ratio = P_đo_tổng / Pcalc
• CT đảo: có Pa/Pb/Pc → ratioX = Px_do/|Px_tính| < −0.5 | không có → |eff_phi| > 90°
• Phi gốc 360°: nếu phi > 180° thì eff_phi = phi − 360° (công tơ Elster, Iskra)
• Tải bù dư có phi âm (ví dụ −70°) là BÌNH THƯỜNG — không phải CT đảo
• ratio_abs = (|Pa_do|+|Pb_do|+|Pc_do|) / Pcalc — chỉ tính khi có Pa/Pb/Pc
  → ≈ 1.0: tất cả pha đều đóng góp công suất (kể cả pha bị đảo chiều)
  → < 1.0: có pha đóng góp gần bằng 0 → dấu hiệu mất tín hiệu (TH1)
• Đọc giản đồ: chỉ xét nét đứt cùng màu ngược nét liền cùng màu — không so với màu khác
• QUAN TRỌNG — phi ≈ 0°: khi góc lệch rất nhỏ (gần 0°), nét đứt I gần như trùng với nét liền U cùng màu
  → Nhìn như chỉ có 1 nét nhưng thực ra 2 nét chồng nhau — KHÔNG phải mất tín hiệu
  → Dấu hiệu nhận biết: có vẽ cung tròn nhỏ gần tâm (cung phi) và chiều lệch 6° so với U
  → Ví dụ: phiC = 359° (gốc 360°) → eff = −1° → Ic gần như trùng Uc → bình thường
`;

const KB_BY_TH = {
  Binh_thuong: `
BÌNH THƯỜNG:
• Giản đồ: cả 3 nét đứt CÙNG PHÍA nét liền cùng màu, lệch góc nhỏ theo chiều tải
• P_ratio ≈ +1.0 | tất cả ratioX ≈ +1.0 | ratio_abs ≈ 1.0
`,
  TH1: `
TH1 — Mất tín hiệu 1 pha:
• Giản đồ: THIẾU HẲN 1 nét đứt — không có Ia, Ib hoặc Ic
• P_ratio ≈ +0.67 tải cân bằng; thay đổi nhiều khi tải lệch:
  → Mất pha mạnh: P_ratio thấp hẳn | Mất pha yếu: P_ratio gần 1.0 → dễ bỏ sót
• Khi có Pa/Pb/Pc: đúng 1 pha |Px_do| ≈ 0 | ratio_abs < 1.0
`,
  TH2: `
TH2 — Đảo CT 1 pha:
• Giản đồ: đúng 1 nét đứt nằm PHÍA ĐỐI DIỆN nét liền cùng màu (qua tâm ~180°)
• P_ratio ≈ +0.33 tải cân bằng; thay đổi nhiều khi tải lệch:
  → Đảo pha mạnh: P_ratio có thể âm → dễ nhầm TH3
  → Đảo pha yếu: P_ratio gần +0.9 → dễ nhầm bình thường hoặc TH1
• Khi có Pa/Pb/Pc: đúng 1 pha ratioX ≈ −1.0 | ratio_abs ≈ 1.0
`,
  TH3: `
TH3 — Đảo CT 2 pha:
• Giản đồ: đúng 2 nét đứt nằm phía đối diện nét liền cùng màu
• P_ratio ≈ −0.33 (âm) | 2 pha ratioX ≈ −1.0 | ratio_abs ≈ 1.0
• Tải lệch: nếu 2 pha đảo là pha mạnh → P_ratio âm sâu, dễ nhầm TH4
`,
  TH4: `
TH4 — Đảo CT cả 3 pha:
• Giản đồ: cả 3 nét đứt đều phía đối diện nét liền cùng màu — đối xứng nhưng ngược hoàn toàn
• P_ratio ≈ −1.0 | cả 3 pha ratioX ≈ −1.0 | ratio_abs ≈ 1.0
`,
  TH5: `
TH5 — Hoán vị cáp nhi thứ CT và VT giữa 2 pha:
• Giản đồ: 1 nét đứt NẰM Ở VỊ TRÍ PHA KHÁC — lệch ~120° bất thường (không phải ngược chiều qua tâm)
• P_ratio ≈ 0 | has120 = True là DẤU HIỆU ĐẶC TRƯNG
• Phải loại cặp |phi|>140° trước khi kiểm tra has120 (đó là CT flip, không phải TH5)
• Không có pha I=0 | không có CT đảo chiều riêng lẻ
`,
  TH6: `
TH6 — Đảo 2 cuộn áp VT và đảo 2 CT tương ứng:
• Giản đồ: ĐỦ 3 nét đứt không thiếu, nhưng 2 nét đứt nằm sai chiều
• P_ratio ≈ +0.67 — GIỐNG HỆT TH1 → dễ nhầm nhất
• Khi có Pa/Pb/Pc: đúng 2 pha ratioX ≈ −1.0 | ratio_abs ≈ 1.0
`,
};

const KB_DISTINGUISH = {
  // ── Cặp ratio BẰNG NHAU ───────────────────────────────────────
  'TH1+TH6': `
⚠️ TH1 và TH6 có tỷ lệ công suất BẰNG NHAU (~67%) — KHÓ PHÂN BIỆT NHẤT:
(1) Giản đồ: TH1 THIẾU 1 nét đứt | TH6 ĐỦ 3 nét đứt nhưng 2 pha ngược chiều
(2) ratio_abs: TH1 < 1.0 (pha mất đóng góp ≈ 0) | TH6 ≈ 1.0 (cả 3 pha đều có |P|)
(3) Số pha âm: TH1 = 0 pha âm | TH6 = 2 pha âm
Lưu ý: Ia trông ngược Ub là tình cờ hình học — không phải lỗi đấu dây.
`,
  // ── Cặp ratio GẦN NHAU (Δ ≤ 0.35) ───────────────────────────
  'Binh_thuong+TH1': `
Bình thường vs TH1: TH1 mất pha yếu có P_ratio gần 1.0 → dễ nhầm bình thường.
Phân biệt: có thiếu nét đứt không? Có Pa/Pb/Pc → xem pha nào |Px_do| ≈ 0.
`,
  'Binh_thuong+TH6': `
Bình thường vs TH6: ratio gần nhau (1.0 vs 0.67).
Phân biệt: bình thường tất cả nét đứt cùng phía nét liền | TH6 có 2 nét đứt ngược chiều.
Khi có Pa/Pb/Pc: bình thường mọi ratioX ≈ +1 | TH6 có 2 pha ratioX ≈ −1.
`,
  'TH1+TH2': `
TH1 vs TH2: TH2 đảo pha yếu có P_ratio ≈ 0.9 → dễ nhầm TH1.
Phân biệt: TH1 thiếu 1 nét đứt, ratio_abs < 1.0 | TH2 đủ 3 nét đứt, ratio_abs ≈ 1.0.
`,
  'TH2+TH5': `
TH2 vs TH5: ratio gần nhau (0.33 vs 0.00).
TH5: nét đứt LẠC vị trí (không ngược chiều mà ở góc phần tư pha khác) | P ≈ 0 | has120 = True.
TH2: nét đứt NGƯỢC CHIỀU qua tâm | P ≈ 1/3 | không có góc lệch 120°.
`,
  'TH2+TH6': `
TH2 vs TH6: ratio gần nhau (0.33 vs 0.67).
TH2: 1 nét đứt ngược chiều, 1 pha ratioX ≈ −1.
TH6: 2 nét đứt ngược chiều, 2 pha ratioX ≈ −1.
`,
  'TH3+TH5': `
TH3 vs TH5: ratio gần nhau (−0.33 vs 0.00).
TH5: P_ratio ≈ 0, has120 = True, nét đứt lạc vị trí.
TH3: P_ratio ≈ −0.33 (âm), không có góc lệch 120°, nét đứt ngược chiều đúng góc phần tư.
`,
  // ── Cặp tải lệch dễ nhầm dù ratio khác rõ ────────────────────
  'Binh_thuong+TH2': `
Tải lệch: TH2 đảo pha YẾU có P_ratio gần 1.0 → dễ nhầm bình thường.
Phân biệt DUY NHẤT: nhìn kỹ 1 nét đứt có ngược chiều không | kiểm tra ratioX pha nghi ngờ.
ratio_abs không phân biệt được (cả hai đều ≈ 1.0).
`,
  'TH2+TH3': `
Tải lệch: TH2 đảo pha MẠNH có P_ratio âm → dễ nhầm TH3.
Phân biệt: đếm số nét đứt ngược chiều — TH2 = 1 pha ngược | TH3 = 2 pha ngược.
Khi có Pa/Pb/Pc: đếm pha có ratioX < −0.5.
`,
  'TH3+TH4': `
Tải lệch: TH3 đảo 2 pha mạnh có P_ratio rất âm → dễ nhầm TH4.
Phân biệt: TH3 vẫn có 1 nét đứt bình thường | TH4 tất cả 3 nét đứt ngược chiều.
Khi có Pa/Pb/Pc: TH3 có 2 pha ratioX ≈ −1 | TH4 có 3 pha ratioX ≈ −1.
`,
  'TH1+TH5': `
TH1 vs TH5: ratio khác rõ (0.67 vs 0.00) nhưng lưu ý:
TH5 cần đồng thời: P_ratio ≈ 0 VÀ has120 = True — thiếu 1 trong 2 thì không phải TH5.
`,
  'TH4+TH5': `
TH4 vs TH5: ratio khác rõ (−1.0 vs 0.00).
TH4: tất cả nét đứt ngược chiều | P rất âm | không có góc lệch 120°.
TH5: nét đứt lạc vị trí | P ≈ 0 | có góc lệch 120°.
`,
};

export function buildKnowledge(top3Names) {
  const order = { 'Binh_thuong':0,'TH1':1,'TH2':2,'TH3':3,'TH4':4,'TH5':5,'TH6':6 };

  const keys = [...new Set(top3Names.map(name => {
    if (!name) return null;
    for (const k of ['TH1','TH2','TH3','TH4','TH5','TH6']) if (name.includes(k)) return k;
    if (name.includes('Bình')||name.includes('Đúng')||name.includes('Binh')) return 'Binh_thuong';
    return null;
  }).filter(Boolean))];

  let kb = KB_CORE;

  // Thêm kiến thức riêng từng TH
  for (const key of keys) {
    if (KB_BY_TH[key]) kb += KB_BY_TH[key];
  }

  // Thêm kiến thức phân biệt cho TẤT CẢ các cặp trong top3
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const pairKey = [keys[i], keys[j]]
        .sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9))
        .join('+');
      if (KB_DISTINGUISH[pairKey]) kb += KB_DISTINGUISH[pairKey];
    }
  }

  return kb;
}
