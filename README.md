# Asset Management

Ứng dụng di động quản lý tài chính cá nhân, viết bằng React Native + Expo (TypeScript), dữ liệu lưu trên Supabase.

## Tính năng

- **Tổng quan:** tài sản ròng, biểu đồ cơ cấu tài sản, thu chi và cơ cấu chi tiêu của tháng hiện tại.
- **Tài sản:** Tiền mặt, Cổ phiếu, Crypto, Cho vay (cộng vào tài sản) và Đang nợ (trừ khỏi tài sản ròng).
  Cổ phiếu và crypto có thể nhập **mã và số lượng** (ví dụ `FPT` × 100, `BTC` × 0,05); giá trị tự cập nhật theo giá thị trường
  khi mở app và mỗi 15 phút, hoặc bấm **Cập nhật giá**. Giá cổ phiếu Việt Nam lấy từ VNDirect, giá crypto (VND) từ CoinGecko.
- **Thu chi:** ghi thu nhập và chi tiêu theo danh mục, xem theo từng tháng.
  **Nhập nhanh:** gõ `cafe 35k` hoặc `cafe 35k, xăng 50k` rồi bấm Thêm, hoặc bấm 📷 để chụp/chọn ảnh hoá đơn; AI tự đọc số tiền,
  ngày và phân loại. Khi AI không phản hồi, ghi chú dạng chữ vẫn được phân loại bằng từ khoá trên máy.
- **Mục tiêu:** đặt mục tiêu tiết kiệm (ví dụ 100tr trong 1 năm), xem tiến độ, số tiền cần để dành mỗi tháng, góp thêm,
  và hỏi AI cách đạt mục tiêu dựa trên thu chi thực tế.
- **AI:** gửi số liệu tài sản, thu chi 3 tháng gần nhất và các mục tiêu cho Google Gemini để nhận phân tích và lời khuyên.

Ô số tiền nhận các cách nhập như `23.000.000`, `23tr`, `23000k`, `1,5tr` hoặc `2 tỷ`.

## Cài đặt Supabase

1. Tạo file `.env` từ `.env.example` và điền URL, anon key của project Supabase.
2. Chạy các file SQL trong `supabase/migrations/` theo thứ tự tên file (SQL editor của Supabase, hoặc `supabase db push`):
   - `..._base_schema.sql` tạo bảng `assets`, `transactions` và bật RLS để mỗi người chỉ đọc/ghi được dữ liệu của mình.
     Nếu database đã có hai bảng này, file chỉ bật lại RLS và thêm policy, không đụng tới dữ liệu.
   - `..._market_prices_and_goals.sql` thêm cột mã/số lượng/giá cho bảng `assets` và tạo bảng `goals`.
   - `..._ai_usage.sql` tạo hạn mức AI theo ngày cho mỗi người dùng (mặc định 50 lượt, sửa `DAILY_AI_LIMIT`
     trong `supabase/functions/_shared/gemini.ts`).
3. Đặt API key của Google Gemini và deploy các Edge Function:

   ```bash
   supabase secrets set GEMINI_API_KEY=AIzaSy...
   supabase functions deploy advisor
   supabase functions deploy parse-transaction
   ```

   Edge Function chỉ phục vụ người dùng đã đăng nhập: gọi bằng anon key mà không có phiên đăng nhập sẽ bị trả 401.
4. Khi build bằng EAS, file `.env` không được gửi lên, nên cần khai báo biến môi trường trên EAS cho từng môi trường:

   ```bash
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxx.supabase.co --environment preview --visibility plaintext
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --environment preview --visibility plaintext
   ```

   Làm tương tự với `--environment production`. Thiếu hai biến này, app sẽ báo lỗi ngay khi mở.

## Chạy thử trên điện thoại

1. Cài [Node.js](https://nodejs.org) 20 trở lên và app **Expo Go** trên điện thoại.
2. Trong thư mục dự án:

   ```bash
   npm install
   npm start
   ```

3. Quét mã QR bằng Expo Go. Điện thoại và máy tính cần chung mạng Wi-Fi (hoặc chạy `npx expo start --tunnel`).

## Phát triển

```bash
npm test          # unit test cho phần tính toán, mục tiêu, nhập nhanh và giá thị trường
npm run typecheck # kiểm tra kiểu TypeScript
```

## Cấu trúc

```
App.tsx                         thanh tab và khung app
src/finance.ts                  kiểu dữ liệu, danh mục, tính tổng, mục tiêu, đọc số tiền VND, nhập nhanh offline
src/prices.ts                   lấy giá cổ phiếu và crypto, tính lại giá trị tài sản
src/store.tsx                   trạng thái chung, đồng bộ Supabase, tự cập nhật giá
src/advisor.ts                  gọi Edge Function `advisor` để phân tích tài chính
src/quickEntry.ts               gọi Edge Function `parse-transaction` cho nhập nhanh và hoá đơn
src/screens/                    các màn hình Tổng quan, Tài sản, Thu chi, Mục tiêu, AI, Đăng nhập
src/components/                 biểu đồ, form nhập liệu, thanh nhập nhanh
supabase/functions/             Edge Function giữ API key Gemini trên server, kiểm tra đăng nhập và hạn mức
supabase/migrations/            thay đổi cấu trúc database
```
