// ================================================================
// TÍNH TOÁN HOÀN TOÀN BẰNG JAVASCRIPT — không nhờ Claude tính số
// Claude chỉ viết kết luận bằng tiếng Việt
// ================================================================

function diagnoseAlgorithm(body) {
  const { Ua, Ub, Uc, Ia, Ib, Ic, phiA, phiB, phiC, phiMode, Ptotal, Pa_do, Pb_do, Pc_do } = body;
  const PI = Math.PI;

  // Chuẩn hóa phi về [-180, +180]
  function eff(phi) {
    let p = parseFloat(phi) || 0;
    if (phiMode === '360' && p > 180) p -= 360;
    return p;
  }
  const eA = eff(phiA), eB = eff(phiB), eC = eff(phiC);

  // Parse
  const ua = parseFloat(Ua)||0, ub = parseFloat(Ub)||0, uc = parseFloat(Uc)||0;
  const ia = parseFloat(Ia)||0, ib = parseFloat(Ib)||0, ic = parseFloat(Ic)||0;
  const pdo = parseFloat(Ptotal)||0;
  const pa_do = Pa_do !== '' && Pa_do !== null && Pa_do !== undefined ? parseFloat(Pa_do) : null;
  const pb_do = Pb_do !== '' && Pb_do !== null && Pb_do !== undefined ? parseFloat(Pb_do) : null;
  const pc_do = Pc_do !== '' && Pc_do !== null && Pc_do !== undefined ? parseFloat(Pc_do) : null;
  const hasPabc = pa_do !== null || pb_do !== null || pc_do !== null;

  // Tính P từng pha
  const Pa = ua * ia * Math.cos(eA * PI / 180);
  const Pb = ub * ib * Math.cos(eB * PI / 180);
  const Pc = uc * ic * Math.cos(eC * PI / 180);
  const Pcalc = Math.abs(Pa) + Math.abs(Pb) + Math.abs(Pc);
  const ratio = Pcalc < 0.001 ? (Math.abs(pdo) < 0.001 ? 0 : 9.99) : pdo / Pcalc;

  // ratioX từng pha (nếu có Pa/Pb/Pc)
  const rA = hasPabc && Math.abs(Pa) > 0.001 ? (pa_do || 0) / Math.abs(Pa) : null;
  const rB = hasPabc && Math.abs(Pb) > 0.001 ? (pb_do || 0) / Math.abs(Pb) : null;
  const rC = hasPabc && Math.abs(Pc) > 0.001 ? (pc_do || 0) / Math.abs(Pc) : null;

  // Phát hiện flip
  const flipA = hasPabc ? (rA !== null ? rA < -0.5 : false) : Math.abs(eA) > 90;
  const flipB = hasPabc ? (rB !== null ? rB < -0.5 : false) : Math.abs(eB) > 90;
  const flipC = hasPabc ? (rC !== null ? rC < -0.5 : false) : Math.abs(eC) > 90;
  const numFlipped = [flipA, flipB, flipC].filter(Boolean).length;

  // Missing
  const missA = ia < 0.01 || ua < 0.01;
  const missB = ib < 0.01 || ub < 0.01;
  const missC = ic < 0.01 || uc < 0.01;
  const numMissing = [missA, missB, missC].filter(Boolean).length;

  // has120offset
  function angDiff(a, b) { let d = Math.abs(a - b); return d > 180 ? 360 - d : d; }
  const dAB = angDiff(eA, eB), dBC = angDiff(eB, eC), dAC = angDiff(eA, eC);
  const has120 = Math.abs(dAB - 120) < 25 || Math.abs(dBC - 120) < 25 || Math.abs(dAC - 120) < 25;

  // numNeg: số pha có ratioX < -0.5
  const numNeg = hasPabc ? [rA, rB, rC].filter(r => r !== null && r < -0.5).length : 0;

  // ── NAIVE BAYES SCORING ──────────────────────────────────────
  function sratio(r, exp, t1 = 0.20, t2 = 0.40) {
    const d = Math.abs(r - exp);
    if (d <= t1) return 1.0;
    if (d <= t2) return 0.5;
    return 0.02;
  }
  function sflip(nf, exp) {
    if (nf === exp) return 1.0;
    if (Math.abs(nf - exp) === 1) return 0.1;
    return 0.02;
  }
  function smiss(nm, exp) {
    if (nm === exp) return 1.0;
    if (Math.abs(nm - exp) <= 1) return 0.1;
    return 0.02;
  }
  function s120(has, exp) { return has === exp ? 1.0 : 0.02; }
  function spabc(nn, exp) { return hasPabc ? (nn === exp ? 1.0 : 0.02) : 1.0; }

  const cases = [
    {
      id: 0, key: 'Binh_thuong',
      name: 'Đấu dây đúng cực tính',
      desc: 'P_đo = P_tính toán. Hệ thống vận hành đúng.',
      action: 'Không cần xử lý. Hệ thống hoạt động bình thường.',
      score: sratio(ratio,1.0) * sflip(numFlipped,0) * smiss(numMissing,0) * s120(has120,false) * spabc(numNeg,0)
    },
    {
      id: 1, key: 'TH1',
      name: 'TH1: Mất điện áp hoặc dòng 1 pha',
      desc: 'P = 2/3 × P₃pha. 1 pha mất tín hiệu CT hoặc VT.',
      action: 'Kiểm tra cầu chì nhi thứ, đứt dây CT/VT pha có I=0 hoặc U=0.',
      score: sratio(ratio,0.667) * sflip(numFlipped,0) * smiss(numMissing,1) * s120(has120,false) * spabc(numNeg,0)
    },
    {
      id: 2, key: 'TH2',
      name: 'TH2: Đảo cực tính dòng 1 pha',
      desc: 'P = 1/3 × P₃pha. 1 CT đấu ngược.',
      action: 'Đổi đầu S1↔S2 của CT pha có |φ|>90° (hoặc ratioX âm).',
      score: sratio(ratio,0.333) * sflip(numFlipped,1) * smiss(numMissing,0) * s120(has120,false) * spabc(numNeg,1)
    },
    {
      id: 3, key: 'TH3',
      name: 'TH3: Đảo cực tính dòng 2 pha',
      desc: 'P = −1/3 × P₃pha. 2 CT đấu ngược.',
      action: 'Đổi đầu S1↔S2 của 2 CT tương ứng 2 pha có |φ|>90°.',
      score: sratio(ratio,-0.333) * sflip(numFlipped,2) * smiss(numMissing,0) * s120(has120,false) * spabc(numNeg,2)
    },
    {
      id: 4, key: 'TH4',
      name: 'TH4: Đảo cực tính cả 3 dòng',
      desc: 'P = −P₃pha. Toàn bộ CT ngược. Đồng hồ quay ngược.',
      action: 'Đổi đầu S1↔S2 cả 3 CT hoặc kiểm tra toàn bộ chiều đấu dây.',
      score: sratio(ratio,-1.0) * sflip(numFlipped,3) * smiss(numMissing,0) * s120(has120,false) * spabc(numNeg,3)
    },
    {
      id: 5, key: 'TH5',
      name: 'TH5: Đấu sai dòng và áp 2 pha',
      desc: 'P ≈ 0. Cáp nhi thứ CT & VT đổi chéo 2 pha.',
      action: 'Hoán đổi lại cáp nhi thứ CT và VT giữa 2 pha bị đổi chéo.',
      score: sratio(ratio,0.0) * 1.0 * smiss(numMissing,0) * s120(has120,true)
      // TH5: flip bất kỳ (pf=1.0), has120=True là đặc trưng chính
    },
    {
      id: 6, key: 'TH6',
      name: 'TH6: Đảo 2 cuộn áp VT + 2 dòng CT',
      desc: 'P = 2/3 × P₃pha. 2 VT đổi pha + 2 CT bị đảo.',
      action: 'Đặt lại 2 cuộn áp VT đúng pha + đổi S1↔S2 của 2 CT tương ứng.',
      score: sratio(ratio,0.667) * (numFlipped >= 1 ? 1.0 : 0.1) * smiss(numMissing,0) * s120(has120,false) * spabc(numNeg,2)
    },
  ];

  // Chuẩn hóa %
  const total = cases.reduce((s, c) => s + c.score, 0) || 0.0001;
  cases.forEach(c => c.pct = c.score / total * 100);

  // Xếp hạng
  const sorted = [...cases].sort((a, b) => b.score - a.score);

  return {
    metrics: {
      Pcalc: Pcalc.toFixed(2) + 'W',
      P_ratio: ratio.toFixed(4),
      numFlipped,
      numMissing,
      has120,
      hasPabc,
      ratioA: rA !== null ? rA.toFixed(3) : null,
      ratioB: rB !== null ? rB.toFixed(3) : null,
      ratioC: rC !== null ? rC.toFixed(3) : null,
    },
    sorted,
    top3: sorted.slice(0, 3),
  };
}

// System prompt CHỈ viết kết luận — không tính toán
const CONCLUSION_PROMPT = `Bạn là chuyên gia điện. Dựa vào kết quả chẩn đoán đã tính toán sẵn, hãy viết 1 câu kết luận ngắn gọn bằng tiếng Việt (tối đa 25 chữ) theo mẫu: "[Tên TH]: [pha nào bị lỗi nếu biết]. [Hành động ưu tiên ngắn gọn]."
Trả về CHỈ câu kết luận, không thêm gì khác.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key chưa được cấu hình trên server' });

  try {
    // 1. Tính toán bằng JS — chắc chắn 100%
    const { metrics, top3 } = diagnoseAlgorithm(req.body);

    // 2. Nhờ Claude viết kết luận (không tính toán)
    const userMsg = `Kết quả chẩn đoán:
- Hạng 1: ${top3[0].name} (${top3[0].pct.toFixed(1)}%)
- Hạng 2: ${top3[1].name} (${top3[1].pct.toFixed(1)}%)
- Tỷ lệ P_đo/P_tính: ${metrics.P_ratio}
- Số pha bị đảo: ${metrics.numFlipped}
- has120offset: ${metrics.has120}
${metrics.hasPabc ? `- ratioA=${metrics.ratioA}, ratioB=${metrics.ratioB}, ratioC=${metrics.ratioC}` : ''}
Viết kết luận 1 câu ngắn.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 120,
        system: CONCLUSION_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    let conclusion = top3[0].name + '. ' + top3[0].action;
    if (resp.ok) {
      const data = await resp.json();
      conclusion = data.content[0].text.trim();
    }

    return res.status(200).json({
      metrics,
      results: top3.map((c, i) => ({
        rank: i + 1,
        name: c.name,
        desc: c.desc,
        action: c.action,
        pct: c.pct.toFixed(1),
      })),
      conclusion,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi xử lý: ' + err.message });
  }
}
