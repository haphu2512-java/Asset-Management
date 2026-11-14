# Asset Management – bản web

Bản web của app quản lý tài chính cá nhân, viết bằng React + Vite (TypeScript). Đăng nhập bằng cùng tài khoản và dùng
chung dữ liệu Supabase với app điện thoại: thêm giao dịch ở web thì điện thoại thấy ngay và ngược lại.

Phần tính toán, đồng bộ và lưu trữ được dùng lại nguyên vẹn từ `../src` (`store.tsx`, `sync.ts`, `finance.ts`,
`ledger.ts`, `budgets.ts`, `recurring.ts`, `investments.ts`, `reports.ts`, `csv.ts`, `advisor.ts`, `quickEntry.ts`…),
nên hai bản luôn tính ra cùng một con số. Thư mục này chỉ chứa giao diện cho trình duyệt.

## Tính năng

Tổng quan (tài sản ròng, thay đổi so với hôm qua, thu chi, ngân sách, khoản sắp đến hạn, cơ cấu tài sản), Tài sản và ví
(kể cả cổ phiếu, crypto, vàng, ngoại tệ có sổ lệnh và lãi/lỗ; tiết kiệm, cho vay, nợ có lãi suất), Thu chi (tìm kiếm, lọc,
nhập nhanh bằng chữ hoặc ảnh hoá đơn), Ngân sách (gợi ý theo 3 tháng và quy tắc 50/30/20), Giao dịch định kỳ, Mục tiêu,
Báo cáo, Danh mục tự tạo, Cố vấn AI, xuất/nhập CSV, giao diện sáng/tối, ẩn số dư, dùng được khi mất mạng.

Chỉ có trên app điện thoại: khoá app bằng sinh trắc học và thông báo nhắc.

## Chạy trên máy

```bash
cd web
cp .env.example .env   # điền URL và anon key của project Supabase (giống file .env của app điện thoại)
npm install
npm run dev            # http://localhost:5173
```

```bash
npm run typecheck      # kiểm tra kiểu TypeScript
npm run build          # đóng gói vào web/dist
```

## Deploy lên Vercel

1. Trên [vercel.com](https://vercel.com) chọn **Add New → Project** và import repo này. Không cần đổi gì ở phần Build:
   file `vercel.json` ở gốc repo đã khai báo lệnh cài đặt, lệnh build và thư mục kết quả (`web/dist`).
   Giữ **Root Directory** là gốc repo.
2. Ở **Environment Variables** thêm hai biến (dùng cùng giá trị với app điện thoại):

   | Tên | Giá trị |
   | --- | --- |
   | `EXPO_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key của project |

3. Bấm **Deploy**. Mỗi lần push lên `main`, Vercel tự deploy lại.
4. Trong Supabase mở **Authentication → URL Configuration**, đặt **Site URL** (hoặc thêm vào **Redirect URLs**) địa chỉ
   Vercel của bạn, ví dụ `https://ten-app.vercel.app`, để liên kết trong thư kích hoạt tài khoản mở đúng trang web.

Anon key là khoá công khai, dữ liệu được bảo vệ bằng Row Level Security của Supabase nên đặt nó ở phía trình duyệt là an toàn.
Nếu thiếu hai biến trên, trang web sẽ hiện hướng dẫn thay vì màn hình đăng nhập.
