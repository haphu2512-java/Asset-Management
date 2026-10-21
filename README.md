# Asset Management

Ứng dụng di động quản lý tài chính cá nhân, viết bằng React Native + Expo (TypeScript).

## Tính năng

- **Tổng quan:** tài sản ròng, biểu đồ cơ cấu tài sản, thu chi và cơ cấu chi tiêu của tháng hiện tại.
- **Tài sản:** thêm, sửa, xoá các khoản Tiền mặt, Cổ phiếu, Crypto, Cho vay (cộng vào tài sản) và Đang nợ (trừ khỏi tài sản ròng).
- **Thu chi:** ghi thu nhập và chi tiêu theo danh mục, xem theo từng tháng.
- **AI:** gửi số liệu tài sản và thu chi 3 tháng gần nhất cho Claude để nhận phân tích và lời khuyên bằng tiếng Việt.

Ô số tiền nhận các cách nhập như `23.000.000`, `23tr`, `23000k`, `1,5tr` hoặc `2 tỷ`.

Dữ liệu được lưu ngay trên điện thoại (AsyncStorage), không cần server.

## Chạy thử trên điện thoại

1. Cài [Node.js](https://nodejs.org) 20 trở lên.
2. Cài app **Expo Go** trên điện thoại (Google Play hoặc App Store).
3. Trong thư mục dự án:

   ```bash
   npm install
   npm start
   ```

4. Quét mã QR hiện trong terminal bằng Expo Go. Điện thoại và máy tính cần chung mạng Wi-Fi (hoặc chạy `npx expo start --tunnel`).

## Dùng tính năng AI

Tạo API key tại [console.anthropic.com](https://console.anthropic.com), rồi dán vào tab **AI → Cài đặt API key**. Key chỉ lưu trên điện thoại và được gửi thẳng tới Anthropic khi bạn bấm **Phân tích**; mỗi lần phân tích sẽ tính phí vào tài khoản API của bạn. Đây là app cá nhân, không nên phát hành công khai với key nhúng sẵn.

## Phát triển

```bash
npm test          # chạy unit test cho phần tính toán (src/finance.ts)
npm run typecheck # kiểm tra kiểu TypeScript
```

## Cấu trúc

```
App.tsx                 thanh tab và khung app
src/finance.ts          kiểu dữ liệu, danh mục, tính tổng, định dạng và đọc số tiền VND
src/store.tsx           trạng thái chung và lưu trữ AsyncStorage
src/advisor.ts          gọi Claude để phân tích tài chính
src/screens/            các màn hình Tổng quan, Tài sản, Thu chi, AI
src/components/         biểu đồ tròn, form nhập liệu
```
