/**
 * Đọc thời điểm XUẤT file từ chính tên file mà Shopee Affiliate đặt.
 *
 * Shopee đặt tên theo khuôn: "Lấy link sản phẩm hàng loạt20260814095911-<hash>.csv"
 * trong đó 14 chữ số là YYYYMMDDHHmmss của lúc bấm xuất.
 *
 * ═══ VÌ SAO CẦN ═══
 *
 * Trước đây route nhập dùng `new Date()` — tức đóng dấu lúc BẤM NHẬP, không phải
 * lúc XUẤT. Với một công cụ mà toàn bộ giá trị nằm ở việc đo thay đổi theo thời
 * gian, đó là sai ở chỗ đau nhất:
 *
 *   · Nhập một file cũ 3 ngày → nó được ghi thành "vừa xong", lịch sử mất sạch.
 *   · Nhập hai file cũ trong cùng một buổi → hai snapshot cách nhau vài phút,
 *     velocity tính ra vô nghĩa nhưng KHÔNG có gì báo sai.
 *
 * Kiểu hỏng này không ném lỗi, không hiện cảnh báo — nó chỉ lặng lẽ cho ra những
 * con số trông hợp lý mà sai.
 */

/** Khoảng chấp nhận: không nhận mốc ở tương lai, không nhận mốc quá 2 năm trước. */
const QUA_KHU_TOI_DA_MS = 2 * 365 * 24 * 3_600_000;

/*
 * Shopee đặt tên file theo GIỜ ĐỊA PHƯƠNG của tài khoản, không phải UTC — đối
 * chiếu thật: tên file ghi 095911 và ngày sửa file trên đĩa cũng là 09:59.
 * Tài khoản đặt ở Việt Nam nên quy về UTC+7. Bỏ qua bước này thì mọi snapshot
 * lệch 7 tiếng — không đủ để làm sai thứ tự ngày, nhưng đủ để một file xuất
 * lúc sáng sớm bị đẩy sang ngày hôm trước.
 */
const LECH_GIO_VN = 7;

/**
 * Trả về ISO string nếu đọc được, `null` nếu không.
 *
 * `null` KHÔNG phải lỗi — người dùng có thể đổi tên file, hoặc Shopee đổi khuôn
 * đặt tên. Nơi gọi phải tự lùi về thời điểm hiện tại.
 */
export function docMocXuatTuTenFile(tenFile: string): string | null {
  // Bắt đúng 14 chữ số liền nhau. Dùng khớp CUỐI CÙNG: phần hash phía sau chỉ
  // gồm chữ và số nên về lý thuyết có thể chứa 14 chữ số liên tiếp, nhưng mốc
  // thời gian luôn đứng ngay trước dấu gạch nối tách hash.
  const cacKhop = [...tenFile.matchAll(/(\d{14})/g)];
  if (!cacKhop.length) return null;

  for (const khop of cacKhop) {
    const s = khop[1];
    const nam = Number(s.slice(0, 4));
    const thang = Number(s.slice(4, 6));
    const ngay = Number(s.slice(6, 8));
    const gio = Number(s.slice(8, 10));
    const phut = Number(s.slice(10, 12));
    const giay = Number(s.slice(12, 14));

    if (thang < 1 || thang > 12 || ngay < 1 || ngay > 31) continue;
    if (gio > 23 || phut > 59 || giay > 59) continue;

    const moc = Date.UTC(nam, thang - 1, ngay, gio - LECH_GIO_VN, phut, giay);

    // Kiểm ngược: Date.UTC tự cuộn ngày sai thành ngày hợp lệ (31/02 → 03/03).
    // Không kiểm thì một chuỗi số vô nghĩa vẫn ra một ngày trông rất thật.
    const d = new Date(moc + LECH_GIO_VN * 3_600_000);
    if (d.getUTCFullYear() !== nam || d.getUTCMonth() !== thang - 1 || d.getUTCDate() !== ngay) continue;

    const bayGio = Date.now();
    // Cho dư 12 tiếng ở phía tương lai: máy người dùng có thể lệch giờ, và múi
    // giờ suy ra ở trên cũng chỉ là giả định.
    if (moc > bayGio + 12 * 3_600_000) continue;
    if (moc < bayGio - QUA_KHU_TOI_DA_MS) continue;

    return new Date(moc).toISOString();
  }
  return null;
}
