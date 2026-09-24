# Hướng dẫn deploy PAT WORKSPACE lên GitHub Pages + cài đặt app

## 1. Đưa 6 file lên GitHub
1. Tạo repo mới trên GitHub (public).
2. Đẩy 6 file: `index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`,
   `icon-512-maskable.png` lên **thư mục gốc** của repo (không để trong thư mục con).
3. Vào Settings → Pages → Source: chọn branch `main`, thư mục `/ (root)` → Save.
4. Đợi vài phút, mở `https://<username>.github.io/<ten-repo>/`.

Vì `start_url` và `scope` dùng đường dẫn tương đối (`./`) nên không cần sửa gì thêm dù URL cuối có dạng `username.github.io/ten-repo/`.

## 2. Cài trên Android (Chrome)
Mở link trên → menu 3 chấm (góc phải) → "Cài đặt ứng dụng" hoặc "Thêm vào Màn hình chính".

## 3. Cài trên Windows 11 (Edge/Chrome)
Mở link trên → bấm icon "Cài đặt" trên thanh địa chỉ, hoặc menu → Ứng dụng → "Cài đặt trang này như một ứng dụng".

## 4. Kiểm tra chuẩn PWA
DevTools (F12) → tab Lighthouse → chọn "Progressive Web App" → Analyze.

## Lưu ý riêng cho PAT WORKSPACE
- **Đăng nhập Google Calendar:** Client ID trong phần mềm hiện chỉ khai báo cho `https://pat-workspace-portal.web.app` (và `.firebaseapp.com`).
  Nếu deploy ở `https://<username>.github.io`, cần vào Google Cloud Console → Credentials → OAuth Client ID → thêm
  `https://<username>.github.io` vào **Authorized JavaScript origins** (chỉ cần domain, không cần đường dẫn repo). Nếu không, nút "Mở Lịch Gmail" sẽ không đăng nhập được.
- **Dữ liệu không tự chuyển giữa các "địa chỉ":** dữ liệu nằm trong IndexedDB của trình duyệt theo từng origin. Bản mở bằng `file://`, bản trên `github.io` và bản trên `web.app` là 3 kho dữ liệu riêng. App cài từ cùng một link thì dùng chung dữ liệu với tab trình duyệt của link đó.
- **Thời tiết / AQI / Google Calendar** luôn gọi mạng trực tiếp, service worker không cache và không can thiệp các request này. Khi offline, app vẫn mở được và hiển thị dữ liệu đã lưu lần trước.
- **Cập nhật phiên bản:** thay `index.html` mới trên repo là đủ, app tự lấy bản mới ở lần mở kế tiếp. Muốn ép mọi máy bỏ cache cũ: đổi `v1` → `v2` trong `CACHE_NAME` ở `sw.js`.
- File vẫn mở được bình thường qua double-click (`file://`), chạy offline hoàn toàn.
