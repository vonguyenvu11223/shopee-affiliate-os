# Product Radar

Radar ưu tiên `EARLY_RISING` và `BREAKOUT`, không ưu tiên sản phẩm chỉ vì tổng số đã bán lớn.

Các input cốt lõi: velocity theo cửa sổ thời gian, acceleration, freshness, commission quality, seller reliability, content fit, data quality và opportunity half-life. Master score hiện được version hóa bằng hằng `SCORING_VERSION` trong engine.

Khi kết nối dữ liệu thật, snapshot phải bất biến, có `captured_at` và index theo `(product_id, captured_at)`. Metric dẫn xuất cần lưu version công thức và nguồn dữ liệu.
