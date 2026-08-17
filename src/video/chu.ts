import { loadFont as napAnton } from '@remotion/google-fonts/Anton';
import { loadFont as napBeVietnam } from '@remotion/google-fonts/BeVietnamPro';

/*
 * Chữ dùng chung — NGUỒN DUY NHẤT.
 *
 * Vì sao không dùng font hệ thống ('Segoe UI', Arial): chúng có mặt để đọc giao
 * diện, không để làm tiêu đề. Trên video dọc, tiêu đề chiếm cả bề ngang màn hình
 * mà đặt bằng Arial đậm thì nhìn hệt một trang tính được phóng to. Chữ là thứ
 * quyết định cảm giác "chuyên nghiệp" nhiều hơn bất kỳ hiệu ứng nào.
 *
 * ⚠️ CẢ HAI FONT PHẢI CÓ BỘ DẤU TIẾNG VIỆT. Đã kiểm cả hai đều khai subset
 * `vietnamese`. Chọn font Latin thường thì "Khủng long bạo chúa" ra một dãy ô
 * vuông, hoặc tệ hơn: dấu bị ghép tạm bằng cách chồng ký tự nên nhìn lệch mà
 * không hỏng hẳn — kiểu lỗi chỉ phát hiện khi xem lại video.
 *
 * Anton         — tiêu đề. Đậm, hẹp ngang, dáng áp phích tài liệu.
 * Be Vietnam Pro — mọi thứ còn lại. Font do người Việt thiết kế, dấu đặt đúng
 *                  chỗ ở mọi cỡ chữ, và có đủ 9 độ đậm.
 */

const anton = napAnton();
const beVietnam = napBeVietnam();

/** Tiêu đề lớn. */
export const CHU_TIEU_DE = anton.fontFamily;

/** Con số và nhãn số liệu — cần độ đậm cao mà vẫn đọc được ở cỡ nhỏ. */
export const CHU_SO = beVietnam.fontFamily;

/** Chữ chạy, nhãn, chú thích. */
export const CHU_THUONG = beVietnam.fontFamily;
