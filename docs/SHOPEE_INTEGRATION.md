# Shopee Integration

## Capability hiện tại

Tài khoản hiện chưa có AppID/API key và Product Feed không có dữ liệu. Production path vì vậy dùng file xuất chính thức, không scraping và không endpoint giả.

## Product snapshots

1. Vào Shopee Affiliate → Hoa hồng → Hoa hồng Sản phẩm.
2. Chọn sản phẩm và dùng “Lấy link hàng loạt”.
3. Nhập file CSV tại `/settings/shopee`.
4. Lặp lại theo cùng một tập sản phẩm ở các thời điểm khác nhau. Tối thiểu ba snapshot mới đủ nền tảng tính trend.

## Performance reports

Shopee Affiliate → Báo cáo → Báo cáo click và Báo cáo chuyển đổi. Xuất hai báo cáo cho cùng một khoảng ngày rồi nhập tại `/experiments`.

Các trạng thái không nhận diện được không được tự coi là đơn hợp lệ. Chỉ hoa hồng của đơn hoàn thành mới đi vào validated profit.

## Open API

Các biến `SHOPEE_*` là server-only. Chỉ bật provider API sau khi Shopee cấp quyền chính thức. Không dùng cookie automation, CAPTCHA bypass hoặc scraping để thay thế.

## Vì sao không dùng cookie đăng nhập

“Cookie” dùng cho attribution Affiliate và cookie phiên đăng nhập là hai khái niệm khác nhau. ProfitOS không yêu cầu, đọc, xuất, lưu hoặc replay cookie phiên Shopee. Cookie phiên có thể mang quyền truy cập tương đương phiên trình duyệt; dùng nó để gọi endpoint nội bộ không biến endpoint đó thành API chính thức.

Fallback được hỗ trợ:

1. Người dùng đăng nhập trực tiếp trên website/app Shopee chính thức.
2. Tạo link với đủ `Sub_id1–5` bằng giao diện Shopee.
3. Xuất Product Link, Click Report và Conversion Report bằng chức năng Shopee cung cấp.
4. Nhập các CSV vào ProfitOS; hệ thống kiểm tra schema, hash, chống trùng và lưu lineage.
5. Khi Shopee cấp Open API, bật provider chính thức mà không thay đổi profit/attribution engine.

Không dán cookie, access token hoặc nội dung header đăng nhập vào ProfitOS hay gửi qua chat.
