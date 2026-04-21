const SYSTEM_PROMPT = `Bạn là chuyên gia chẩn đoán lỗi đấu dây điện kế 3 pha gián tiếp. Sử dụng thuật toán Naive Bayes v6.5.

THUẬT TOÁN TÍNH TOÁN:
1. Chuẩn hóa phi về [-180,+180]: nếu Gốc 360 và phi>180 thì eff_phi = phi-360, ngược lại eff_phi = phi
2. Pa=Ua*Ia*cos(effA_rad), Pb=Ub*Ib*cos(effB_rad), Pc=Uc*Ic*cos(effC_rad)
3. Pcalc = |Pa|+|Pb|+|Pc| (TỔNG TRỊ TUYỆT ĐỐI — không phụ thuộc chiều đấu dây)
4. P_ratio = P_tong_do / Pcalc
5. Phát hiện flip:
   - Nếu CÓ Pa_do/Pb_do/Pc_do: ratioX = Px_do/|Px_tinh|, flipX = (ratioX < -0.5)
   - Nếu KHÔNG: flipX = (|eff_phi_X| > 90)  ← QUAN TRỌNG: phi âm bình thường (bù dư) chỉ có |phi|<90, CT đảo mới có |phi|>90
6. numFlipped = tổng số flip=True
7. missX = (Ix<0.01 OR Ux<0.01), numMissing = tổng
8. phiDiff giữa các pha: nếu có cặp nào ≈120° → has120offset=True (đặc trưng TH5)

CHẤM ĐIỂM NAIVE BAYES (ngưỡng P_ratio: khớp±20%=1.0, gần±40%=0.5, xa=0.02):
- Binh_thuong: ratio≈+1.0, flip=0, miss=0, 120=F → nếu có Pabc: cả 3 ratioX≈+1 (±0.25)
- TH1: ratio≈+0.67, flip=0, miss=1, 120=F → nếu có Pabc: đúng 1 pha ratioX≈0 (<0.25)
- TH2: ratio≈+0.33, flip=1, miss=0, 120=F → nếu có Pabc: đúng 1 pha ratioX<-0.5
- TH3: ratio≈-0.33, flip=2, miss=0, 120=F → nếu có Pabc: đúng 2 pha ratioX<-0.5
- TH4: ratio≈-1.0, flip=3, miss=0, 120=F → nếu có Pabc: cả 3 pha ratioX<-0.5
- TH5: ratio≈0, flip=bất kỳ, miss=0, 120=T (has120offset là dấu hiệu chính)
- TH6: ratio≈+0.67, flip>=1, miss=0, 120=F → nếu có Pabc: đúng 2 pha ratioX<-0.5

score(TH) = P_ratio_score × P_flip_score × P_miss_score × P_120_score [× P_pha_score nếu có Pabc]
% = score(TH)/tổng_score × 100, xếp hạng giảm dần, lấy top 3.

PHÂN BIỆT QUAN TRỌNG:
- TH1 vs TH6: đều ratio≈0.67. TH1: có I=0 hoặc U=0. TH6: không có I=0, phi bất thường, nếu có Pabc: 2 pha ratio âm.
- TH2 vs TH3: TH2 flip=1 (1 CT đảo), TH3 flip=2 (2 CT đảo)
- TH5 duy nhất: ratio≈0 VÀ has120offset=True

TÊN VÀ HÀNH ĐỘNG:
- Binh_thuong → "Đấu dây đúng cực tính" → "Không cần xử lý. Hệ thống hoạt động bình thường."
- TH1 → "TH1: Mất áp hoặc dòng 1 pha" → "Kiểm tra cầu chì nhi thứ, đứt dây CT/VT pha có I=0 hoặc U=0."
- TH2 → "TH2: Đảo cực tính dòng 1 pha" → "Đổi đầu S1↔S2 của CT pha có |φ|>90° (hoặc ratioX âm)."
- TH3 → "TH3: Đảo cực tính dòng 2 pha" → "Đổi đầu S1↔S2 của 2 CT tương ứng 2 pha có |φ|>90°."
- TH4 → "TH4: Đảo cực tính cả 3 dòng" → "Đổi đầu S1↔S2 cả 3 CT hoặc kiểm tra toàn bộ chiều đấu dây."
- TH5 → "TH5: Đấu sai dòng và áp 2 pha" → "Hoán đổi lại cáp nhi thứ CT và VT giữa 2 pha bị đổi chéo."
- TH6 → "TH6: Đảo 2 cuộn áp VT + 2 dòng CT" → "Đặt lại 2 cuộn áp VT đúng pha + đổi S1↔S2 của 2 CT tương ứng."

TRẢ VỀ JSON HỢP LỆ DUY NHẤT, không markdown, không giải thích ngoài JSON:
{
  "metrics": {
    "Pcalc": "<số 2 chữ số thập phân>W",
    "P_ratio": "<số 4 chữ số thập phân>",
    "numFlipped": <số nguyên>,
    "hasPabc": <true|false>,
    "ratioA": "<nếu có Pabc, số 3 chữ số thập phân, ngược lại null>",
    "ratioB": "<nếu có Pabc>",
    "ratioC": "<nếu có Pabc>"
  },
  "results": [
    {"rank": 1, "name": "<tên>", "desc": "<mô tả công suất ngắn gọn>", "action": "<hành động kiểm tra>"},
    {"rank": 2, "name": "<tên>", "desc": "<mô tả>", "action": "<hành động>"},
    {"rank": 3, "name": "<tên>", "desc": "<mô tả>", "action": "<hành động>"}
  ],
  "conclusion": "<1 câu kết luận: trường hợp nào, pha nào bị lỗi, hành động ưu tiên>"
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key chưa được cấu hình trên server' });
  }

  const { Ua, Ub, Uc, Ia, Ib, Ic, phiA, phiB, phiC, phiMode, Ptotal, Pa_do, Pb_do, Pc_do } = req.body;

  if (!Ua || !Ub || !Uc || !Ia || !Ib || !Ic || phiA === undefined || phiB === undefined || phiC === undefined || !Ptotal) {
    return res.status(400).json({ error: 'Thiếu thông số bắt buộc' });
  }

  const hasPabc = (Pa_do !== '' && Pa_do !== null && Pa_do !== undefined) ||
                  (Pb_do !== '' && Pb_do !== null && Pb_do !== undefined) ||
                  (Pc_do !== '' && Pc_do !== null && Pc_do !== undefined);

  const userMsg = `Phân tích điện kế 3 pha gián tiếp:

THÔNG SỐ ĐO LƯỜNG:
- Ua=${Ua}V, Ub=${Ub}V, Uc=${Uc}V
- Ia=${Ia}A, Ib=${Ib}A, Ic=${Ic}A
- phiA=${phiA}°, phiB=${phiB}°, phiC=${phiC}° (Quy ước: Gốc ${phiMode}°)

CÔNG SUẤT ĐO TRÊN CÔNG TƠ:
- P tổng = ${Ptotal}W
${hasPabc ? `- Pa_đo = ${Pa_do || 0}W, Pb_đo = ${Pb_do || 0}W, Pc_đo = ${Pc_do || 0}W` : '- Pa/Pb/Pc từng pha: không nhập (chỉ dùng P tổng)'}

Hãy tính toán đầy đủ theo thuật toán và trả về JSON kết quả.`;

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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Lỗi API Anthropic' });
    }

    const data = await response.json();
    const text = data.content[0].text;
    // Trích xuất JSON từ response — dùng regex tìm block { ... } đầu tiên
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Không tìm thấy JSON trong response');
    const result = JSON.parse(match[0]);
    return res.status(200).json(result);

  } catch (err) {
    console.error('Diagnose error:', err);
    return res.status(500).json({ error: 'Lỗi xử lý: ' + err.message });
  }
}
