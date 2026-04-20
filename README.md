# ⚡ App Chẩn đoán lỗi đấu dây điện kế 3 pha gián tiếp

Ứng dụng web chạy trên điện thoại Android/iPhone, giúp kỹ thuật viên chẩn đoán 6 trường hợp lỗi đấu dây điện kế 3 pha gián tiếp bằng thuật toán Naive Bayes v6.5.

---

## 🚀 HƯỚNG DẪN TRIỂN KHAI (10-15 phút)

### BƯỚC 1 — Tạo API key Anthropic

1. Mở trình duyệt, vào **https://console.anthropic.com**
2. Đăng nhập (hoặc tạo tài khoản mới bằng email)
3. Vào **Settings → API Keys → Create Key**
4. Đặt tên: `daiday-dienke`
5. **Sao chép key** (dạng `sk-ant-api03-...`) — lưu vào notepad, chỉ hiện 1 lần!
6. Vào **Billing → Add Credit** → nạp **$5** (đủ dùng 1.000–2.000 lần chẩn đoán)

---

### BƯỚC 2 — Tạo tài khoản GitHub và tải code lên

1. Vào **https://github.com** → Sign up (nếu chưa có)
2. Click **"New repository"** (dấu `+` góc trên phải)
3. Đặt tên repository: `chandoan-daiday`
4. Chọn **Public**, click **Create repository**
5. Tải file **chandoan-daiday.zip** về máy tính
6. Giải nén zip → bạn sẽ thấy thư mục `daidayweb`
7. Trên trang GitHub vừa tạo, click **"uploading an existing file"**
8. Kéo thả **tất cả các file bên trong thư mục `daidayweb`** vào trang GitHub (không kéo cả thư mục, kéo các file bên trong)
9. Click **"Commit changes"**

---

### BƯỚC 3 — Deploy lên Vercel (miễn phí, 5 phút)

1. Vào **https://vercel.com** → Sign up bằng tài khoản GitHub
2. Click **"Add New Project"**
3. Chọn repository `chandoan-daiday` → click **Import**
4. **QUAN TRỌNG** — Trước khi Deploy, click **"Environment Variables"**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: dán API key đã lưu ở Bước 1 (`sk-ant-api03-...`)
   - Click **Add**
5. Click **Deploy**
6. Đợi 1-2 phút → Vercel sẽ tạo link dạng: `https://chandoan-daiday-xxx.vercel.app`

---

### BƯỚC 4 — Chia sẻ link cho kỹ thuật viên

- Gửi link Vercel cho tất cả KTV qua Zalo/nhóm chat
- KTV mở link trên Chrome Android → Menu → **"Thêm vào màn hình chính"**
- App hiện như một ứng dụng thực sự trên điện thoại!

---

## 🔒 BẢO MẬT

- API key được lưu **trên server Vercel**, không ai nhìn thấy
- App không lưu bất kỳ dữ liệu nào của người dùng
- Mỗi lần chẩn đoán tốn khoảng **$0.002–0.005** (khoảng 100–200 đồng)

---

## 💰 CHI PHÍ ƯỚC TÍNH

| Số lần dùng/tháng | Chi phí API/tháng |
|---|---|
| 200 lần | ~$0.4–1 |
| 1.000 lần | ~$2–5 |
| 5.000 lần | ~$10–25 |

---

## ❓ THÊM MẬT KHẨU (nếu muốn giới hạn người dùng)

Nếu muốn chỉ KTV nội bộ được dùng, thêm biến môi trường:
- Name: `APP_PASSWORD`  
- Value: mật khẩu tùy chọn (ví dụ: `EVN2026`)

Sau đó sửa file `pages/api/diagnose.js`, thêm vào đầu hàm handler:
```javascript
const pwd = req.headers['x-app-password'];
if (pwd !== process.env.APP_PASSWORD) {
  return res.status(401).json({ error: 'Sai mật khẩu' });
}
```

---

## 📋 TÍNH NĂNG

- ✅ Nhập U, I, φ (3 pha) + P tổng
- ✅ Nhập Pa/Pb/Pc từng pha (tùy chọn, tăng độ chính xác)
- ✅ Hỗ trợ Gốc 180° và Gốc 360°
- ✅ Phát hiện 7 trường hợp: Bình thường + TH1–TH6
- ✅ Hiển thị Top 3 xếp hạng + hành động kiểm tra
- ✅ Hiển thị chỉ số kỹ thuật (Pcalc, P_ratio, ratioX từng pha)
- ✅ Tối ưu cho điện thoại Android/iPhone
- ✅ Có thể cài như app (Add to Home Screen)

---

## 🐛 XỬ LÝ SỰ CỐ

**Lỗi "API key chưa được cấu hình":**
→ Vào Vercel → Project → Settings → Environment Variables → kiểm tra `ANTHROPIC_API_KEY`

**Lỗi "Insufficient credit":**
→ Vào console.anthropic.com → Billing → nạp thêm credit

**App chạy chậm:**
→ Bình thường, lần đầu Vercel "warm up" mất 2-3 giây. Từ lần 2 trở đi nhanh hơn.

---

Phiên bản: v6.5 | Năm: 2026
