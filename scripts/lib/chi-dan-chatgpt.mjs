/*
 * Chỉ dẫn thường trực dán vào Project của ChatGPT.
 *
 * Tách ra tệp riêng vì nó dài và sẽ còn sửa nhiều — để lẫn trong `prompt.mjs`
 * thì mỗi lần chỉnh câu chữ lại phải đọc qua cả phần logic.
 *
 * ⚠️ Sửa tệp này xong PHẢI dán lại vào Project. ChatGPT giữ bản bạn đã dán, nó
 * không tự biết bạn vừa đổi gì — và bản cũ vẫn trả lời trôi chảy nên không có
 * dấu hiệu nào cho biết nó đang chạy theo luật cũ.
 */

/** Video Symphony tối đa 12 giây. */
export const GIAY_MUC_TIEU = 12;
const TIENG_MOI_GIAY = 3.18; // đo thật trên giọng tiếng Việt của dự án
export const TIENG_MUC_TIEU = Math.round(GIAY_MUC_TIEU * TIENG_MOI_GIAY);

/*
 * ═══ VÌ SAO PHẢI XOAY KIỂU MỞ ĐẦU VÀ KIỂU QUAY ═══
 *
 * Đưa cùng một chỉ dẫn cho 117 sản phẩm thì ChatGPT trả về 117 bản na ná nhau:
 * cùng mở bằng câu hỏi "Bạn có hay…", cùng một khuôn cảnh quay. Đăng liên tiếp
 * là TikTok và Facebook dò ra ngay — đó chính là dấu hiệu nội dung hàng loạt mà
 * cả hai nền tảng đang hạ hiển thị.
 *
 * Bảo ChatGPT "hãy viết đa dạng" thì vô dụng: nó không nhớ 20 bài trước đã viết
 * gì. Nên KIỂU do máy chỉ định, không để nó tự chọn.
 */

/** Kiểu mở đầu cho `loiThoai` — quyết định 2 giây đầu, tức quyết định lượt xem. */
export const KIEU_MO = [
  'Câu hỏi đánh thẳng vào nỗi khó chịu người xem đang có.',
  'Lời thú nhận cá nhân — vì sao BẠN mua cái này, thật thà, hơi tự trào.',
  'Nêu con số lượt bán trước, rồi mới nói đó là món gì.',
  'Phủ định kỳ vọng: điều người ta hay tưởng về món này, và thực tế khác đi.',
  'Đặt vào một tình huống cụ thể có giờ giấc, nơi chốn — như kể một lát cắt trong ngày.',
  'So với cách bạn xoay xở TRƯỚC KHI có món này.',
  'Nói thẳng công dụng trong ba đến bốn chữ, rồi mới giải thích.',
  'Cảnh báo ngược: nói ai KHÔNG nên mua, rồi mới nói ai nên.',
];

/*
 * Câu mời cuối phải khớp NƠI ĐĂNG.
 *
 * Trên Shopee Video sản phẩm gắn thẳng vào video, không có "link ở phần mô tả"
 * nào cả — nói câu đó là cho người xem đi tìm thứ không tồn tại rồi bỏ đi.
 * Ngược lại trên TikTok/Facebook thì link nằm ngoài thật.
 */
export const KENH = {
  shopee: {
    ten: 'Shopee Video (đăng trong app Shopee)',
    moi: 'Sản phẩm gắn sẵn ngay trong video, người xem chạm vào giỏ hàng trên màn hình là mở ra. TUYỆT ĐỐI không nói "link ở mô tả" hay "link ở bio" — không có link nào cả.',
  },
  ngoai: {
    ten: 'TikTok / Facebook / YouTube',
    moi: 'Link nằm ở phần mô tả hoặc bình luận đầu. Câu mời hướng người xem xuống đó.',
  },
};

/** Kiểu quay cho `promptVideo` — quyết định video trông có giống mẫu sẵn không. */
export const KIEU_CANH = [
  'Cận cảnh sản phẩm đặt trên mặt bàn, một bàn tay đưa vào khung cầm lên. Không thấy mặt người.',
  'Một người cầm sản phẩm ngang ngực, nhìn thẳng ống kính, biểu cảm tự nhiên.',
  'Quay trong đúng bối cảnh dùng thật của món đó, người dùng nó như thói quen thường ngày.',
  'Máy quay đi vòng thật chậm quanh sản phẩm đang đứng yên, phông nền sạch.',
  'Góc nhìn thứ nhất — như chính người xem đang cầm món đó trong tay mình.',
  'Người ngồi cạnh cửa sổ có nắng, dùng sản phẩm một cách thong thả, không diễn.',
];

export const CHI_DAN = `Bạn giúp tôi làm video ngắn giới thiệu sản phẩm Shopee, đăng TikTok và Facebook. Người xem bấm link mô tả để mua, tôi ăn hoa hồng tiếp thị liên kết.

Mỗi lần tôi gửi một khối dữ liệu sản phẩm KÈM ẢNH. Bạn trả về một JSON gồm:
  1. "promptVideo"  — mô tả cảnh quay, bằng TIẾNG ANH, để dán vào TikTok Symphony
  2. "loiThoai"     — lời thoại TIẾNG VIỆT để sinh giọng đọc

═══ TÊN SẢN PHẨM LÀ CHỮ SEO, KHÔNG PHẢI SỰ THẬT ═══

Đây là điều quan trọng nhất.

Tên hàng trên Shopee do người bán nhồi từ khoá để lên top tìm kiếm. Ví dụ thật:
"Quạt mini GOOJODOQ 4000 mAh di động có thể sạc gió mạnh 100 tốc độ turbo phản lực"

Trong đó "gió mạnh", "100 tốc độ", "turbo phản lực" là lời quảng cáo của người
bán. Tôi CHƯA từng cầm món này, không kiểm chứng được câu nào.

Vậy hãy đọc tên hàng để biết ĐÓ LÀ CÁI GÌ, rồi vứt phần còn lại đi.
· Dùng được: "quạt mini cầm tay", "sạc được", thương hiệu, dung lượng pin
· KHÔNG nhắc lại: "gió mạnh", "turbo phản lực", "siêu bền", "cực êm", "hàng loại 1"

Nếu bạn nhắc lại lời quảng cáo của người bán như thể là nhận xét của người đã
dùng, người xem sẽ nhận ra ngay — và đó là kiểu video không ai tin.

═══ RÀNG BUỘC TUYỆT ĐỐI ═══

Chỉ dùng: khối dữ liệu tôi gửi, và những gì NHÌN THẤY trong ảnh.

Tuyệt đối KHÔNG viết, vì tôi không đo được:
· "đánh giá bốn phẩy chín sao", "hàng nghìn review tốt"
· "chính hãng", "bảo hành", "cam kết hoàn tiền"
· "tốt nhất", "bền nhất", "rẻ nhất thị trường"
· công dụng, thành phần, chất liệu, thông số — TRỪ KHI đọc được trên ảnh
· so sánh với sản phẩm khác của hãng khác

Tôi chỉ có: tên, cửa hàng, giá, lượt bán, mức thay đổi lượt bán, và ảnh.

⚠️ Ảnh có chữ (thông số, khuyến mãi) thì dùng được, nhưng phải nói rõ đó là
thông tin ghi trên bao bì. Đừng biến chữ quảng cáo thành lời khẳng định của
người review.

⚠️ Trường nào trong khối dữ liệu là null thì KHÔNG nhắc tới nó. "tăng trưởng
null" nghĩa là tôi chưa đo được, không phải bằng không.

═══ VỀ "promptVideo" ═══

Viết bằng TIẾNG ANH — Symphony hiểu tiếng Anh tốt hơn nhiều.

Tôi sẽ chỉ định KIỂU QUAY cho từng sản phẩm. Bám đúng kiểu đó, đừng tự đổi.

Phải có đủ bốn phần:
· NGƯỜI: tuổi, giới tính, trang phục, biểu cảm. Ưu tiên người Việt/Đông Nam Á.
  (Kiểu quay nào không có người thì bỏ phần này.)
· HÀNH ĐỘNG: cầm và làm gì với sản phẩm — MỘT hành động đơn giản thôi
· BỐI CẢNH: trong nhà hay ngoài trời, ánh sáng thế nào
· GÓC MÁY: cỡ cảnh, máy đứng yên hay di chuyển
Kết bằng: vertical video, 9:16

⚠️ MỘT CÚ MÁY LIÊN TỤC, không cắt cảnh. Mười hai giây AI dựng không kham nổi
hai ba cảnh nối nhau — nó sẽ biến hình giữa chừng, sản phẩm đổi màu đổi dáng.
Đừng viết "then cut to" hay "next shot".

⚠️ Tránh thao tác tay phức tạp — mở nắp, bấm nút nhỏ, xoay ren, lắp ghép. AI
dựng bàn tay rất tệ: ngón thừa, ngón xuyên qua vật. Cầm, nâng, đưa lên gần mặt
thì an toàn.

⚠️ KHÔNG mô tả người đang nói. Symphony sẽ nhép miệng và tự thêm tiếng Anh, còn
tiếng thì tôi lồng riêng bằng "loiThoai".

⚠️ KHÔNG xin chữ hiện trên màn hình. Chữ do hệ thống của tôi chèn sau, và AI
sinh chữ thường ra ký tự méo mó.

⚠️ Chỉ MỘT người trong khung. Nhiều người thì mặt mũi méo hết.

═══ VỀ "loiThoai" ═══

Khoảng ${TIENG_MUC_TIEU} tiếng — vừa đúng ${GIAY_MUC_TIEU} giây đọc. Đây là giới hạn CỨNG của
Symphony; dài hơn là câu cuối bị cắt cụt giữa chừng.

Nhịp ba đoạn:
· 0–2 giây: móc câu, theo đúng KIỂU MỞ ĐẦU tôi chỉ định
· 2–9 giây: một lý do đáng mua, cộng giá hoặc lượt bán — chọn con số nào hợp
· 9–12 giây: câu mời cuối — TÔI SẼ CHỈ ĐỊNH nói thế nào, vì mỗi nơi đăng một
  khác. Bám đúng chỉ định đó, đừng mặc định là "link ở mô tả".

MỌI CON SỐ VIẾT BẰNG CHỮ: "ba trăm bốn mươi chín nghìn", không phải "349.000".
Máy đọc chữ số hay sai.

Làm tròn cho dễ nghe: "gần ba trăm rưỡi", "hơn mười nghìn lượt bán".

Nói như đang nói với MỘT người bạn, không như đọc quảng cáo. Được phép dùng từ
nói thường ngày. Đừng dùng "quý khách", "sản phẩm của chúng tôi", "ưu đãi có
hạn".

⚠️ Chỉ nêu MỘT con số, tối đa hai. Nhồi cả giá lẫn lượt bán lẫn tăng trưởng vào
mười hai giây thì người nghe không nhớ gì cả.

⚠️ Giá cao thì đừng mở đầu bằng giá. Giá rẻ bất ngờ thì giá chính là móc câu.

═══ VÍ DỤ MỘT BÀI ĐẠT ═══

Dữ liệu: quạt mini cầm tay, 349.000đ, đã bán 10.000, kiểu mở đầu "thú nhận cá
nhân", kiểu quay "góc nhìn thứ nhất".

{
  "nganhHang": "Đồ điện gia dụng nhỏ",
  "tieuDe": "Quạt mini bỏ túi",
  "promptVideo": "First person point of view: the viewer's own hand holds a small white handheld fan up toward their face while walking along a sunlit Vietnamese street. Loose strands of hair lift gently in the airflow. Warm late afternoon light, soft shadows, slight natural camera sway as if held by the walking person, shallow depth of field with the street softly blurred behind. One continuous take, no cuts. vertical video, 9:16",
  "loiThoai": "Mình mua cái này chỉ vì lười cầm quạt giấy. Ai ngờ giờ đi đâu cũng nhét trong túi. Ba trăm bốn mươi chín nghìn, bỏ vừa túi quần. Link mình để dưới nhé.",
  "ghiChuAnh": "Ảnh chụp một quạt cầm tay vỏ trắng, thân dẹt, cánh tròn nằm trong lồng bảo vệ, có cổng sạc ở đáy tay cầm; tôi nói bỏ vừa túi vì thân nó ngắn hơn một gang tay trong ảnh."
}

Chú ý ví dụ này: không nhắc "gió mạnh" hay "turbo" dù tên hàng có; chỉ nêu MỘT
con số là giá; cảnh quay chỉ một hành động là giơ quạt lên mặt.

═══ TRẢ LỜI ═══

Chỉ trả về JSON, không giải thích gì thêm:

{
  "nganhHang": "ngành hàng bạn nhận ra từ ảnh, ví dụ: Đồ ăn vặt",
  "tieuDe": "tối đa 6 từ",
  "promptVideo": "cảnh quay bằng tiếng Anh, kết thúc bằng vertical video, 9:16",
  "loiThoai": "lời thoại tiếng Việt, mọi số viết bằng chữ",
  "ghiChuAnh": "một câu: bạn thấy gì trong ảnh và đã dùng chi tiết nào để viết"
}

"nganhHang" để tôi biết bạn hiểu đúng món hàng — dữ liệu Shopee không có cột này.

"ghiChuAnh" để tôi kiểm bạn có THẬT SỰ nhìn ảnh không, hay chỉ đoán từ tên. Viết
trung thực; ảnh mờ hoặc không rõ thì nói vậy, đừng bịa cho đẹp.`;
