/**
 * Kiểu dữ liệu cho video review sản phẩm affiliate.
 *
 * Tách khỏi `src/lib/types.ts` của app: kiểu ở đây là thứ TRUYỀN VÀO Remotion,
 * nên nó phải tuần tự hoá được sang JSON và không kéo theo bất cứ thứ gì của
 * Next.js. Trộn chung là lúc dựng video sẽ nạp nhầm mã `server-only`.
 */

/** Một tiếng trong lời thoại, kèm mốc thời gian thật đo từ file âm thanh. */
export type MocTu = {
  batDauMs: number;
  keoDaiMs: number;
  chu: string;
  /** Tiếng này đứng ngay trước dấu câu — dùng để ngắt cụm phụ đề cho tự nhiên. */
  ketCau?: boolean;
};

/**
 * MỘT CÂU MỘT FILE, không phải một file cho cả bài.
 *
 * Đó là cách lấy lại mốc thời gian khi nhà cung cấp giọng không trả về: biết độ
 * dài thật của từng câu thì biết câu nào bắt đầu ở giây nào.
 */
export type DoanAmThanh = {
  /** Đường dẫn trong thư mục public của Remotion. */
  tep: string;
  batDauMs: number;
  keoDaiMs: number;
};

/** Một cảnh: một hai câu cùng nói về một ý, kèm ảnh minh hoạ cho ý đó. */
export type DoanAnh = {
  tep: string;
  batDauMs: number;
  ketThucMs: number;
};

/**
 * Thông số dựng một video sản phẩm.
 *
 * ⚠️ Mọi con số ở đây phải TRUY ĐƯỢC về dữ liệu đã nhập từ Shopee. Không thêm
 * trường nào mà hệ thống tự nghĩ ra — đó là nguyên tắc gốc của cả dự án, và
 * video là chỗ dễ vi phạm nhất vì nó cần "nghe hay".
 */
/*
 * Nơi video sẽ được đăng. Quyết định dòng công bố tiếp thị liên kết ở cuối màn.
 *
 * ⚠️ Không phải chuyện thẩm mỹ. Trên Shopee Video sản phẩm được GẮN THẲNG vào
 * video, không có "link ở phần mô tả" nào cả — ghi câu đó là chỉ người xem đi
 * tìm một thứ không tồn tại. Ngược lại trên TikTok/Facebook thì link nằm ngoài
 * thật, và cả hai nền tảng BẮT BUỘC công bố quan hệ có thù lao.
 */
export type KenhDang = 'shopee' | 'ngoai';

export type ThongSoVideoSanPham = {
  id: string;

  /** Mặc định 'ngoai' (TikTok/Facebook/YouTube) nếu không khai. */
  kenh?: KenhDang;

  /** Tên sản phẩm, lấy nguyên từ CSV Shopee. */
  tenSanPham: string;
  tenNganGon: string;
  tenCuaHang: string;

  giaVnd: number;
  hoaHongPhanTram: number;
  hoaHongVnd: number;
  /** Lượt bán tại lần chụp gần nhất. `null` khi Shopee không trả về. */
  daBan: number | null;

  /**
   * Thay đổi giữa hai lần chụp gần nhất. `null` khi chưa đủ hai snapshot.
   *
   * Đây là con số DUY NHẤT trong video mà một file CSV không cho được — nó là
   * lý do tồn tại của cả hệ thống chụp nhiều lần.
   */
  tangTruongPhanTram: number | null;

  /** Ảnh sản phẩm, đường dẫn trong public/. */
  anh: string[];

  /**
   * Clip video làm nền, thay cho ảnh tĩnh — ví dụ clip sinh từ TikTok Symphony.
   * Có clip thì ảnh bị bỏ qua. Rỗng = dùng ảnh.
   */
  clipNen?: string[];
  /** Độ dài từng clip, mili-giây. Cùng thứ tự với clipNen. */
  clipDoDaiMs?: number[];

  loiThoai: string;
  /** Do bước lồng tiếng sinh ra, không viết tay. */
  cacCau: DoanAmThanh[];
  tu: MocTu[];
  doanAnh: DoanAnh[];
  /**
   * Khoảng thời gian mỗi con số được LÀM NỔI, do bảng phân cảnh quyết định.
   * Rỗng = không nhấn gì, mọi ô hiện đều nhau.
   */
  doanNhanManh?: { loai: "gia" | "hoaHong" | "daBan" | "tangTruong"; batDauMs: number; ketThucMs: number }[];
  tongMs: number;
  giongNguon: string;
};
