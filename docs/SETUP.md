# Dựng lại dự án từ đầu

Hướng dẫn này giả sử bạn chỉ còn repo GitHub, còn Supabase, Expo, key Gemini và file `.env` đều đã mất.
Làm lần lượt từ trên xuống, mất khoảng 30–45 phút.

## 0. Chuẩn bị

| Cần có | Ghi chú |
| --- | --- |
| Node.js 22 trở lên | [nodejs.org](https://nodejs.org) |
| Git | để clone repo |
| Tài khoản Supabase | [supabase.com](https://supabase.com), gói Free là đủ |
| Tài khoản Google | để lấy key Gemini tại [aistudio.google.com](https://aistudio.google.com/apikey) |
| Tài khoản Expo | [expo.dev](https://expo.dev), chỉ cần nếu muốn build APK |
| App **Expo Go** trên điện thoại | bản mới nhất trên CH Play / App Store |

Lấy code về máy và cài thư viện:

```bash
git clone https://github.com/haphu2512-java/Asset-Management.git
cd Asset-Management
npm install
```

## 1. Tạo project Supabase

1. Vào [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Chọn region gần (ví dụ Singapore), đặt mật khẩu database và lưu lại.
2. Đợi project khởi tạo xong (1–2 phút).
3. Vào **Project Settings → API** và ghi lại:
   - **Project URL**, dạng `https://abcdxyz.supabase.co`
   - **anon public** key
   - **Project ref**: đoạn `abcdxyz` trong URL ở trên

## 2. Tạo bảng và bảo mật (migrations)

Mở **SQL Editor** trên dashboard, bấm **New query**, rồi dán và chạy (**Run**) **lần lượt theo đúng thứ tự** nội dung bốn file sau:

1. `supabase/migrations/20261001000000_base_schema.sql`: bảng `assets`, `transactions` và RLS
2. `supabase/migrations/20261021120000_market_prices_and_goals.sql`: cột giá thị trường và bảng `goals`
3. `supabase/migrations/20261022090000_ai_usage.sql`: hạn mức AI mỗi ngày
4. `supabase/migrations/20261025180000_goals_recurring_and_categories.sql`: mục tiêu định kỳ (DCA), phân loại danh mục mục tiêu

Kiểm tra: vào **Table Editor**, phải thấy 4 bảng `assets`, `transactions`, `goals`, `ai_usage`, và bảng nào cũng có nhãn **RLS enabled**.

> Cách khác bằng dòng lệnh: `npx supabase link --project-ref <project-ref>` rồi `npx supabase db push`.

## 3. Cấu hình đăng nhập

Vào **Authentication → Sign In / Providers → Email**:

- Để bật **Confirm email** (mặc định) thì người dùng mới phải bấm link trong email trước khi đăng nhập.
- Nếu chỉ dùng cá nhân và muốn đăng ký xong vào app luôn, tắt **Confirm email**.

## 4. Key Gemini và deploy Edge Functions

1. Tạo key tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key**.
2. Trong thư mục dự án, chạy:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase secrets set GEMINI_API_KEY=<key-gemini>
   npx supabase functions deploy advisor parse-transaction
   ```

   - `login` mở trình duyệt để đăng nhập Supabase.
   - `supabase/config.toml` trong repo tắt bước kiểm tra JWT ở gateway (`verify_jwt = false`), vì hàm tự kiểm tra người dùng.
     Nếu deploy theo cách khác (không dùng file này), thêm `--no-verify-jwt` vào lệnh deploy, nếu không mọi yêu cầu AI sẽ bị 401.
   - Nếu `deploy` báo cần Docker, thêm `--use-api` vào cuối lệnh.
   - `SUPABASE_URL` và `SUPABASE_ANON_KEY` có sẵn trong Edge Function, không cần đặt.
3. Kiểm tra: vào **Edge Functions** trên dashboard, phải thấy `advisor` và `parse-transaction`.

## 5. Chạy app bằng Expo Go

1. Tạo file `.env` từ mẫu và điền thông tin ở bước 1:

   ```bash
   cp .env.example .env
   ```

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://abcdxyz.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
   ```

2. Chạy:

   ```bash
   npm start
   ```

3. Mở **Expo Go** trên điện thoại và quét mã QR (iPhone thì quét bằng Camera). Điện thoại và máy tính cần chung Wi-Fi.
   Khác mạng hoặc quét không vào được thì dùng `npx expo start --tunnel`.
4. Đăng ký tài khoản trong app, thêm một tài sản và thử **Cố vấn AI** để chắc mọi thứ đã nối đúng.

## 6. (Tuỳ chọn) Build APK tự động trên EAS

Bước này chỉ cần khi muốn có file APK cài thẳng, không qua Expo Go.

1. Đăng nhập Expo và gắn project:

   ```bash
   npx eas-cli login
   npx eas-cli init
   ```

   Nếu tài khoản Expo mới khác tài khoản cũ (`haphu`), `eas init` sẽ báo project không thuộc về bạn. Khi đó xoá
   `"owner"` và `extra.eas.projectId` trong `app.json`, chạy lại `npx eas-cli init` rồi commit `app.json`.

2. Khai báo biến môi trường cho bản build, vì `.env` không được gửi lên EAS:

   ```bash
   for ENV in preview production; do
     npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://abcdxyz.supabase.co --environment $ENV --visibility plaintext
     npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-public-key> --environment $ENV --visibility plaintext
   done
   ```

3. Tạo token tại [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens), rồi trên GitHub vào
   **Settings → Secrets and variables → Actions → New repository secret**, đặt tên `EXPO_TOKEN` và dán token vào.
4. Từ giờ, mỗi lần push lên `main` (trừ khi chỉ sửa file `.md` hoặc thư mục `supabase/`), GitHub Actions sẽ chạy test rồi
   gửi build lên EAS. APK có tại expo.dev → project → **Builds**. Có thể build tay bằng
   `npx eas-cli build --platform android --profile preview`.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân và cách sửa |
| --- | --- |
| App báo "Thiếu biến môi trường EXPO_PUBLIC_SUPABASE_URL…" | Chưa có `.env` (Expo Go) hoặc chưa đặt biến trên EAS (APK). Sửa xong chạy lại `npm start -- --clear`. |
| "Không tải được dữ liệu từ máy chủ" | Chưa chạy đủ 3 file migration ở bước 2. |
| Cố vấn AI báo "Không kiểm tra được hạn mức AI" | Chưa chạy `20261022090000_ai_usage.sql`. |
| Cố vấn AI báo "Máy chủ chưa cấu hình GEMINI_API_KEY" | Chưa chạy `supabase secrets set` ở bước 4. Đặt xong không cần deploy lại. |
| "Phiên đăng nhập đã hết hạn" | Đăng xuất rồi đăng nhập lại. |
| "Máy chủ AI từ chối yêu cầu (401)" | Gateway đang kiểm tra JWT: deploy lại bằng lệnh ở bước 4 (đọc `supabase/config.toml`) hoặc thêm `--no-verify-jwt`. |
| "Bạn đã dùng hết 50 lượt AI hôm nay" | Hạn mức theo ngày; sửa `DAILY_AI_LIMIT` trong `supabase/functions/_shared/gemini.ts` rồi deploy lại. |
| Đăng ký xong không đăng nhập được | Đang bật Confirm email: mở email xác nhận, hoặc tắt ở bước 3. |
| Expo Go báo "Failed to download remote update" | Lỗi kết nối mạng giữa điện thoại và máy tính. Chạy lại bằng `npx expo start --tunnel`. |
| Cố vấn AI báo "AI tạm thời không phản hồi" | Key Gemini chưa đúng hoặc model AI bị hạn chế; hãy đặt lại `GEMINI_API_KEY` và deploy lại Edge Functions theo bước 4. |
| Expo Go báo không hỗ trợ SDK | Cập nhật Expo Go lên bản mới nhất. |
