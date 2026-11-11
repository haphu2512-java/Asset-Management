# Asset Management

Ứng dụng di động quản lý tài chính cá nhân, viết bằng React Native + Expo (TypeScript), dữ liệu lưu trên Supabase.

## Tính năng

- **Tổng quan:** tài sản ròng và thay đổi so với hôm qua, thu chi tháng này, ngân sách, khoản định kỳ sắp đến hạn,
  cơ cấu tài sản. Bấm vào từng mục để xem chi tiết. Có nút ẩn số dư và giao diện sáng/tối.
- **Tài sản và ví:** Tiền mặt, Ngân hàng, Tiết kiệm, Cổ phiếu, Crypto, Vàng, Ngoại tệ, Cho vay, Đang nợ.
  Ví (tiền mặt, ngân hàng) gắn với giao dịch nên số dư tự cộng trừ; có chuyển khoản giữa các ví và điều chỉnh số dư.
  Cổ phiếu, crypto, vàng, ngoại tệ nhập **mã và số lượng**, giá tự cập nhật (VNDirect, CoinGecko, open.er-api.com),
  có sổ lệnh mua/bán, **giá vốn bình quân và lãi/lỗ**. Vàng SJC có thể tự nhập giá. Tiết kiệm, khoản vay, khoản nợ có
  lãi suất, kỳ hạn, ngày đáo hạn.
- **Thu chi:** ghi thu, chi, chuyển khoản theo danh mục và danh mục con tự tạo; xem theo ngày hoặc tháng; tìm kiếm và lọc.
  **Nhập nhanh:** gõ `cafe 35k, xăng 50k` hoặc chụp hoá đơn để AI đọc. Xoá nhầm có nút **Hoàn tác**.
- **Ngân sách:** hạn mức theo danh mục, cảnh báo ở 80% và khi vượt, gợi ý theo chi tiêu 3 tháng hoặc quy tắc 50/30/20.
- **Giao dịch định kỳ:** lương, tiền nhà, hoá đơn tự ghi hoặc nhắc xác nhận khi đến hạn.
- **Mục tiêu:** mục tiêu số tiền hoặc góp định kỳ (tuần, tháng, quý), gắn với một tài khoản để mỗi lần góp tự chuyển tiền
  từ ví, có lịch sử góp.
- **Báo cáo:** biểu đồ tài sản ròng theo thời gian, so sánh tháng này với tháng trước, tổng kết năm, hiệu quả đầu tư.
- **Cố vấn AI:** trò chuyện nhiều lượt với Google Gemini dựa trên số liệu của chính bạn.
- **Dữ liệu:** xuất và nhập giao dịch bằng CSV (mở được bằng Excel).
- **Dùng khi mất mạng:** thay đổi được lưu trên máy và tự đồng bộ khi có mạng trở lại.
- **Bảo mật và nhắc nhở:** khoá app bằng vân tay/khuôn mặt, quên mật khẩu bằng mã gửi qua email, xoá tài khoản,
  nhắc ghi chi tiêu hằng ngày và nhắc các khoản đến hạn.

Ô số tiền nhận các cách nhập như `23.000.000`, `23tr`, `23000k`, `1,5tr` hoặc `2 tỷ`.

## Cài đặt Supabase

Dựng lại toàn bộ từ đầu (Supabase, Gemini, Expo Go, build APK): xem [docs/SETUP.md](docs/SETUP.md).

1. Tạo file `.env` từ `.env.example` và điền URL, anon key của project Supabase.
2. Chạy các file SQL trong `supabase/migrations/` theo thứ tự tên file (SQL editor của Supabase, hoặc `supabase db push`).
   Danh sách và ý nghĩa từng file có trong [docs/SETUP.md](docs/SETUP.md). File nào cũng chạy lại được mà không mất dữ liệu.
3. Đặt API key của Google Gemini và deploy các Edge Function:

   ```bash
   supabase secrets set GEMINI_API_KEY=AIzaSy...
   supabase functions deploy advisor
   supabase functions deploy parse-transaction
   ```

   Hạn mức AI mặc định 50 lượt mỗi người mỗi ngày, sửa `DAILY_AI_LIMIT` trong `supabase/functions/_shared/gemini.ts`.

   Edge Function chỉ phục vụ người dùng đã đăng nhập: gọi bằng anon key mà không có phiên đăng nhập sẽ bị trả 401.
4. Khi build bằng EAS, file `.env` không được gửi lên, nên cần khai báo biến môi trường trên EAS cho từng môi trường:

   ```bash
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxx.supabase.co --environment preview --visibility plaintext
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --environment preview --visibility plaintext
   ```

   Làm tương tự với `--environment production`. Thiếu hai biến này, app sẽ báo lỗi ngay khi mở.

## Chạy thử trên điện thoại

1. Cài [Node.js](https://nodejs.org) 22 trở lên và app **Expo Go** trên điện thoại.
2. Trong thư mục dự án:

   ```bash
   npm install
   npm start
   ```

3. Quét mã QR bằng Expo Go. Điện thoại và máy tính cần chung mạng Wi-Fi (hoặc chạy `npx expo start --tunnel`).

Khoá app bằng sinh trắc học và thông báo nhắc hoạt động đầy đủ trên bản build (APK), trong Expo Go có thể bị hạn chế.

## Phát triển

```bash
npm test          # unit test cho phần tính toán: sổ ví, ngân sách, định kỳ, đầu tư, báo cáo, CSV, nhắc nhở
npm run typecheck # kiểm tra kiểu TypeScript
npm run check     # cả hai lệnh trên
```

## CI/CD

- `.github/workflows/ci.yml`: mỗi pull request và mỗi lần push chạy typecheck, unit test, đóng gói thử app (web export)
  và kiểm tra kiểu Edge Function bằng Deno. Push lên `main` có thay đổi phần app sẽ build APK (profile `preview`);
  tag `v*` build bản `production`. Cần secret `EXPO_TOKEN`, thiếu thì bước build tự bỏ qua.
- `.github/workflows/supabase-deploy.yml`: khi `supabase/` thay đổi trên `main`, tự chạy migration mới và deploy lại
  Edge Function. Cần ba secret `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`; thiếu thì tự bỏ qua.
- `.github/dependabot.yml`: mở pull request cập nhật thư viện hằng tuần (các gói đi theo Expo SDK chỉ nhận bản vá).

## Cấu trúc

```
App.tsx                         khung app: header, thanh tab, nút +, khoá app, hướng dẫn lần đầu
src/finance.ts                  kiểu dữ liệu, danh mục, tính tổng, mục tiêu, đọc số tiền VND
src/ledger.ts                   ví và giao dịch: dòng tiền, chuyển khoản, điều chỉnh số dư, tìm kiếm
src/budgets.ts, recurring.ts    ngân sách và giao dịch định kỳ
src/investments.ts, prices.ts   giá vốn, lãi/lỗ, lãi tiết kiệm; lấy giá cổ phiếu, crypto, vàng, ngoại tệ
src/reports.ts, csv.ts          báo cáo và xuất/nhập CSV
src/reminders.ts, notifications.ts  lên lịch thông báo nhắc
src/store.tsx, sync.ts          trạng thái chung, bộ nhớ đệm, hàng đợi đồng bộ khi mất mạng
src/theme.tsx, prefs.tsx, nav.tsx   giao diện sáng/tối, cài đặt trên máy, điều hướng
src/advisor.ts, quickEntry.ts   gọi Edge Function `advisor` và `parse-transaction`
src/screens/                    các màn hình
src/components/                 thành phần giao diện dùng chung, biểu đồ, form
supabase/functions/             Edge Function giữ API key Gemini trên server, kiểm tra đăng nhập và hạn mức
supabase/migrations/            thay đổi cấu trúc database
```
