/*
 * Nhận JSON ChatGPT trả về → kiểm → lưu thành kịch bản cho sản phẩm đang chờ.
 *
 *   npm run nhap        đọc data/kich-ban/dan-vao.json
 *
 * Dán JSON vào `data/kich-ban/dan-vao.json` rồi chạy lệnh này. Cũng nhận cả khối
 * có rào ```json và lời dẫn phía trước — ChatGPT rất hay thêm hai thứ đó.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THU_MUC = path.join(GOC, 'data', 'kich-ban');
const TEP_DAN = path.join(THU_MUC, 'dan-vao.json');
const TEP_CHO = path.join(THU_MUC, '.dang-cho.json');

const NHAN_MANH_HOP_LE = ['gia', 'hoaHong', 'daBan', 'tangTruong', 'khong'];

if (!fs.existsSync(TEP_DAN)) {
  console.error(`❌ Chưa có ${path.relative(GOC, TEP_DAN)}`);
  console.error('   Tạo file đó, dán JSON ChatGPT trả về, rồi chạy lại.');
  process.exit(1);
}
if (!fs.existsSync(TEP_CHO)) {
  console.error('❌ Không biết kịch bản này thuộc sản phẩm nào.');
  console.error('   Chạy `npm run prompt -- <mã sản phẩm>` trước.');
  process.exit(1);
}

const { itemId } = JSON.parse(fs.readFileSync(TEP_CHO, 'utf8'));

/*
 * Gỡ rào ```json và lời dẫn quanh khối JSON.
 *
 * Không gỡ thì JSON.parse ném lỗi về ký tự ` — nghe chẳng liên quan gì tới việc
 * người dùng vừa làm, và họ sẽ đi sửa nhầm chỗ.
 */
let tho = fs.readFileSync(TEP_DAN, 'utf8').trim();
tho = tho
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/```\s*$/, '')
  .trim();
if (!tho.startsWith('{')) {
  const dau = tho.indexOf('{');
  const cuoi = tho.lastIndexOf('}');
  if (dau >= 0 && cuoi > dau) tho = tho.slice(dau, cuoi + 1);
}

let kq;
try {
  kq = JSON.parse(tho);
} catch (e) {
  console.error(`❌ Không đọc được JSON: ${e.message}`);
  process.exit(1);
}

const thieu = ['tieuDe', 'promptVideo', 'loiThoai'].filter((k) => !String(kq[k] ?? '').trim());
if (thieu.length) {
  console.error(`❌ Thiếu trường bắt buộc: ${thieu.join(', ')}`);
  process.exit(1);
}

const canhBao = [];

// Chữ số Ả Rập: máy đọc hay sai, mà sai kiểu này chỉ nghe ra khi xem lại video.
const soARap = kq.loiThoai.match(/\d+/g);
if (soARap) canhBao.push(`Lời thoại còn chữ số: ${[...new Set(soARap)].join(', ')} — nên viết bằng chữ.`);

const soTieng = kq.loiThoai.trim().split(/\s+/).length;
const giay = Math.round(soTieng / 3.18);
/*
 * Symphony cắt cứng ở 12 giây.
 *
 * Lời thoại dài hơn thì câu cuối bị cụt giữa chừng — mà file video vẫn xuất ra
 * bình thường, không lỗi nào báo. Chỉ nghe lại mới biết, và lúc đó đã tốn credit.
 */
if (giay > 13) canhBao.push(`QUÁ DÀI cho Symphony: ${soTieng} tiếng ≈ ${giay} giây (tối đa 12).`);
if (giay < 7) canhBao.push(`Hơi ngắn: ${soTieng} tiếng ≈ ${giay} giây.`);

/*
 * Prompt video phải bằng tiếng Anh — Symphony hiểu tiếng Anh tốt hơn nhiều.
 * Dò thô bằng dấu tiếng Việt; có dấu nghĩa là ChatGPT viết nhầm ngôn ngữ.
 */
if (/[àáảãạăâđèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳýỷỹỵ]/i.test(kq.promptVideo))
  canhBao.push('"promptVideo" có dấu tiếng Việt — Symphony hiểu tiếng Anh tốt hơn.');
// Bỏ tỉ lệ khung, độ phân giải, tiêu cự trước khi dò — chúng là chữ số HỢP LỆ,
// chính chỉ dẫn bắt kết bằng "9:16". Không trừ ra thì cảnh báo này kêu mọi lần
// và người dùng học cách phớt lờ nó.
const promptKhongSoKyThuat = kq.promptVideo.replace(/\b\d+\s*[:x×]\s*\d+\b|\b\d+(k|mm|fps|p)\b/gi, '');
if (/\d/.test(promptKhongSoKyThuat))
  canhBao.push('"promptVideo" có chữ số — AI sinh chữ trên video thường ra ký tự méo.');

/*
 * `canh` giờ là TUỲ CHỌN.
 *
 * Video 12 giây do Symphony sinh thì hình đã kể chuyện, không còn khối số nào
 * sáng lên theo lời để mà bám nhịp. Chỉ dẫn không xin trường này nữa; giữ phần
 * kiểm ở đây để kịch bản CŨ (làm trước khi đổi sang Symphony) vẫn nhập lại được.
 */
const canh = Array.isArray(kq.canh) ? kq.canh : [];
if (canh.length) {
  /*
   * Ghép hết `cau` phải khớp `loiThoai`.
   *
   * Lệch thì mốc thời gian tính ra sai và con số sáng lên trật nhịp — mà video
   * vẫn dựng ra bình thường, không lỗi nào báo. Phải bắt ngay tại đây.
   *
   * So sau khi bỏ khoảng trắng và dấu câu: ChatGPT hay đổi "…" thành "..." hoặc
   * thêm bớt dấu phẩy khi chép lại, mà mấy thứ đó không ảnh hưởng việc đếm câu.
   */
  const gon = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[.,!?;:…"'`\-–—()]/g, '')
      .replace(/\s+/g, '');
  if (gon(canh.map((c) => c.cau).join(' ')) !== gon(kq.loiThoai)) {
    canhBao.push('Các câu trong "canh" ghép lại KHÔNG khớp "loiThoai" — con số sẽ sáng trật nhịp.');
  }
  const la = canh.map((c) => c.nhanManh).filter((x) => x && !NHAN_MANH_HOP_LE.includes(x));
  if (la.length) canhBao.push(`Giá trị "nhanManh" không hợp lệ: ${[...new Set(la)].join(', ')}`);
}

const kichBan = {
  itemId,
  tieuDe: String(kq.tieuDe).trim(),
  promptVideo: String(kq.promptVideo).trim(),
  loiThoai: String(kq.loiThoai).trim(),
  ghiChuAnh: String(kq.ghiChuAnh ?? '').trim(),
  canh: canh.map((c) => ({
    cau: String(c.cau ?? '').trim(),
    nhanManh: NHAN_MANH_HOP_LE.includes(c.nhanManh) ? c.nhanManh : 'khong',
  })),
  taoLuc: new Date().toISOString(),
};

const tepRa = path.join(THU_MUC, `${itemId}.json`);
fs.writeFileSync(tepRa, JSON.stringify(kichBan, null, 2) + '\n');
// Dọn file dán để lần sau không nhập nhầm kịch bản cũ cho sản phẩm mới.
fs.rmSync(TEP_DAN, { force: true });

console.log(`✅ Đã lưu kịch bản cho ${itemId}`);
console.log(`   ${soTieng} tiếng ≈ ${giay} giây\n`);

if (kichBan.ghiChuAnh) {
  /*
   * In ra để bạn tự kiểm ChatGPT có THẬT SỰ nhìn ảnh không.
   *
   * Nó mô tả sai hoàn toàn sản phẩm nghĩa là bạn quên kéo ảnh vào, và mọi thứ
   * nó viết chỉ là suy đoán từ tên hàng. Không kiểm chỗ này thì lỗi đó đi thẳng
   * vào video mà không ai chặn.
   */
  console.log('👁  ChatGPT nói nó thấy gì trong ảnh:');
  console.log(`   "${kichBan.ghiChuAnh}"`);
  console.log('   → Sai hoàn toàn nghĩa là bạn quên kéo ảnh vào. Làm lại.\n');
}

console.log('═══ DÁN VÀO TIKTOK SYMPHONY ═══\n');
console.log(kichBan.promptVideo);
console.log('\n═══ LỜI THOẠI (dán vào phần nhập tiếng) ═══\n');
console.log(kichBan.loiThoai);

if (canhBao.length) console.log('\n⚠️  ' + canhBao.join('\n⚠️  '));
else console.log('\n✅ Không có cảnh báo nào.');

console.log(`\nSinh video xong thì tải MP4 về, thả vào:  data\\clip\\${itemId}\\`);
