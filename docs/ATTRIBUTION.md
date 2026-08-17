# Attribution

Mỗi content dùng một bộ tracking ổn định:

| Trường | Ý nghĩa | Ví dụ |
|---|---|---|
| Sub_id1 | Nền tảng | `tiktok` |
| Sub_id2 | Kênh/tài khoản | `nguyenvu` |
| Sub_id3 | Content duy nhất | `mayhutbui001` |
| Sub_id4 | Biến thể creative | `v1` |
| Sub_id5 | Chiến dịch | `test082026` |

Chỉ dùng chữ và số. Không tái sử dụng Sub_id3 cho hai video khác nhau. Điền các giá trị này trong hộp thoại Shopee trước khi bấm “Lấy link”.

Nếu các link cũ được tạo với Sub_id trống, hệ thống chỉ có thể đo tổng click/đơn, không thể quy kết chính xác cho từng video.

Attribution của Shopee là nguồn xác nhận click/đơn; views lấy từ chính TikTok/YouTube cho cùng cửa sổ thời gian.

Người dùng phải khai báo rõ ngày bắt đầu và kết thúc của cửa sổ báo cáo. PostgreSQL từ chối hai kỳ chồng lấn cho cùng experiment để tránh cộng đôi click, đơn và hoa hồng khi xây baseline.

Khi Supabase được cấu hình, mỗi file báo cáo được nhận diện bằng SHA-256. Hệ thống lưu tên file, loại báo cáo, số dòng, header, cảnh báo và số tổng hợp; nội dung CSV gốc không được lưu. Metric của experiment liên kết riêng tới import run Click và Conversion để có thể audit nguồn. File trùng hash không tạo import run mới.

Khi lưu metric cho một experiment, cả API và PostgreSQL đều yêu cầu báo cáo chứa đúng tracking key được ghép từ đủ `Sub_id1–5`. Số tổng của báo cáo thiếu Sub_id chỉ dùng để tham khảo tổng quan, không được quy cho một content cụ thể.
