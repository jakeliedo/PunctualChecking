# CLAUDE.md

> Brief đầy đủ cho Claude Code về project sân bóng chuyền.

## Trạng thái hiện tại

Project **đã hoàn chỉnh và deploy**. App đang chạy tại:
**`https://jakeliedo.github.io/PunctualChecking/`**

Repo git thật nằm ở `volleyball-checkin/` (có `.git` riêng), không phải thư mục gốc `PunctualChecking/`.

```
d:\Python\Projects\PunctualChecking\
├── CLAUDE.md                     ← file này
├── volleyball-checkin-app.jsx    ← prototype gốc (không còn dùng)
└── volleyball-checkin/           ← project thật (git repo)
    ├── src/
    │   ├── App.jsx               ← toàn bộ UI + logic
    │   └── firebase.js           ← Firestore helpers + roomId
    ├── vite.config.js
    ├── .github/workflows/deploy.yml
    └── package.json
```

## Bối cảnh nghiệp vụ

Quản lý sân bóng chuyền tự phát. Chi phí cố định: tiền sân 375k + tiền nước 15k = 390k/ngày. Phí người chơi mặc định 20.000đ/người/buổi. ~21 thành viên cố định + khách vãng lai.

## Stack kỹ thuật

| Thành phần | Chi tiết |
|---|---|
| Frontend | Vite + React 19, Tailwind CSS v4 |
| Icons | lucide-react |
| Cloud storage | **Firebase Firestore** (free tier) |
| Local cache | localStorage (dual-write với Firestore) |
| Deploy | GitHub Pages qua GitHub Actions |
| PWA | vite-plugin-pwa, Workbox service worker |

## Lớp lưu trữ — `src/firebase.js`

Storage dùng **dual-write**: ghi đồng thời vào localStorage (tức thì) VÀ Firestore (cloud backup). Khi đọc, Firestore được ưu tiên; nếu offline thì fallback localStorage.

```js
storageGet(key)       // Firestore first → localStorage fallback
storageSet(key, val)  // localStorage instant + Firestore async
storageDelete(key)    // xoá cả hai
listDayKeys()         // đọc meta/index từ Firestore → fallback localStorage scan
restoreBackup(data)   // viết cả localStorage lẫn Firestore
```

**Cấu trúc Firestore:**
```
/rooms/{roomId}/data/{key}   → { value: ... }
/rooms/{roomId}/meta/index   → { dayKeys: ['day:2026-08-08', ...] }
```

**roomId** = **cố định** `be015f059bde59eb`, hardcode trực tiếp trong `firebase.js`:
```js
export const roomId = 'be015f059bde59eb';
```
Không còn logic URL param / localStorage / cookie cho roomId. Mọi người mở cùng URL đều vào đúng phòng Firestore này — kể cả Safari hay PWA Home Screen.

**Firebase config** truyền qua env vars (`VITE_FIREBASE_*`), inject lúc build từ GitHub Secrets.

## Tính năng hiện tại

### Tab "Hôm nay"
- Scoreboard: số người, tổng đã thu, còn nợ (real-time)
- Mỗi người: 2 chip **Cash / Transfer** để đánh dấu đã đóng
- Chip toggle: bấm lại để bỏ đánh dấu
- Ô nhập tiền tùy chỉnh (cho trường hợp đóng gộp)
- **Sort tự động**: người chưa đóng luôn hiện trên cùng; người đã đóng / được trả thay hoàn toàn xuống dưới. Khách vãng lai sau thành viên chính. Thứ tự trong nhóm giữ theo insertion order (stable) → người mới thêm nổi lên trên những người đã thanh toán.
- **Trả tiền thay (PayFor)**: nút `←→` — A có thể trả thay cho B, B vẫn trả cho C
  - Logic: `effectiveFee = fee × ((paidBy ? 0 : 1) + paidForNames.length)`
  - Người được trả thay hoàn toàn (paidBy set, paidForNames rỗng) → xám, không cần đóng
  - Người vừa được trả thay vừa trả cho người khác → vẫn hiện chip, phải đóng phần của người họ bao
  - Người được trả thay vẫn có thể được chọn trong modal PayFor của người khác
  - `recalcPaidAmounts` chạy sau mọi thay đổi quan hệ, normalize lại amount của tất cả paid checkins
- **Lock/Unlock báo cáo ngày**: icon 🔒/🔓 cạnh text ngày ở header
  - Bấm icon → nhập passcode `6648` → toggle khoá/mở
  - Khi khoá: banner vàng trong tab, nút thêm bị ẩn, payment area dim + `pointerEvents: none`
  - `locked` state lưu cùng day data trong Firestore
  - Tất cả handlers guard `if (isLocked) return`
- **Ghi chú ngày (Day Note)**: nút 📝 bên dưới dòng "TM cần nạp vào Momo"
  - Bấm → popup bottom sheet, textarea 5 dòng, nút Huỷ/Lưu
  - Lưu vào `day data` cùng checkins trong Firestore (field `note`)
  - Hiện preview text trong nút nếu đã có ghi chú
- Khách vãng lai: tên tự động có hậu tố ` **`, luôn hiện cuối danh sách

### Tab "Danh sách"
- Tìm kiếm tên
- Bấm để thêm/bỏ khỏi hôm nay
- Sắp xếp theo **tổng số buổi tham gia** (`playCount` tuyệt đối, cao → thấp) — không dùng công thức tỷ lệ nữa vì skew thành viên mới
- Nhập nhanh nhiều tên: tự bỏ số thứ tự "8/ Tên", lọc trùng
- Xoá toàn bộ danh sách: khoá bằng passcode **`6648`**

### Tab "Báo cáo"
- Danh sách ngày đã lưu (từ `listDayKeys()`)
- Bấm để xem lại phiếu thu ngày đó
- Xoá ngày: cần passcode `6648`

### Tab "Quyết toán"
- Tính toán chi phí theo chu kỳ (chọn nhiều ngày)
- Xuất ảnh quyết toán
- **Phân tích thành viên** (section dưới cùng, luôn hiện khi có dữ liệu lịch sử):
  - Tính từ **toàn bộ** `dayData` (không phụ thuộc ngày được chọn)
  - Mỗi thành viên: số buổi / tổng ngày (progress bar + %), tổng tiền đã đóng, TB/buổi
  - Badge "trả thay ×N" nếu hay bao người, "được trả thay N lần" nếu hay được bao
  - Chỉ tính thành viên chính thức (loại `isGuest`)
  - Sort 3 tiêu chí: **Số buổi** (mặc định) / **Tổng đóng** / **TB/buổi**

### Xuất báo cáo (nút vàng)
- Canvas API → ảnh PNG
- Web Share API trên iOS (lưu vào Ảnh)
- Bảng: STT · Tên · Trạng thái · Hình thức · Tiền
  - "Hình thức": hiện **CK** (xanh đậm) nếu `method === 'transfer'`; trống nếu Cash
  - Trạng thái: `✓ Paid` / `↙ Paid by` / `✗ Chưa đóng`
- Header: `{Thứ}, {DD/MM/YYYY}` bên trái + `Số người: N` bên phải
- Footer: Tổng thu, Thu về Quỹ Momo (= tổng thu − tiền nước), **Chưa đóng:** (font nhỏ hơn)
- Chú thích `** Khách vãng lai` nếu có
- Hỗ trợ hiển thị quan hệ trả thay trong canvas (ghi chú dòng nhỏ)

### Cài đặt (icon bánh răng `Settings`)
- **Full-screen page** (không phải bottom sheet), không cuộn
- 4 card: Phí (3 ô ngang) · Link chia sẻ · Sao lưu · Ngày cũ
- Ô nhập ngày cũ + nút "Chuyển" inline cùng hàng
- **Link chia sẻ**: hiện URL cố định của app, nút "Sao chép link"
- Backup: Xuất/Nhập JSON (đồng bộ cả localStorage + Firestore)
- Nhập dữ liệu ngày cũ: chọn ngày → chuyển về ngày đó để nhập

## Deploy

- **GitHub Actions**: `.github/workflows/deploy.yml`
- Build: `npm run build` với `BASE_PATH=/PunctualChecking/`
- Secrets cần có trong GitHub: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
- `npm install` (không dùng `npm ci` vì package-lock.json không luôn sync)

## Lưu ý quan trọng

- **DEFAULT_MEMBERS** trong App.jsx chỉ dùng lần đầu khi Firestore chưa có data — không ghi đè data thật
- Passcode `6648` chỉ chống bấm nhầm, không phải bảo mật thật (có trong source)
- roomId cố định trong source code — ai có link app đều đọc/ghi được cùng 1 phòng. Firestore Security Rules hiện `allow read, write: if true`
- Font Oswald/Inter load qua Google Fonts — service worker cache sau lần đầu
- iOS Safari và PWA (Home Screen) có localStorage riêng biệt → không còn vấn đề vì roomId đã hardcode, không cần localStorage
- `dateLoadingRef` mutex trong App ngăn persist effect ghi data cũ lúc đang switch ngày
- Persist effect guard: `if (loading || dateLoadingRef.current || isLocked) return;`

## Bối cảnh liên quan

Tách biệt hoàn toàn với **TechNote** (FastAPI + PostgreSQL + WebSocket + FCM + Cloudflare Tunnel tại Club V).
