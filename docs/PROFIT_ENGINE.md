# Profit Engine

```text
Expected Net Profit
= Expected Views × CTR × Conversion Rate × Valid Order Rate
× Commission Per Order − Content Cost
```

Mọi tỷ lệ dùng số thập phân (ví dụ 2% là `0.02`). Khi thiếu lịch sử tài khoản, engine không tạo số thay thế. UI không được trình bày prediction như số liệu xác thực.

## Opportunity gate `opportunity-v1`

Command Center chỉ gắn `TEST_NOW` khi đồng thời có snapshot còn mới, trend có confidence tối thiểu 35%, baseline lợi nhuận từ dữ liệu thử nghiệm thật có confidence tối thiểu 55%, expected net profit dương và expected ROI dương. Các trọng số và ngưỡng được khai báo tập trung trong `OPPORTUNITY_V1_CONFIG` để mọi thay đổi có phiên bản và có thể kiểm thử.

`TEST_NOW` chỉ có nghĩa là đủ bằng chứng để mở một thử nghiệm nhỏ có gắn Sub_id. Nó không phải nhãn winner và không cho phép scale. Quyết định `SCALE` chỉ được đưa ra sau khi báo cáo chuyển đổi thật đã được nhập, đối soát và gắn đúng attribution key của thử nghiệm.
