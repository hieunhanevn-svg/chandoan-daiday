import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const RANK_CONFIG = [
  { bg: '#EAF3DE', border: '#3B6D11', titleColor: '#27500A', icon: '🥇', label: 'Hạng 1 — Khả năng cao nhất' },
  { bg: '#FFF8E0', border: '#BA7517', titleColor: '#854F0B', icon: '🥈', label: 'Hạng 2 — Gợi ý thứ hai' },
  { bg: '#F5F5F5', border: '#888780', titleColor: '#5F5E5A', icon: '🥉', label: 'Hạng 3 — Gợi ý thứ ba' },
];

const COL = { A: '#CC0000', B: '#C8A000', C: '#0064C8' };

// ── Vẽ giản đồ vector trên Canvas ─────────────────────────────────────────
function drawPhasor(canvas, form) {
  if (!canvas) return;
  const { Ua, Ub, Uc, Ia, Ib, Ic, phiA, phiB, phiC, phiMode } = form;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.38;
  const deg = Math.PI / 180;

  ctx.clearRect(0, 0, W, H);

  // Chuẩn hóa phi
  function eff(phi) {
    let p = parseFloat(phi) || 0;
    if (phiMode === '360' && p > 180) p -= 360;
    return p;
  }
  const eA = eff(phiA), eB = eff(phiB), eC = eff(phiC);

  // Góc U chuẩn (canvas: Y đảo ngược nên sin âm)
  const uA = 90 * deg, uB = -30 * deg, uC = -150 * deg;

  // Góc I: Gốc 180 → angI = angU + phi; Gốc 360 → angI = angU - phi
  const s = phiMode === '360' ? -1 : 1;
  const iA = uA + s * eA * deg;
  const iB = uB + s * eB * deg;
  const iC = uC + s * eC * deg;

  const uMax = Math.max(parseFloat(Ua)||0, parseFloat(Ub)||0, parseFloat(Uc)||0, 1);
  const iMax = Math.max(parseFloat(Ia)||0, parseFloat(Ib)||0, parseFloat(Ic)||0, 1);
  const uSc = R / uMax;
  const iSc = R * 0.72 / iMax;

  // Nền
  ctx.fillStyle = '#FAFBFC';
  ctx.fillRect(0, 0, W, H);

  // Vòng tròn tham chiếu
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = '#DDEAEE';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trục
  ctx.strokeStyle = '#D4D8DE';
  ctx.lineWidth = 0.8;
  [[cx-R-8,cy,cx+R+8,cy],[cx,cy-R-8,cx,cy+R+8]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });

  // Hàm vẽ mũi tên
  function arrow(ang, mag, sc, color, dashed, lbl) {
    if (!mag || mag < 0.001) return;
    const len = mag * sc;
    const x2 = cx + len * Math.cos(ang);
    const y2 = cy - len * Math.sin(ang);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = dashed ? 2 : 2.6;
    if (dashed) ctx.setLineDash([7, 4]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);

    // Đầu tên
    const hl = 11, ha = 0.38;
    const a = Math.atan2(y2 - cy, x2 - cx);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hl*Math.cos(a-ha), y2 - hl*Math.sin(a-ha));
    ctx.lineTo(x2 - hl*Math.cos(a+ha), y2 - hl*Math.sin(a+ha));
    ctx.closePath(); ctx.fill();

    // Nhãn
    const lr = len + 20;
    ctx.font = 'bold 12px -apple-system,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lbl, cx + lr*Math.cos(ang), cy - lr*Math.sin(ang));
    ctx.restore();
  }

  // Hàm vẽ cung góc phi
  function arc(angU, angI, color) {
    const ar = R * 0.20;
    ctx.beginPath();
    // canvas: Y đảo, nên start=-angI, end=-angU (hoặc ngược)
    let s2 = -angU, e2 = -angI, ccw = false;
    // Xác định chiều ngắn nhất
    let diff = e2 - s2;
    if (diff > Math.PI) { diff -= 2*Math.PI; }
    if (diff < -Math.PI) { diff += 2*Math.PI; }
    if (diff < 0) ccw = true;
    ctx.arc(cx, cy, ar, s2, e2, ccw);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Vẽ U (nét liền)
  arrow(uA, parseFloat(Ua)||0, uSc, COL.A, false, 'Ua');
  arrow(uB, parseFloat(Ub)||0, uSc, COL.B, false, 'Ub');
  arrow(uC, parseFloat(Uc)||0, uSc, COL.C, false, 'Uc');

  // Vẽ cung phi
  if ((parseFloat(Ia)||0) > 0.001) arc(uA, iA, COL.A);
  if ((parseFloat(Ib)||0) > 0.001) arc(uB, iB, COL.B);
  if ((parseFloat(Ic)||0) > 0.001) arc(uC, iC, COL.C);

  // Vẽ I (nét đứt)
  arrow(iA, parseFloat(Ia)||0, iSc, COL.A, true, 'Ia');
  arrow(iB, parseFloat(Ib)||0, iSc, COL.B, true, 'Ib');
  arrow(iC, parseFloat(Ic)||0, iSc, COL.C, true, 'Ic');

  // Điểm gốc
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, 2*Math.PI);
  ctx.fillStyle = '#333'; ctx.fill();
}

// ── Component PhasorDiagram ────────────────────────────────────────────────
function PhasorDiagram({ form }) {
  const ref = useRef(null);
  const hasData = form.Ua && form.Ub && form.Uc && form.Ia && form.Ib && form.Ic &&
    form.phiA !== '' && form.phiB !== '' && form.phiC !== '';

  useEffect(() => {
    if (hasData) drawPhasor(ref.current, form);
  });

  return (
    <div style={{
      background: 'white', borderRadius: 16, border: '1px solid #E8E8E8',
      padding: 14, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Giản đồ vector</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }}>
          Tự động cập nhật
        </span>
      </div>

      {!hasData ? (
        <div style={{
          height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#F7F9FB', borderRadius: 12, border: '1.5px dashed #D0D4DA',
          flexDirection: 'column', gap: 8,
        }}>
          <span style={{ fontSize: 32 }}>📐</span>
          <span style={{ fontSize: 13, color: '#888' }}>Nhập U, I, φ để hiển thị giản đồ</span>
        </div>
      ) : (
        <>
          <canvas ref={ref} width={480} height={320}
            style={{ width: '100%', borderRadius: 12, border: '1px solid #EEE', display: 'block' }} />

          {/* Chú thích */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[['A',COL.A],['B',COL.B],['C',COL.C]].map(([ph,col])=>(
              <div key={ph} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:20, height:3, background:col, borderRadius:2 }} />
                <span style={{ fontSize:11, color:'#555' }}>Pha {ph}: U{ph} (liền) / I{ph} (đứt)</span>
              </div>
            ))}
          </div>

          {/* Bảng phi */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginTop:10 }}>
            {[['A',form.phiA,COL.A],['B',form.phiB,COL.B],['C',form.phiC,COL.C]].map(([ph,val,col])=>{
              const phi = parseFloat(val)||0;
              // Quy đổi về [-180, +180] trước khi kiểm tra cảnh báo
              const effPhi = (form.phiMode === '360' && phi > 180) ? phi - 360 : phi;
              const warn = Math.abs(effPhi) > 90;
              return (
                <div key={ph} style={{
                  background: warn ? '#FFF0F0' : '#F7F9FB',
                  borderRadius:8, padding:'6px 8px', textAlign:'center',
                  border:`1px solid ${warn?'#FFCDD2':'#EEE'}`,
                }}>
                  <div style={{ fontSize:10, color:col, fontWeight:700 }}>φ{ph}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:warn?'#C62828':'#1F4E79' }}>{val}°</div>
                  {warn && <div style={{ fontSize:9, color:'#C62828' }}>|φ|&gt;90° ⚠</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function Field({ id, value, onChange, placeholder }) {
  return (
    <input type="number" id={id} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} step="any"
      style={{
        padding:'9px 10px', borderRadius:8, border:'1.5px solid #DDD',
        fontSize:15, fontFamily:'inherit', background:'#FAFAFA',
        color:'#1a1a1a', outline:'none', width:'100%', boxSizing:'border-box',
      }} />
  );
}

function PhaseLabel({ label, color, bg }) {
  return (
    <div style={{ textAlign:'center', fontSize:13, fontWeight:700, color, background:bg, borderRadius:8, padding:'5px 0' }}>
      {label}
    </div>
  );
}

function Card({ title, badge, badgeColor, children }) {
  return (
    <div style={{
      background:'white', borderRadius:16, border:'1px solid #E8E8E8',
      padding:16, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'#444' }}>{title}</span>
        {badge && (
          <span style={{
            fontSize:10, padding:'2px 10px', borderRadius:20,
            background:badgeColor||'#E8F5E9', color:badgeColor?'#fff':'#2E7D32', fontWeight:600,
          }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function MetricBox({ label, value, sub }) {
  return (
    <div style={{ background:'#F7F9FB', borderRadius:10, padding:'10px 12px', border:'1px solid #EEE' }}>
      <div style={{ fontSize:10, color:'#888', marginBottom:3, fontWeight:500 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color:'#1F4E79' }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#999', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Home() {
  const [form, setForm] = useState({
    Ua:'', Ub:'', Uc:'', Ia:'', Ib:'', Ic:'',
    phiA:'', phiB:'', phiC:'', phiMode:'180',
    Ptotal:'', Pa_do:'', Pb_do:'', Pc_do:'',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState('form');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiError, setAiError] = useState('');
  const canvasRef2 = useRef(null);

  // ── State phản hồi ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('diagnose');
  const [enableFeedback, setEnableFeedback] = useState(false);
  const [maDiemDo, setMaDiemDo] = useState('');
  const [caseSaved, setCaseSaved] = useState(false);
  const [fbMode, setFbMode] = useState('list'); // list | search | detail | done
  const [fbPending, setFbPending] = useState([]);
  const [fbPendingLoading, setFbPendingLoading] = useState(false);
  const [fbSearch, setFbSearch] = useState('');
  const [fbSearchLoading, setFbSearchLoading] = useState(false);
  const [fbCase, setFbCase] = useState(null);
  const [fbTH, setFbTH] = useState('');
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbDone, setFbDone] = useState(null);
  const [fbError, setFbError] = useState('');

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  async function run() {
    const req = ['Ua','Ub','Uc','Ia','Ib','Ic','phiA','phiB','phiC','Ptotal'];
    if (req.some(k => form[k] === '' || form[k] === undefined)) {
      alert('Vui lòng nhập đầy đủ thông số bắt buộc (U, I, φ, P tổng)');
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
      setResult(data);
      setStep('result');
      // Lưu ca vào Google Sheets nếu đã tick phản hồi
      await saveCase(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('form'); setResult(null); setError('');
    setAiResult(''); setAiError('');
    setCaseSaved(false);
  }

  // ── Tạo ảnh nhỏ từ canvas để lưu vào Sheets ──────────────────
  function createSmallImage() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return '';
    const small = document.createElement('canvas');
    small.width = 200; small.height = 130;
    const ctx = small.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 200, 130);
    return small.toDataURL('image/jpeg', 0.25); // ~5-8KB
  }

  // ── Lưu ca vào Google Sheets ─────────────────────────────────
  async function saveCase(diagResult) {
    if (!enableFeedback || !maDiemDo.trim()) return;
    const imageSmall = createSmallImage();
    // Tách AI kết luận 1 và 2
    const aiText = aiResult || '';
    const kl1Match = aiText.match(/🤖 KẾT LUẬN 1[^🔌]*/s);
    const kl2Match = aiText.match(/🔌 KẾT LUẬN 2[^⚠]*/s);
    try {
      await fetch('/api/save-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maDiemDo: maDiemDo.trim(),
          metrics: diagResult.metrics,
          results: diagResult.results,
          rawData: { ...form },
          aiKL1: kl1Match ? kl1Match[0].trim().slice(0, 300) : '',
          aiKL2: kl2Match ? kl2Match[0].trim().slice(0, 300) : '',
          imageSmall,
        }),
      });
      setCaseSaved(true);
    } catch(e) { console.log('saveCase error:', e); }
  }

  // ── Tab phản hồi: Tải danh sách chờ ─────────────────────────
  async function loadPending() {
    setFbPendingLoading(true); setFbError('');
    try {
      const r = await fetch('/api/get-pending');
      const d = await r.json();
      if (d.success) setFbPending(d.pending || []);
      else setFbError(d.error || 'Lỗi tải danh sách');
    } catch(e) { setFbError(e.message); }
    finally { setFbPendingLoading(false); }
  }

  // ── Tab phản hồi: Tìm ca theo mã ────────────────────────────
  async function searchCase(maDDo) {
    const ma = (maDDo || fbSearch).trim();
    if (!ma) return;
    setFbSearchLoading(true); setFbError(''); setFbCase(null);
    try {
      const r = await fetch(`/api/get-case?maDiemDo=${encodeURIComponent(ma)}`);
      const d = await r.json();
      if (d.success) { setFbCase(d.case); setFbMode('detail'); setFbTH(''); }
      else setFbError(d.error || 'Không tìm thấy mã điểm đo');
    } catch(e) { setFbError(e.message); }
    finally { setFbSearchLoading(false); }
  }

  // ── Tab phản hồi: Gửi kết quả thực tế ───────────────────────
  async function doSubmitFeedback() {
    if (!fbTH) { setFbError('Vui lòng chọn kết quả thực tế'); return; }
    setFbSubmitting(true); setFbError('');
    try {
      const r = await fetch('/api/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maDiemDo: fbCase.maDiemDo,
          ketQuaThucTe: fbTH,
          phaThucTe: '',
        }),
      });
      const d = await r.json();
      if (d.success) {
        setFbDone(d);
        setFbMode('done');
        // Cập nhật lại danh sách chờ
        setFbPending(prev => prev.filter(p => p.maDiemDo !== fbCase.maDiemDo));
      } else setFbError(d.error || 'Lỗi gửi phản hồi');
    } catch(e) { setFbError(e.message); }
    finally { setFbSubmitting(false); }
  }

  async function runAiAnalysis() {
    const canvas = document.querySelector('canvas');
    if (!canvas) { setAiError('Không tìm thấy giản đồ vector.'); return; }
    // Vẽ lại lên canvas tạm 2.5x để AI phân biệt góc vector rõ hơn
    const SCALE = 2.5;
    const hiRes = document.createElement('canvas');
    hiRes.width  = canvas.width  * SCALE;
    hiRes.height = canvas.height * SCALE;
    const hCtx = hiRes.getContext('2d');
    hCtx.scale(SCALE, SCALE);
    hCtx.drawImage(canvas, 0, 0);
    const imageBase64 = hiRes.toDataURL('image/png');
    setAiLoading(true); setAiResult(''); setAiError('');
    try {
      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          diagnosisTop3: result?.results || [],
          metrics: result?.metrics || {},
          // Gửi toàn bộ số liệu gốc để AI hiểu đúng bối cảnh
          rawData: {
            Ua: form.Ua, Ub: form.Ub, Uc: form.Uc,
            Ia: form.Ia, Ib: form.Ib, Ic: form.Ic,
            phiA: form.phiA, phiB: form.phiB, phiC: form.phiC,
            phiMode: form.phiMode, Ptotal: form.Ptotal,
            Pa_do: form.Pa_do, Pb_do: form.Pb_do, Pc_do: form.Pc_do,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi phân tích AI');
      setAiResult(data.analysis);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  const m = result?.metrics || {};

  return (
    <>
      <Head>
        <title>Chẩn đoán lỗi đấu dây điện kế 3 pha</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
        <meta name="description" content="Chẩn đoán lỗi đấu dây điện kế 3 pha gián tiếp" />
      </Head>
      <div style={{ minHeight:'100vh', background:'#F0F4F8', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1F4E79,#2E75B6)', color:'white', padding:'18px 16px 0' }}>
          <div style={{ maxWidth:520, margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <span style={{ fontSize:22 }}>⚡</span>
              <h1 style={{ fontSize:17, fontWeight:700, margin:0 }}>Chẩn đoán lỗi đấu dây điện kế</h1>
            </div>
            <p style={{ fontSize:12, opacity:0.8, margin:'0 0 12px' }}>Điện kế 3 pha gián tiếp · Thuật toán Naive Bayes v6.5</p>
            {/* Tab bar */}
            <div style={{ display:'flex', gap:0 }}>
              {[['diagnose','⚡ Chẩn đoán'],['feedback','📋 Phản hồi']].map(([id,label])=>(
                <button key={id} onClick={()=>{ setActiveTab(id); if(id==='feedback'&&fbMode==='list') loadPending(); }}
                  style={{
                    flex:1, padding:'10px 0', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                    background: activeTab===id ? 'white' : 'transparent',
                    color: activeTab===id ? '#1F4E79' : 'rgba(255,255,255,0.75)',
                    borderRadius: activeTab===id ? '8px 8px 0 0' : 0,
                    transition:'all .2s',
                  }}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth:520, margin:'0 auto', padding:'14px 12px 40px' }}>

          {/* ══ TAB PHẢN HỒI ══════════════════════════════════════ */}
          {activeTab === 'feedback' && (
            <div>
              {/* Mode: list — Danh sách chờ phản hồi */}
              {fbMode === 'list' && (<>
                <div style={{ background:'white', borderRadius:16, border:'1px solid #E8E8E8', padding:14, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#444', marginBottom:12 }}>📋 Danh sách chờ phản hồi</div>

                  {fbPendingLoading && <div style={{ textAlign:'center', padding:'20px 0', color:'#888', fontSize:13 }}>⏳ Đang tải...</div>}

                  {!fbPendingLoading && fbPending.length === 0 && (
                    <div style={{ textAlign:'center', padding:'20px 0' }}>
                      <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
                      <div style={{ fontSize:13, color:'#888' }}>Không có ca nào chờ phản hồi</div>
                    </div>
                  )}

                  {!fbPendingLoading && fbPending.map((p,i) => (
                    <div key={i} onClick={()=>searchCase(p.maDiemDo)} style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'10px 12px', borderRadius:10, marginBottom:6, cursor:'pointer',
                      background:'#FFF8E0', border:'0.5px solid #FAC775',
                    }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#854F0B' }}>{p.maDiemDo}</div>
                        <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{String(p.timestamp)} · {p.algoH1?.replace('TH','')?.slice(0,40)||'—'}</div>
                      </div>
                      <div style={{ fontSize:18, color:'#BA7517' }}>›</div>
                    </div>
                  ))}
                </div>

                {/* Tìm kiếm theo mã */}
                <div style={{ background:'white', borderRadius:16, border:'1px solid #E8E8E8', padding:14, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#444', marginBottom:10 }}>🔍 Tra cứu theo mã điểm đo</div>
                  <input type="text" value={fbSearch} onChange={e=>setFbSearch(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&searchCase()}
                    placeholder="Nhập mã điểm đo..."
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #DDD', fontSize:14, fontFamily:'inherit', background:'#FAFAFA', color:'#1a1a1a', outline:'none', boxSizing:'border-box', marginBottom:8 }} />
                  {fbError && <div style={{ fontSize:12, color:'#C62828', marginBottom:8 }}>❌ {fbError}</div>}
                  <button onClick={()=>searchCase()} disabled={fbSearchLoading||!fbSearch.trim()}
                    style={{ width:'100%', padding:11, background: fbSearch.trim()?'#1F4E79':'#CCC', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: fbSearch.trim()?'pointer':'not-allowed' }}>
                    {fbSearchLoading ? '⏳ Đang tìm...' : '🔍 Tìm ca kiểm tra'}
                  </button>
                </div>
              </>)}

              {/* Mode: detail — Hiển thị ca và form phản hồi */}
              {fbMode === 'detail' && fbCase && (<>
                {/* Tóm tắt ca */}
                <div style={{ background:'#F7F9FB', borderRadius:16, border:'1px solid #E8E8E8', padding:14, marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1F4E79', marginBottom:8 }}>📌 Thông tin ca kiểm tra — Xác nhận đúng điểm đo</div>
                  {[
                    ['Mã điểm đo', fbCase.maDiemDo],
                    ['Thời gian lưu', String(fbCase.timestamp)],
                    ['Ua/Ub/Uc (V)', `${fbCase.Ua} / ${fbCase.Ub} / ${fbCase.Uc}`],
                    ['Ia/Ib/Ic (A)', `${fbCase.Ia} / ${fbCase.Ib} / ${fbCase.Ic}`],
                    ['φA/φB/φC (°)', `${fbCase.phiA} / ${fbCase.phiB} / ${fbCase.phiC}`],
                    ['P tổng (W)', fbCase.Ptotal],
                    ['Thuật toán Hạng 1', fbCase.algoH1],
                    ['Thuật toán Hạng 2', fbCase.algoH2],
                  ].map(([k,v])=>(
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'0.5px solid #EEE' }}>
                      <span style={{ color:'#666' }}>{k}</span>
                      <span style={{ fontWeight:500, color:'#1a1a1a', textAlign:'right', maxWidth:'55%' }}>{v||'—'}</span>
                    </div>
                  ))}
                  {fbCase.imageSmall && (
                    <div style={{ marginTop:10 }}>
                      <div style={{ fontSize:11, color:'#666', marginBottom:4 }}>Giản đồ đã lưu:</div>
                      <img src={fbCase.imageSmall} alt="Giản đồ" style={{ width:'100%', borderRadius:8, border:'1px solid #EEE' }} />
                    </div>
                  )}
                </div>

                {/* Dropdown chọn kết quả thực tế */}
                <div style={{ background:'white', borderRadius:16, border:'1px solid #E8E8E8', padding:14, marginBottom:10, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#444', marginBottom:10 }}>
                    ✅ Kết quả thực tế sau khi kiểm tra hiện trường <span style={{ color:'#C62828' }}>*</span>
                  </div>
                  <select value={fbTH} onChange={e=>setFbTH(e.target.value)}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:`1.5px solid ${fbTH?'#1F4E79':'#DDD'}`, fontSize:14, background: fbTH?'#EBF3FB':'#FAFAFA', color:'#1a1a1a', outline:'none', marginBottom:8 }}>
                    <option value="">-- Chọn trường hợp thực tế --</option>
                    <option value="Đấu dây đúng cực tính (Bình thường)">✅ Đấu dây đúng cực tính (Bình thường)</option>
                    <option value="TH1: Mất điện áp hoặc dòng 1 pha">TH1: Mất điện áp hoặc dòng 1 pha</option>
                    <option value="TH2: Đảo cực tính dòng 1 pha">TH2: Đảo cực tính dòng 1 pha</option>
                    <option value="TH3: Đảo cực tính dòng 2 pha">TH3: Đảo cực tính dòng 2 pha</option>
                    <option value="TH4: Đảo cực tính cả 3 dòng">TH4: Đảo cực tính cả 3 dòng</option>
                    <option value="TH5: Đấu sai dòng và áp 2 pha">TH5: Đấu sai dòng và áp 2 pha</option>
                    <option value="TH6: Đảo 2 cuộn áp VT + 2 dòng CT">TH6: Đảo 2 cuộn áp VT + 2 dòng CT</option>
                  </select>
                  {fbError && <div style={{ fontSize:12, color:'#C62828', marginBottom:8 }}>❌ {fbError}</div>}
                  <button onClick={doSubmitFeedback} disabled={fbSubmitting||!fbTH}
                    style={{ width:'100%', padding:13, background: fbTH?'#1a5c1a':'#CCC', color:'white', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor: fbTH?'pointer':'not-allowed' }}>
                    {fbSubmitting ? '⏳ Đang gửi...' : '✅ Gửi phản hồi kết quả thực tế'}
                  </button>
                </div>

                <button onClick={()=>{ setFbMode('list'); setFbCase(null); setFbTH(''); setFbError(''); }}
                  style={{ width:'100%', padding:11, background:'white', color:'#666', border:'1px solid #DDD', borderRadius:10, fontSize:13, cursor:'pointer' }}>
                  ← Quay lại danh sách
                </button>
              </>)}

              {/* Mode: done — Xác nhận thành công */}
              {fbMode === 'done' && fbDone && (
                <div style={{ background:'white', borderRadius:16, border:'1px solid #E8E8E8', padding:20, textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#1a5c1a', marginBottom:6 }}>Phản hồi đã được ghi nhận!</div>
                  <div style={{ fontSize:13, color:'#555', marginBottom:16 }}>{fbCase?.maDiemDo} · {fbTH}</div>
                  <div style={{ background:'#F0F4F8', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#444', marginBottom:8 }}>Kết quả đối chiếu:</div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                      <span>Thuật toán Naive Bayes:</span>
                      <strong style={{ color: fbDone.algoOk==='ĐÚNG'?'#1a5c1a':'#C62828' }}>
                        {fbDone.algoOk==='ĐÚNG'?'✓ ĐÚNG':'✗ SAI'}
                      </strong>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span>AI gợi ý:</span>
                      <strong style={{ color: fbDone.aiOk==='ĐÚNG'?'#1a5c1a':'#C62828' }}>
                        {fbDone.aiOk==='ĐÚNG'?'✓ ĐÚNG':'✗ SAI'}
                      </strong>
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'#888', marginBottom:16 }}>
                    Dữ liệu thực tế đã được lưu vào thư viện. AI sẽ học từ phản hồi này.
                  </div>
                  <button onClick={()=>{ setFbMode('list'); setFbCase(null); setFbDone(null); setFbTH(''); }}
                    style={{ width:'100%', padding:12, background:'linear-gradient(135deg,#1F4E79,#2E75B6)', color:'white', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                    ← Về danh sách
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB CHẨN ĐOÁN ══════════════════════════════════════ */}
          {activeTab === 'diagnose' && (<>

          {/* ── FORM ── */}
          {step === 'form' && (<>
            <Card title="Thông số đo lường" badge="Bắt buộc" badgeColor="#2E75B6">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
                <PhaseLabel label="Pha A" color="#CC0000" bg="#FFF0F0" />
                <PhaseLabel label="Pha B" color="#C8A000" bg="#FFF8E0" />
                <PhaseLabel label="Pha C" color="#0064C8" bg="#E8F2FF" />
              </div>

              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:'#666', fontWeight:600, marginBottom:6 }}>Điện áp U (V)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {['Ua','Ub','Uc'].map(k => <Field key={k} id={k} value={form[k]} onChange={set(k)} placeholder="V" />)}
                </div>
              </div>

              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:'#666', fontWeight:600, marginBottom:6 }}>Dòng điện I (A)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {['Ia','Ib','Ic'].map(k => <Field key={k} id={k} value={form[k]} onChange={set(k)} placeholder="A" />)}
                </div>
              </div>

              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:'#666', fontWeight:600, marginBottom:6 }}>
                  Góc φ (°) — {form.phiMode==='180' ? 'từ -180 đến +180' : 'từ 0 đến 360'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {['phiA','phiB','phiC'].map(k => {
                    const warn = Math.abs(parseFloat(form[k])||0) > 90;
                    return (
                      <input key={k} type="number" value={form[k]} onChange={e=>set(k)(e.target.value)}
                        placeholder="°" step="any"
                        style={{
                          padding:'9px 10px', borderRadius:8,
                          border:`1.5px solid ${warn?'#F44336':'#2E75B6'}`,
                          fontSize:15, fontFamily:'inherit',
                          background: warn?'#FFF5F5':'#EBF3FB',
                          color:'#1a1a1a', outline:'none', width:'100%', boxSizing:'border-box',
                        }} />
                    );
                  })}
                </div>
                <div style={{ fontSize:11, color:'#888', marginTop:5 }}>
                  ⚠ Ô đỏ = |φ| &gt; 90° — CT có thể bị đảo cực tính
                </div>
              </div>

              <div>
                <div style={{ fontSize:11, color:'#666', fontWeight:600, marginBottom:6 }}>Quy ước góc φ</div>
                <select value={form.phiMode} onChange={e=>set('phiMode')(e.target.value)} style={{
                  width:'100%', padding:'9px 12px', borderRadius:8,
                  border:'1.5px solid #DDD', fontSize:14, background:'#FAFAFA', color:'#1a1a1a', outline:'none',
                }}>
                  <option value="180">Gốc 180° (từ -180° đến +180°)</option>
                  <option value="360">Gốc 360° (từ 0° đến 360°)</option>
                </select>
              </div>
            </Card>

            {/* Giản đồ vector — live preview */}
            <PhasorDiagram form={form} />

            <Card title="Công suất đo trên công tơ" badge="Bắt buộc" badgeColor="#2E75B6">
              <div style={{ fontSize:11, color:'#666', fontWeight:600, marginBottom:6 }}>P tổng 3 pha (W)</div>
              <Field id="Ptotal" value={form.Ptotal} onChange={set('Ptotal')} placeholder="Ví dụ: 3990" />
            </Card>

            <Card title="Công suất từng pha" badge="Tùy chọn — tăng độ chính xác">
              <div style={{ marginBottom:10, padding:'8px 10px', background:'#FFFBEA', borderRadius:8, fontSize:12, color:'#7D5A00' }}>
                💡 Để trống nếu công tơ không hiển thị từng pha. Khi có Pa/Pb/Pc, thuật toán chính xác hơn rõ rệt.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
                <PhaseLabel label="Pa (W)" color="#CC0000" bg="#FFF0F0" />
                <PhaseLabel label="Pb (W)" color="#C8A000" bg="#FFF8E0" />
                <PhaseLabel label="Pc (W)" color="#0064C8" bg="#E8F2FF" />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {['Pa_do','Pb_do','Pc_do'].map(k => <Field key={k} id={k} value={form[k]} onChange={set(k)} placeholder="có thể âm" />)}
              </div>
            </Card>

            {/* ── Phản hồi kết quả ── */}
            <div style={{ background:'white', borderRadius:16, border:`1.5px solid ${enableFeedback?'#2E75B6':'#E8E8E8'}`, padding:14, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={()=>setEnableFeedback(v=>!v)}>
                <div style={{
                  width:20, height:20, borderRadius:4, flexShrink:0,
                  border:`2px solid ${enableFeedback?'#2E75B6':'#CCC'}`,
                  background: enableFeedback?'#2E75B6':'white',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {enableFeedback && <span style={{ color:'white', fontSize:13, fontWeight:700 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color: enableFeedback?'#1F4E79':'#444' }}>
                    📋 Phản hồi kết quả sau khi kiểm tra hiện trường
                  </div>
                  <div style={{ fontSize:11, color:'#888' }}>
                    Tick để lưu ca này và phản hồi kết quả thực tế sau
                  </div>
                </div>
              </div>
              {enableFeedback && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:'0.5px solid #EEE' }}>
                  <div style={{ fontSize:11, color:'#666', fontWeight:600, marginBottom:6 }}>
                    Mã điểm đo <span style={{ color:'#C62828' }}>*</span>
                  </div>
                  <input type="text" value={maDiemDo} onChange={e=>setMaDiemDo(e.target.value)}
                    placeholder="VD: KH001-2026-001"
                    style={{
                      width:'100%', padding:'9px 12px', borderRadius:8,
                      border:`1.5px solid ${maDiemDo?'#2E75B6':'#DDD'}`,
                      fontSize:14, fontFamily:'inherit',
                      background: maDiemDo?'#EBF3FB':'#FAFAFA',
                      color:'#1a1a1a', outline:'none', boxSizing:'border-box',
                    }} />
                  <div style={{ fontSize:11, color:'#888', marginTop:4 }}>
                    Dùng mã này để tra cứu và phản hồi kết quả sau khi kiểm tra
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div style={{ background:'#FFEBEE', border:'1px solid #FFCDD2', borderRadius:12, padding:'12px 14px', fontSize:13, color:'#C62828', marginBottom:12 }}>
                ❌ {error}
              </div>
            )}

            <button onClick={run} disabled={loading} style={{
              width:'100%', padding:16,
              background: loading?'#9BB8D3':'linear-gradient(135deg,#1F4E79,#2E75B6)',
              color:'white', border:'none', borderRadius:14, fontSize:16, fontWeight:700,
              cursor: loading?'not-allowed':'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              boxShadow: loading?'none':'0 4px 16px rgba(30,78,121,0.35)',
            }}>
              {loading
                ? <><span style={{ display:'inline-block', animation:'spin .8s linear infinite' }}>⚙️</span>Đang phân tích...</>
                : <>⚡ Chạy chẩn đoán</>}
            </button>

            <button onClick={()=>setForm({ Ua:'',Ub:'',Uc:'',Ia:'',Ib:'',Ic:'', phiA:'',phiB:'',phiC:'',phiMode:'180', Ptotal:'',Pa_do:'',Pb_do:'',Pc_do:'' })}
              style={{ width:'100%', padding:11, marginTop:8, background:'white', color:'#666', border:'1px solid #DDD', borderRadius:10, fontSize:13, cursor:'pointer' }}>
              Xóa form
            </button>
          </>)}

          {/* ── KẾT QUẢ ── */}
          {step === 'result' && result && (<>
            {/* Thông báo đã lưu ca */}
            {caseSaved && (
              <div style={{ background:'#EBF3FB', border:'1px solid #B5D4F4', borderRadius:12, padding:'10px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>💾</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#0C447C' }}>Đã lưu ca kiểm tra</div>
                  <div style={{ fontSize:11, color:'#185FA5' }}>Mã: {maDiemDo} · Vào tab 📋 Phản hồi để nhập kết quả sau khi kiểm tra</div>
                </div>
              </div>
            )}

            {/* Giản đồ trên kết quả */}
            <PhasorDiagram form={form} />

            {/* Metrics */}
            <Card title="Chỉ số kỹ thuật tính toán">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:10 }}>
                <MetricBox label="|P| tính toán" value={m.Pcalc||'—'} sub="Tổng trị tuyệt đối 3 pha" />
                <MetricBox label="Tỷ lệ P_đo/P_tính" value={m.P_ratio||'—'} sub="≈1.0: đúng | <0: đảo ngược" />
                <MetricBox label="Số pha bị đảo" value={`${m.numFlipped??'—'} pha`} sub="Phát hiện qua phi hoặc ratioX" />
                <MetricBox label="Pa/Pb/Pc từng pha" value={m.hasPabc?'✓ Có':'Không'} sub={m.hasPabc?'Độ chính xác cao hơn':'Chỉ dùng P tổng'} />
              </div>
              {m.hasPabc && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {[['A',m.ratioA,COL.A],['B',m.ratioB,COL.B],['C',m.ratioC,COL.C]].map(([ph,val,col])=>(
                    <div key={ph} style={{
                      background: val&&parseFloat(val)<-0.5?'#FFEBEE':'#F7F9FB',
                      borderRadius:10, padding:'8px 10px', textAlign:'center',
                      border:`1px solid ${val&&parseFloat(val)<-0.5?'#FFCDD2':'#EEE'}`,
                    }}>
                      <div style={{ fontSize:10, color:col, fontWeight:700, marginBottom:2 }}>Ratio pha {ph}</div>
                      <div style={{ fontSize:15, fontWeight:700, color:val&&parseFloat(val)<-0.5?'#C62828':'#1F4E79' }}>{val??'—'}</div>
                      {val&&parseFloat(val)<-0.5&&<div style={{ fontSize:9, color:'#C62828', marginTop:2 }}>ĐẢO NGƯỢC</div>}
                    </div>
                  ))}
                </div>
              )}

            </Card>

            {/* Cảnh báo tải lệch — Bug 2 Fix */}
            {(result.warnings||[]).map((w,i) => (
              <div key={i} style={{
                background:'#FFFBEA', border:'1.5px solid #F59E0B',
                borderRadius:12, padding:'10px 14px', marginBottom:10,
                fontSize:13, color:'#92400E', lineHeight:1.6,
              }}>{w}</div>
            ))}

            {/* Top 3 */}
            {(result.results||[]).slice(0,3).map((r,i)=>{
              const cfg=RANK_CONFIG[i];
              return (
                <div key={i} style={{ background:cfg.bg, borderRadius:16, padding:14, marginBottom:10, borderLeft:`4px solid ${cfg.border}`, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize:11, color:cfg.titleColor, fontWeight:600, marginBottom:5 }}>{cfg.icon} {cfg.label}</div>
                  <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{r.name}</div>
                  <div style={{ fontSize:12, color:'#555', marginBottom:10 }}>{r.desc}</div>
                  <div style={{ background:'rgba(255,255,255,0.7)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#888', marginBottom:4, letterSpacing:0.5 }}>HÀNH ĐỘNG KIỂM TRA</div>
                    <div style={{ fontSize:13, color:'#1a1a1a', lineHeight:1.5 }}>{r.action}</div>
                  </div>
                </div>
              );
            })}


            {/* ── AI VISION ANALYSIS ── */}
            <div style={{
              background:'white', borderRadius:16, border:'1px solid #E8E8E8',
              padding:14, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#444' }}>Phân tích AI — nhìn giản đồ</span>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'#F3E8FF', color:'#4B0082', fontWeight:600 }}>
                  Beta
                </span>
              </div>
              <p style={{ fontSize:12, color:'#666', marginBottom:10, lineHeight:1.5 }}>
                AI nhìn trực tiếp vào giản đồ vector, so sánh hình dáng với 6 trường hợp lỗi và đưa ra nhận xét độc lập — bổ sung thêm cơ sở cho kết luận.
              </p>

              {!aiResult && !aiLoading && !aiError && (
                <button onClick={runAiAnalysis} style={{
                  width:'100%', padding:12,
                  background:'linear-gradient(135deg,#4B0082,#7B2FBE)',
                  color:'white', border:'none', borderRadius:10,
                  fontSize:14, fontWeight:600, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                }}>
                  🤖 Phân tích giản đồ bằng AI
                </button>
              )}

              {aiLoading && (
                <div style={{ textAlign:'center', padding:'16px 0', color:'#666' }}>
                  <span style={{ display:'inline-block', animation:'spin .8s linear infinite', fontSize:20 }}>⚙️</span>
                  <div style={{ fontSize:12, marginTop:6 }}>AI đang phân tích giản đồ vector...</div>
                </div>
              )}

              {aiError && (
                <div style={{ background:'#FFEBEE', borderRadius:10, padding:'10px 12px', fontSize:12, color:'#C62828' }}>
                  ❌ {aiError}
                  <button onClick={runAiAnalysis} style={{
                    display:'block', marginTop:8, padding:'6px 12px',
                    background:'#7B2FBE', color:'white', border:'none',
                    borderRadius:6, fontSize:12, cursor:'pointer',
                  }}>Thử lại</button>
                </div>
              )}

              {aiResult && (
                <div>
                  <div style={{
                    background:'linear-gradient(135deg,#F3E8FF,#EDE0FF)',
                    border:'1.5px solid #C084FC',
                    borderRadius:12, padding:'12px 14px',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                      <span style={{ fontSize:16 }}>🤖</span>
                      <span style={{ fontSize:12, fontWeight:600, color:'#4B0082' }}>Nhận xét của AI</span>
                    </div>
                    <div style={{ fontSize:13, color:'#2D1B69', lineHeight:1.7, whiteSpace:'pre-line' }}>
                      {aiResult}
                    </div>
                  </div>
                  <button onClick={runAiAnalysis} style={{
                    width:'100%', padding:'8px 0', marginTop:8,
                    background:'transparent', color:'#7B2FBE',
                    border:'1px solid #C084FC', borderRadius:8,
                    fontSize:12, cursor:'pointer',
                  }}>
                    🔄 Phân tích lại
                  </button>
                </div>
              )}
            </div>

            <button onClick={reset} style={{
              width:'100%', padding:14, marginTop:4,
              background:'linear-gradient(135deg,#1F4E79,#2E75B6)',
              color:'white', border:'none', borderRadius:14, fontSize:15, fontWeight:700, cursor:'pointer',
            }}>← Nhập lại thông số mới</button>
          </>)}
        </>)}
        </div>

        <style>{`
          @keyframes spin { to { transform:rotate(360deg); } }
          * { box-sizing:border-box; }
          input:focus { border-color:#2E75B6!important; box-shadow:0 0 0 3px rgba(46,117,182,.15)!important; outline:none!important; }
          select:focus { border-color:#2E75B6!important; outline:none!important; }
          button:active { transform:scale(.98); }
        `}</style>
      </div>
    </>
  );
}
