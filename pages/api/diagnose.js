// ================================================================
// THUẦN JAVASCRIPT — Naive Bayes v6.5
// Fix Bug 1: Pa_do=0 hợp lệ
// Fix Bug 2: Cảnh báo tải lệch khi không có Pa/Pb/Pc
// Fix Bug 4: TH5 false positive với threshold sr chặt hơn
// ================================================================

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    return res.status(200).json(diagnose(req.body));
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi tính toán: ' + err.message });
  }
}

function diagnose(body) {
  const { Ua, Ub, Uc, Ia, Ib, Ic, phiA, phiB, phiC, phiMode, Ptotal, Pa_do, Pb_do, Pc_do } = body;
  const PI = Math.PI;

  // Chuẩn hóa phi về [-180, +180]
  function eff(phi) {
    let p = parseFloat(phi) || 0;
    if (phiMode === '360' && p > 180) p -= 360;
    return p;
  }
  const eA = eff(phiA), eB = eff(phiB), eC = eff(phiC);

  const ua = parseFloat(Ua)||0, ub = parseFloat(Ub)||0, uc = parseFloat(Uc)||0;
  const ia = parseFloat(Ia)||0, ib = parseFloat(Ib)||0, ic = parseFloat(Ic)||0;
  const pdo = parseFloat(Ptotal)||0;

  // ── BUG 1 FIX: Pa_do=0 là số liệu hợp lệ ─────────────────────
  // Chỉ coi là "chưa nhập" khi trường thực sự rỗng (null/undefined/"")
  // Giá trị 0 là hợp lệ (tải thuần cảm Pa có thể = 0)
  function isEntered(v) {
    return v !== '' && v !== null && v !== undefined && String(v).trim() !== '';
  }
  const hasPa = isEntered(Pa_do);
  const hasPb = isEntered(Pb_do);
  const hasPc = isEntered(Pc_do);
  const hasPabc = hasPa || hasPb || hasPc;

  const pa_do = hasPa ? parseFloat(Pa_do) : null;
  const pb_do = hasPb ? parseFloat(Pb_do) : null;
  const pc_do = hasPc ? parseFloat(Pc_do) : null;

  // Tính P từng pha
  const Pa = ua * ia * Math.cos(eA * PI / 180);
  const Pb = ub * ib * Math.cos(eB * PI / 180);
  const Pc = uc * ic * Math.cos(eC * PI / 180);
  const Pcalc = Math.abs(Pa) + Math.abs(Pb) + Math.abs(Pc);
  const ratio = Pcalc < 0.001
    ? (Math.abs(pdo) < 0.001 ? 0 : 9.99)
    : pdo / Pcalc;

  // ratioX từng pha
  const rA = hasPa && Math.abs(Pa) > 0.001 ? pa_do / Math.abs(Pa) : null;
  const rB = hasPb && Math.abs(Pb) > 0.001 ? pb_do / Math.abs(Pb) : null;
  const rC = hasPc && Math.abs(Pc) > 0.001 ? pc_do / Math.abs(Pc) : null;

  // Phát hiện flip
  const flipA = hasPabc ? (rA !== null ? rA < -0.5 : Math.abs(eA) > 90) : Math.abs(eA) > 90;
  const flipB = hasPabc ? (rB !== null ? rB < -0.5 : Math.abs(eB) > 90) : Math.abs(eB) > 90;
  const flipC = hasPabc ? (rC !== null ? rC < -0.5 : Math.abs(eC) > 90) : Math.abs(eC) > 90;
  const numFlipped = [flipA, flipB, flipC].filter(Boolean).length;

  // Missing
  const numMissing = [
    ia < 0.01 || ua < 0.01,
    ib < 0.01 || ub < 0.01,
    ic < 0.01 || uc < 0.01,
  ].filter(Boolean).length;

  // has120offset — đặc trưng TH5
  // Bug 4 Fix: loại bỏ cặp có |phi|>140° (đó là CT flip, không phải TH5)
  function angDiff(a, b) { let d = Math.abs(a - b); return d > 180 ? 360 - d : d; }
  const dAB = angDiff(eA, eB), dBC = angDiff(eB, eC), dAC = angDiff(eA, eC);
  function has120Check(p1, p2, diff) {
    if (Math.abs(p1) > 140 || Math.abs(p2) > 140) return false; // CT flip → bỏ qua
    return Math.abs(diff - 120) < 25;
  }
  const has120 = has120Check(eA,eB,dAB) || has120Check(eB,eC,dBC) || has120Check(eA,eC,dAC);

  // ── BUG 2 FIX: Phát hiện tải lệch ────────────────────────────
  // Khi không có Pa/Pb/Pc, tải lệch mạnh làm ratio không đáng tin
  const iVals = [ia, ib, ic].filter(v => v > 0.01);
  // Dùng spread riêng, không trộn fallback vào tham số Math.min/max
  const iMax = iVals.length > 0 ? Math.max(...iVals) : 0.001;
  const iMin = iVals.length > 0 ? Math.min(...iVals) : 0.001;
  const imbalanceRatio = iVals.length >= 2 ? iMax / iMin : 1;
  const isHighlyUnbalanced = !hasPabc && imbalanceRatio > 2.0;

  // Số pha ratio âm
  const numNeg = [rA, rB, rC].filter(r => r !== null && r < -0.5).length;

  // ── NAIVE BAYES SCORING ─────────────────────────────────────────
  function sr(r, exp, t1=0.20, t2=0.40) {
    const d = Math.abs(r - exp);
    if (d <= t1) return 1.0;
    if (d <= t2) return 0.5;
    return 0.02;
  }

  // ── BUG 4 FIX: TH5 dùng threshold chặt hơn (±0.15, ±0.30) ───
  // Tránh false positive khi tải lệch gây has120=True nhưng ratio≠0
  function sr_th5(r, exp) {
    const d = Math.abs(r - exp);
    if (d <= 0.15) return 1.0;  // Chặt hơn TH thường (0.20)
    if (d <= 0.30) return 0.5;  // Chặt hơn TH thường (0.40)
    return 0.02;
  }

  function sf(nf, exp) {
    if (nf === exp) return 1.0;
    if (Math.abs(nf-exp) === 1) return 0.1;
    return 0.02;
  }
  function sm(nm, exp) {
    if (nm === exp) return 1.0;
    if (Math.abs(nm-exp) <= 1) return 0.1;
    return 0.02;
  }
  function s1(has, exp) { return has === exp ? 1.0 : 0.02; }
  function sp(nn, exp) { return hasPabc ? (nn === exp ? 1.0 : 0.02) : 1.0; }

  // Khi tải lệch mạnh & không có Pa/Pb/Pc → giảm trọng số sr()
  function srAdapted(r, exp) {
    if (isHighlyUnbalanced) {
      // Giảm độ tin cậy của ratio khi tải lệch: không phạt nặng các TH khác
      const d = Math.abs(r - exp);
      if (d <= 0.40) return 0.7;  // Không phân biệt được chắc chắn
      return 0.1;
    }
    return sr(r, exp);
  }

  const cases = [
    {
      key: 'Binh_thuong',
      name: 'Đấu dây đúng cực tính',
      desc: 'P đo = P tính toán. Hệ thống vận hành đúng.',
      action: 'Không cần xử lý. Hệ thống hoạt động bình thường.',
      score: srAdapted(ratio,1.0) * sf(numFlipped,0) * sm(numMissing,0) * s1(has120,false) * sp(numNeg,0),
    },
    {
      key: 'TH1',
      name: 'TH1: Mất điện áp hoặc dòng 1 pha',
      desc: 'P = 2/3 × P₃pha. 1 pha mất tín hiệu CT hoặc VT.',
      action: 'Kiểm tra cầu chì nhi thứ, đứt dây CT/VT pha có I=0 hoặc U=0.',
      score: srAdapted(ratio,0.667) * sf(numFlipped,0) * sm(numMissing,1) * s1(has120,false) * sp(numNeg,0),
    },
    {
      key: 'TH2',
      name: 'TH2: Đảo cực tính dòng 1 pha',
      desc: 'P = 1/3 × P₃pha. 1 CT đấu ngược chiều.',
      action: 'Đổi đầu S1↔S2 của CT pha có |φ|>90° trên giản đồ vector.',
      score: srAdapted(ratio,0.333) * sf(numFlipped,1) * sm(numMissing,0) * s1(has120,false) * sp(numNeg,1),
    },
    {
      key: 'TH3',
      name: 'TH3: Đảo cực tính dòng 2 pha',
      desc: 'P = −1/3 × P₃pha. 2 CT đấu ngược chiều.',
      action: 'Đổi đầu S1↔S2 của 2 CT pha có |φ|>90° trên giản đồ vector.',
      score: srAdapted(ratio,-0.333) * sf(numFlipped,2) * sm(numMissing,0) * s1(has120,false) * sp(numNeg,2),
    },
    {
      key: 'TH4',
      name: 'TH4: Đảo cực tính cả 3 dòng',
      desc: 'P = −P₃pha. Toàn bộ CT ngược. Đồng hồ quay ngược.',
      action: 'Đổi đầu S1↔S2 cả 3 CT hoặc kiểm tra toàn bộ chiều đấu dây.',
      score: srAdapted(ratio,-1.0) * sf(numFlipped,3) * sm(numMissing,0) * s1(has120,false) * sp(numNeg,3),
    },
    {
      key: 'TH5',
      name: 'TH5: Đấu sai dòng và áp 2 pha',
      desc: 'P ≈ 0. Cáp nhi thứ CT & VT đổi chéo 2 pha.',
      action: 'Hoán đổi lại cáp nhi thứ CT và VT giữa 2 pha bị đổi chéo.',
      // Bug 4 Fix: dùng sr_th5() chặt hơn — loại bỏ false positive
      score: sr_th5(ratio,0.0) * 1.0 * sm(numMissing,0) * s1(has120,true),
    },
    {
      key: 'TH6',
      name: 'TH6: Đảo 2 cuộn áp VT + 2 dòng CT',
      desc: 'P = 2/3 × P₃pha. 2 VT đổi pha + 2 CT bị đảo.',
      action: 'Đặt lại 2 cuộn áp VT đúng pha + đổi S1↔S2 của 2 CT tương ứng.',
      score: srAdapted(ratio,0.667) * (numFlipped>=1?1.0:0.1) * sm(numMissing,0) * s1(has120,false) * sp(numNeg,2),
    },
  ];

  const total = cases.reduce((s,c) => s+c.score, 0) || 0.0001;
  cases.forEach(c => c.pct = c.score/total*100);
  const sorted = [...cases].sort((a,b) => b.score-a.score);

  // Cảnh báo tải lệch
  const warnings = [];
  if (isHighlyUnbalanced) {
    warnings.push(`UNBALANCED_NO_PABC:${imbalanceRatio.toFixed(1)}`);
  }

  return {
    metrics: {
      Pcalc: Pcalc.toFixed(2)+'W',
      P_ratio: ratio.toFixed(4),
      numFlipped,
      numMissing,
      has120,
      hasPabc,
      isHighlyUnbalanced,
      imbalanceRatio: imbalanceRatio.toFixed(1),
      ratioA: rA!==null ? rA.toFixed(3) : null,
      ratioB: rB!==null ? rB.toFixed(3) : null,
      ratioC: rC!==null ? rC.toFixed(3) : null,
    },
    warnings,
    results: sorted.slice(0,3).map((c,i) => ({
      rank: i+1,
      name: c.name,
      desc: c.desc,
      action: c.action,
      // Breakdown điểm từng thành phần — để AI giải thích tại sao
      scoreBreakdown: buildBreakdown(c.key, ratio, numFlipped, numMissing, has120, numNeg, hasPabc, isHighlyUnbalanced),
    })),
  };
}

// Xây dựng giải thích điểm từng TH — dùng ngôn ngữ thực tế, không ký hiệu kỹ thuật
function buildBreakdown(key, ratio, numFlipped, numMissing, has120, numNeg, hasPabc, isHighlyUnbalanced) {
  const lines = [];
  const pct = Math.abs(ratio * 100).toFixed(0);

  // Giải thích tỷ lệ công suất
  const ratioMap = {
    'Binh_thuong': { exp: 1.0,    lythuyet: '100%',      nghia: 'điện kế ghi đúng toàn bộ công suất' },
    'TH1':         { exp: 0.667,  lythuyet: 'khoảng 67%', nghia: '1 pha mất tín hiệu nên mất 1/3 công suất' },
    'TH2':         { exp: 0.333,  lythuyet: 'khoảng 33%', nghia: '1 CT đấu ngược làm mất 2/3 công suất' },
    'TH3':         { exp: -0.333, lythuyet: 'âm 33%',    nghia: '2 CT đấu ngược làm điện kế ghi ngược' },
    'TH4':         { exp: -1.0,   lythuyet: 'âm 100%',   nghia: 'toàn bộ CT đảo, điện kế quay ngược hoàn toàn' },
    'TH5':         { exp: 0.0,    lythuyet: 'gần bằng 0', nghia: 'đổi chéo 2 pha làm triệt tiêu công suất' },
    'TH6':         { exp: 0.667,  lythuyet: 'khoảng 67%', nghia: '2 VT + 2 CT bị đảo' },
  };
  const rm = ratioMap[key];
  if (rm) {
    const diff = Math.abs(ratio - rm.exp);
    const match = diff <= 0.20 ? 'khớp tốt' : diff <= 0.40 ? 'khớp một phần' : 'lệch nhiều';
    lines.push(`Điện kế đang ghi ${pct}% công suất thực, trường hợp này lý thuyết phải là ${rm.lythuyet} (${rm.nghia}) — ${match}`);
  }

  // Giải thích số CT đấu ngược
  const flipMap = { 'Binh_thuong':0,'TH1':0,'TH2':1,'TH3':2,'TH4':3,'TH5':-1,'TH6':1 };
  const expFlip = flipMap[key];
  if (expFlip === -1) {
    lines.push(`Trường hợp đổi chéo cáp 2 pha không xét số CT đấu ngược`);
  } else if (expFlip === 0) {
    lines.push(numFlipped === 0
      ? `Không có CT nào đấu ngược — đúng với yêu cầu của trường hợp này`
      : `Trường hợp này không có CT đảo nhưng phát hiện ${numFlipped} CT đấu ngược — không khớp`);
  } else {
    lines.push(numFlipped === expFlip
      ? `Phát hiện đúng ${numFlipped} CT đấu ngược chiều — khớp với yêu cầu của trường hợp này`
      : `Trường hợp này cần ${expFlip} CT đảo, nhưng phát hiện ${numFlipped} — ${numFlipped < expFlip ? 'ít hơn' : 'nhiều hơn'} yêu cầu`);
  }

  // Mất tín hiệu
  if (key === 'TH1') {
    lines.push(numMissing === 1
      ? `Xác nhận đúng 1 pha không có dòng điện hoặc điện áp — đặc trưng của mất tín hiệu 1 pha`
      : `Không thấy pha nào mất hoàn toàn tín hiệu — không khớp với đặc trưng mất 1 pha`);
  } else if (numMissing > 0) {
    lines.push(`Có ${numMissing} pha không có tín hiệu, trong khi trường hợp này không có mất tín hiệu — bất lợi`);
  }

  // Góc lệch 120° — chỉ đề cập khi liên quan
  if (key === 'TH5') {
    lines.push(has120
      ? `Phát hiện hiện tượng lệch góc 120° bất thường giữa các pha — đây là dấu hiệu đặc trưng nhất của đổi chéo cáp 2 pha`
      : `Không có hiện tượng lệch góc 120° bất thường — đây là thiếu sót lớn cho khả năng đổi chéo cáp`);
  } else if (has120) {
    lines.push(`Phát hiện lệch góc bất thường 120° giữa các pha — không phải đặc trưng của trường hợp này, bất lợi`);
  }

  // Số pha có công suất âm — chỉ khi có đủ dữ liệu từng pha
  if (hasPabc && numNeg !== undefined) {
    const negMap = { 'Binh_thuong':0,'TH1':0,'TH2':1,'TH3':2,'TH4':3,'TH5':-1,'TH6':2 };
    const expNeg = negMap[key];
    if (expNeg !== -1) {
      const actual = `${numNeg} pha có công suất đo âm`;
      const expected = expNeg === 0 ? 'không có pha nào âm' : `${expNeg} pha âm`;
      lines.push(numNeg === expNeg
        ? `Có đúng ${actual} — khớp chính xác với yêu cầu của trường hợp này (cần ${expected})`
        : `Có ${actual} trong khi trường hợp này cần ${expected} — không khớp`);
    }
  }

  // ── Giải thích ratio_abs — căn cứ thứ 5: P_trị_tuyệt_đối / Pcalc ──
  if (ratioAbs !== null && (key === 'TH1' || key === 'TH6')) {
    const pct = (ratioAbs * 100).toFixed(0);
    if (key === 'TH1') {
      if (ratioAbs < 0.90) {
        lines.push(`Tổng trị tuyệt đối công suất đo từng pha = ${pct}% so với tính toán — thấp hơn 100% vì có pha đóng góp gần bằng 0 → KHỚP với mất tín hiệu 1 pha`);
      } else {
        lines.push(`Tổng trị tuyệt đối công suất đo từng pha = ${pct}% so với tính toán — gần 100%, cả 3 pha đều đóng góp công suất → KHÔNG KHỚP với mất tín hiệu (điểm trừ cho TH1)`);
      }
    } else {
      if (ratioAbs > 0.90) {
        lines.push(`Tổng trị tuyệt đối công suất đo từng pha = ${pct}% so với tính toán — gần 100%, xác nhận cả 3 pha đều đóng góp công suất dù 2 pha bị đảo chiều → KHỚP với TH6`);
      } else {
        lines.push(`Tổng trị tuyệt đối công suất đo từng pha = ${pct}% so với tính toán — thấp hơn 100%, gợi ý có pha yếu → KHÔNG KHỚP với TH6 (điểm trừ)`);
      }
    }
  }

  // Tải lệch
  if (isHighlyUnbalanced) {
    lines.push(`Lưu ý: Dòng điện các pha chênh lệch nhau nhiều nên tỷ lệ công suất kém tin cậy khi không có số liệu từng pha`);
  }

  return lines;
}
