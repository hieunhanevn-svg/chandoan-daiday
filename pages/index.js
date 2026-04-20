import { useState } from 'react';
import Head from 'next/head';

const RANK_CONFIG = [
  { bg: '#EAF3DE', border: '#3B6D11', titleColor: '#27500A', icon: '🥇', label: 'Hạng 1 — Khả năng cao nhất' },
  { bg: '#FFF8E0', border: '#BA7517', titleColor: '#854F0B', icon: '🥈', label: 'Hạng 2 — Gợi ý thứ hai' },
  { bg: '#F5F5F5', border: '#888780', titleColor: '#5F5E5A', icon: '🥉', label: 'Hạng 3 — Gợi ý thứ ba' },
];

function Field({ label, id, value, onChange, placeholder, type = 'number', highlight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>{label}</label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        step="any"
        style={{
          padding: '9px 10px',
          borderRadius: 8,
          border: `1.5px solid ${highlight ? '#2E75B6' : '#DDD'}`,
          fontSize: 15,
          fontFamily: 'inherit',
          background: highlight ? '#EBF3FB' : '#FAFAFA',
          color: '#1a1a1a',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function PhaseLabel({ label, color, bg }) {
  return (
    <div style={{
      textAlign: 'center', fontSize: 13, fontWeight: 700,
      color, background: bg, borderRadius: 8, padding: '5px 0',
    }}>{label}</div>
  );
}

function Card({ title, badge, badgeColor, children }) {
  return (
    <div style={{
      background: 'white', borderRadius: 16, border: '1px solid #E8E8E8',
      padding: '16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 10, padding: '2px 10px', borderRadius: 20,
            background: badgeColor || '#E8F5E9', color: badgeColor ? '#fff' : '#2E7D32', fontWeight: 600,
          }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function MetricBox({ label, value, sub }) {
  return (
    <div style={{
      background: '#F7F9FB', borderRadius: 10, padding: '10px 12px',
      border: '1px solid #EEE',
    }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 3, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1F4E79' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState({
    Ua: '', Ub: '', Uc: '',
    Ia: '', Ib: '', Ic: '',
    phiA: '', phiB: '', phiC: '',
    phiMode: '180',
    Ptotal: '',
    Pa_do: '', Pb_do: '', Pc_do: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState('form'); // form | result

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  async function runDiagnosis() {
    const required = ['Ua','Ub','Uc','Ia','Ib','Ic','phiA','phiB','phiC','Ptotal'];
    for (const k of required) {
      if (form[k] === '' || form[k] === undefined) {
        alert('Vui lòng nhập đầy đủ thông số bắt buộc (U, I, φ, P tổng)');
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
      setResult(data);
      setStep('result');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('form');
    setResult(null);
    setError('');
  }

  const m = result?.metrics || {};

  return (
    <>
      <Head>
        <title>Chẩn đoán lỗi đấu dây điện kế 3 pha</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
        <meta name="description" content="Chẩn đoán lỗi đấu dây điện kế 3 pha gián tiếp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={{
        minHeight: '100vh', background: '#F0F4F8',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#1F4E79,#2E75B6)',
          color: 'white', padding: '18px 16px 20px',
        }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22 }}>⚡</span>
              <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                Chẩn đoán lỗi đấu dây điện kế
              </h1>
            </div>
            <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>
              Điện kế 3 pha gián tiếp · Thuật toán Naive Bayes v6.5
            </p>
          </div>
        </div>

        <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 12px 40px' }}>

          {/* ── FORM ── */}
          {step === 'form' && (
            <>
              <Card title="Thông số đo lường" badge="Bắt buộc" badgeColor="#2E75B6">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  <PhaseLabel label="Pha A" color="#CC0000" bg="#FFF0F0" />
                  <PhaseLabel label="Pha B" color="#7D5A00" bg="#FFF8E0" />
                  <PhaseLabel label="Pha C" color="#0064C8" bg="#E8F2FF" />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#666', fontWeight: 600, marginBottom: 6 }}>Điện áp U (V)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    <Field id="Ua" value={form.Ua} onChange={set('Ua')} placeholder="V" />
                    <Field id="Ub" value={form.Ub} onChange={set('Ub')} placeholder="V" />
                    <Field id="Uc" value={form.Uc} onChange={set('Uc')} placeholder="V" />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#666', fontWeight: 600, marginBottom: 6 }}>Dòng điện I (A)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    <Field id="Ia" value={form.Ia} onChange={set('Ia')} placeholder="A" />
                    <Field id="Ib" value={form.Ib} onChange={set('Ib')} placeholder="A" />
                    <Field id="Ic" value={form.Ic} onChange={set('Ic')} placeholder="A" />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#666', fontWeight: 600, marginBottom: 6 }}>
                    Góc φ (°) — {form.phiMode === '180' ? 'từ -180 đến +180' : 'từ 0 đến 360'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    <Field id="phiA" value={form.phiA} onChange={set('phiA')} placeholder="°" highlight />
                    <Field id="phiB" value={form.phiB} onChange={set('phiB')} placeholder="°" highlight />
                    <Field id="phiC" value={form.phiC} onChange={set('phiC')} placeholder="°" highlight />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#666', fontWeight: 600, marginBottom: 6 }}>Quy ước góc φ</div>
                  <select
                    value={form.phiMode}
                    onChange={e => set('phiMode')(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: '1.5px solid #DDD', fontSize: 14, background: '#FAFAFA',
                      color: '#1a1a1a', outline: 'none',
                    }}
                  >
                    <option value="180">Gốc 180° (từ -180° đến +180°)</option>
                    <option value="360">Gốc 360° (từ 0° đến 360°)</option>
                  </select>
                </div>
              </Card>

              <Card title="Công suất đo trên công tơ" badge="Bắt buộc" badgeColor="#2E75B6">
                <Field
                  label="P tổng 3 pha (W)"
                  id="Ptotal"
                  value={form.Ptotal}
                  onChange={set('Ptotal')}
                  placeholder="Ví dụ: 3990"
                />
              </Card>

              <Card title="Công suất từng pha" badge="Tùy chọn — tăng độ chính xác">
                <div style={{ marginBottom: 10, padding: '8px 10px', background: '#FFFBEA', borderRadius: 8, fontSize: 12, color: '#7D5A00' }}>
                  💡 Để trống nếu công tơ không hiển thị từng pha. Khi có Pa/Pb/Pc, thuật toán chính xác hơn rõ rệt.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
                  <PhaseLabel label="Pa (W)" color="#CC0000" bg="#FFF0F0" />
                  <PhaseLabel label="Pb (W)" color="#7D5A00" bg="#FFF8E0" />
                  <PhaseLabel label="Pc (W)" color="#0064C8" bg="#E8F2FF" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <Field id="Pa" value={form.Pa_do} onChange={set('Pa_do')} placeholder="có thể âm" />
                  <Field id="Pb" value={form.Pb_do} onChange={set('Pb_do')} placeholder="có thể âm" />
                  <Field id="Pc" value={form.Pc_do} onChange={set('Pc_do')} placeholder="có thể âm" />
                </div>
              </Card>

              {error && (
                <div style={{
                  background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 12,
                  padding: '12px 14px', fontSize: 13, color: '#C62828', marginBottom: 12,
                }}>
                  ❌ {error}
                </div>
              )}

              <button
                onClick={runDiagnosis}
                disabled={loading}
                style={{
                  width: '100%', padding: 16,
                  background: loading ? '#9BB8D3' : 'linear-gradient(135deg,#1F4E79,#2E75B6)',
                  color: 'white', border: 'none', borderRadius: 14,
                  fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(30,78,121,0.35)',
                }}
              >
                {loading ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⚙️</span>
                    Đang phân tích...
                  </>
                ) : (
                  <>⚡ Chạy chẩn đoán</>
                )}
              </button>

              <button
                onClick={() => setForm({
                  Ua:'',Ub:'',Uc:'',Ia:'',Ib:'',Ic:'',
                  phiA:'',phiB:'',phiC:'',phiMode:'180',
                  Ptotal:'',Pa_do:'',Pb_do:'',Pc_do:'',
                })}
                style={{
                  width: '100%', padding: 11, marginTop: 8,
                  background: 'white', color: '#666',
                  border: '1px solid #DDD', borderRadius: 10,
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                Xóa form
              </button>
            </>
          )}

          {/* ── KẾT QUẢ ── */}
          {step === 'result' && result && (
            <>
              {/* Metrics */}
              <Card title="Chỉ số kỹ thuật tính toán">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
                  <MetricBox label="|P| tính toán" value={m.Pcalc || '—'} sub="Tổng trị tuyệt đối 3 pha" />
                  <MetricBox label="Tỷ lệ P_đo/P_tính" value={m.P_ratio || '—'} sub="≈1.0: đúng | <0: đảo ngược" />
                  <MetricBox label="Số pha bị đảo" value={`${m.numFlipped ?? '—'} pha`} sub="Phát hiện qua phi hoặc ratioX" />
                  <MetricBox label="Pa/Pb/Pc từng pha" value={m.hasPabc ? '✓ Có' : 'Không'} sub={m.hasPabc ? 'Độ chính xác cao hơn' : 'Chỉ dùng P tổng'} />
                </div>
                {m.hasPabc && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {[['A', m.ratioA, '#CC0000'], ['B', m.ratioB, '#7D5A00'], ['C', m.ratioC, '#0064C8']].map(([ph, val, col]) => (
                      <div key={ph} style={{
                        background: val && parseFloat(val) < -0.5 ? '#FFEBEE' : '#F7F9FB',
                        borderRadius: 10, padding: '8px 10px', border: `1px solid ${val && parseFloat(val) < -0.5 ? '#FFCDD2' : '#EEE'}`,
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 2 }}>Ratio pha {ph}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: val && parseFloat(val) < -0.5 ? '#C62828' : '#1F4E79' }}>
                          {val ?? '—'}
                        </div>
                        {val && parseFloat(val) < -0.5 && (
                          <div style={{ fontSize: 9, color: '#C62828', marginTop: 2 }}>ĐẢO NGƯỢC</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {result.conclusion && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px',
                    background: '#EBF3FB', borderRadius: 10,
                    fontSize: 13, color: '#1F4E79', fontWeight: 500,
                    borderLeft: '3px solid #2E75B6',
                  }}>
                    {result.conclusion}
                  </div>
                )}
              </Card>

              {/* Top 3 */}
              {(result.results || []).slice(0, 3).map((r, i) => {
                const cfg = RANK_CONFIG[i];
                return (
                  <div key={i} style={{
                    background: cfg.bg, borderRadius: 16, padding: 14,
                    marginBottom: 10, borderLeft: `4px solid ${cfg.border}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                    <div style={{ fontSize: 11, color: cfg.titleColor, fontWeight: 600, marginBottom: 5 }}>
                      {cfg.icon} {cfg.label}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>{r.desc}</div>
                    <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#888', marginBottom: 4, letterSpacing: 0.5 }}>
                        HÀNH ĐỘNG KIỂM TRA
                      </div>
                      <div style={{ fontSize: 13, color: '#1a1a1a', lineHeight: 1.5 }}>{r.action}</div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={reset}
                style={{
                  width: '100%', padding: 14, marginTop: 4,
                  background: 'linear-gradient(135deg,#1F4E79,#2E75B6)',
                  color: 'white', border: 'none', borderRadius: 14,
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                ← Nhập lại thông số mới
              </button>
            </>
          )}
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          * { box-sizing: border-box; }
          input:focus { border-color: #2E75B6 !important; box-shadow: 0 0 0 3px rgba(46,117,182,0.15) !important; outline: none !important; }
          select:focus { border-color: #2E75B6 !important; outline: none !important; }
          button:active { transform: scale(0.98); }
        `}</style>
      </div>
    </>
  );
}
