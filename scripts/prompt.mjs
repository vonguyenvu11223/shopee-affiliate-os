/*
 * Xuất prompt để dán sang ChatGPT.
 *
 *   npm run prompt                  chỉ dẫn thường trực — dán MỘT LẦN vào
 *                                   Instructions của Project
 *   npm run prompt -- 43254028178   khối dữ liệu cho một sản phẩm
 *
 * ChatGPT trả về HAI thứ: `promptVideo` (tiếng Anh, để dán vào TikTok Symphony)
 * và `loiThoai` (tiếng Việt, để sinh giọng). Xem `lib/chi-dan-chatgpt.mjs`.
 *
 * ⚠️ Ràng buộc "không thêm dữ kiện" nằm trong CHỈ DẪN THƯỜNG TRỰC. Bỏ bước dán
 * chỉ dẫn là mất luôn hàng rào chống bịa — mà bịa thì đọc lên vẫn trôi chảy,
 * không có gì báo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ketNoi, docSanPham } from './lib/du-lieu-san-pham.mjs';
import { CHI_DAN, GIAY_MUC_TIEU, KIEU_MO, KIEU_CANH, KENH } from './lib/chi-dan-chatgpt.mjs';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THU_MUC = path.join(GOC, 'data', 'kich-ban');

const doiSo = process.argv.slice(2);
const thamSo = doiSo.filter((a) => !a.startsWith('-'));

/** Đọc `--ten <giá trị>`, trả về null nếu không có. */
function co(ten) {
  const i = doiSo.indexOf(`--${ten}`);
  return i >= 0 && doiSo[i + 1] ? doiSo[i + 1] : null;
}
fs.mkdirSync(THU_MUC, { recursive: true });

if (thamSo.length === 0) {
  const tep = path.join(THU_MUC, 'chi-dan-chatgpt.txt');
  fs.writeFileSync(tep, CHI_DAN + '\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  CHỈ DẪN THƯỜNG TRỰC — dán MỘT LẦN vào Project của ChatGPT   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(CHI_DAN);
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`📄 Bản sạch: ${path.relative(GOC, tep)}   (mở ra, Ctrl+A, Ctrl+C)`);
  console.log('\nDán xong rồi thì mỗi video chỉ cần:  npm run prompt -- <mã sản phẩm>');
  process.exit(0);
}

const supabase = await ketNoi();
const sp = await docSanPham(supabase, thamSo[0]);
if (!sp) {
  console.error(`❌ Không có sản phẩm "${thamSo[0]}" trong dữ liệu đã nhập.`);
  process.exit(1);
}

/*
 * Chỉ đưa những trường ĐO ĐƯỢC.
 *
 * Không đưa `hoaHongVnd`/`hoaHongPhanTram`: đó là con số của BẠN, không phải của
 * người xem. Lọt vào prompt là ChatGPT rất dễ đưa nó vào lời thoại, và video nói
 * "tôi được hoa hồng mười hai phần trăm" thì không ai bấm link nữa.
 *
 * Không đưa `productUrl`: ChatGPT không cần link để viết lời, mà có link thì nó
 * hay tự đi suy diễn thêm về sản phẩm.
 */
const khoi = {
  tenSanPham: sp.tenSanPham,
  tenCuaHang: sp.tenCuaHang || null,
  giaVnd: sp.giaVnd,
  daBan: sp.daBan,
  tangTruongPhanTram: sp.tangTruongPhanTram === null ? null : Number(sp.tangTruongPhanTram.toFixed(1)),
};

/*
 * Chọn kiểu mở đầu + kiểu quay TỪ MÃ SẢN PHẨM, không phải ngẫu nhiên.
 *
 * Ngẫu nhiên thì chạy lại cùng một sản phẩm ra kiểu khác, và bạn không đối chiếu
 * được video đã đăng với kiểu đã dùng. Bằm từ itemId thì cùng mã luôn ra cùng
 * kiểu, mà 117 sản phẩm vẫn rải đều khắp 8 × 6 = 48 tổ hợp.
 *
 * Hai hạt giống khác nhau để kiểu mở và kiểu quay không đi thành cặp cố định —
 * dùng chung một phép bằm thì sản phẩm nào có kiểu mở 3 cũng luôn có kiểu quay 3.
 *
 * ⚠️ Phải là phép bằm CÓ TÁN (FNV-1a + trộn cuối), không dùng `h*31+c` cho gọn.
 * Mã sản phẩm Shopee dài bằng nhau và giống nhau ở mấy chữ số đầu; phép bằm yếu
 * giữ nguyên sự giống đó — đo thật trên 117 mã: một kiểu mở chỉ được 4 sản phẩm
 * trong khi kiểu khác được 18, và chỉ ra 23/48 tổ hợp. Bản này ra 44/48.
 */
function bam(chuoi, hatGiong) {
  let h = (2166136261 ^ hatGiong) >>> 0;
  for (const c of String(chuoi)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
/*
 * Mặc định Shopee Video.
 *
 * Đây là kênh có tỉ lệ mua cao nhất — người xem đã ở trong app mua hàng, đã đăng
 * nhập, đã lưu địa chỉ. Đăng ra ngoài thì thêm `--kenh ngoai`.
 */
const maKenh = co('kenh') === 'ngoai' ? 'ngoai' : 'shopee';
const kenh = KENH[maKenh];

const chiSoMo = co('kieu') ? Number(co('kieu')) - 1 : bam(sp.itemId, 1) % KIEU_MO.length;
const chiSoCanh = co('canh') ? Number(co('canh')) - 1 : bam(sp.itemId, 2) % KIEU_CANH.length;
const kieuMo = KIEU_MO[((chiSoMo % KIEU_MO.length) + KIEU_MO.length) % KIEU_MO.length];
const kieuCanh = KIEU_CANH[((chiSoCanh % KIEU_CANH.length) + KIEU_CANH.length) % KIEU_CANH.length];

const noiDung = [
  `Viết prompt video ${GIAY_MUC_TIEU} giây và lời thoại cho sản phẩm dưới đây.`,
  'Tôi có đính kèm ảnh sản phẩm — hãy nhìn ảnh trước khi viết.',
  '',
  'SẢN PHẨM:',
  JSON.stringify(khoi, null, 2),
  '',
  `KIỂU MỞ ĐẦU (bắt buộc dùng): ${kieuMo}`,
  `KIỂU QUAY (bắt buộc dùng): ${kieuCanh}`,
  '',
  `NƠI ĐĂNG: ${kenh.ten}`,
  `CÂU MỜI CUỐI: ${kenh.moi}`,
  '',
  'Nhắc lại: tên hàng là chữ SEO của người bán — đọc để biết đó là món gì, đừng',
  'nhắc lại lời quảng cáo trong đó. Không thêm dữ kiện nào ngoài khối trên và ảnh.',
].join('\n');

const tepRa = path.join(THU_MUC, 'prompt-san-pham.txt');
fs.writeFileSync(tepRa, noiDung + '\n');
fs.writeFileSync(
  path.join(THU_MUC, '.dang-cho.json'),
  JSON.stringify({ itemId: sp.itemId, kenh: maKenh, kieuMo: chiSoMo + 1, kieuCanh: chiSoCanh + 1 }, null, 2)
);

console.log(noiDung);
console.log('\n──────────────────────────────────────────────────────────────');
console.log(`📍 Đăng lên: ${kenh.ten}`);
console.log(`🎲 Kiểu mở ${chiSoMo + 1}/${KIEU_MO.length} · kiểu quay ${chiSoCanh + 1}/${KIEU_CANH.length}`);
console.log('   Không ưng thì đổi:  --kieu <số>  --canh <số>\n');

const canhBao = [];
if (!sp.coAnh) canhBao.push(`Chưa có ảnh — chạy: npm run anh -- ${sp.itemId}`);
if (sp.soSnapshot < 2)
  canhBao.push(`Mới ${sp.soSnapshot} snapshot — "tangTruongPhanTram" là null, chưa đo được.`);
if (canhBao.length) console.log('⚠️  ' + canhBao.join('\n⚠️  ') + '\n');

/*
 * In đường dẫn ảnh dạng Windows đầy đủ.
 *
 * Người dùng phải KÉO ẢNH vào ChatGPT cùng lúc với prompt — chỉ dán chữ thì
 * ChatGPT đoán mò từ tên sản phẩm, và trường `ghiChuAnh` sẽ lộ ra ngay.
 */
if (sp.coAnh) {
  console.log('🖼  KÉO ẢNH NÀY vào ChatGPT cùng lúc với prompt:');
  console.log('   ' + path.join(GOC, 'public', sp.anhTep.replace(/\//g, path.sep)));
}
console.log(`\n📄 Bản sạch: ${path.relative(GOC, tepRa)}`);
console.log('   Dán prompt + kéo ảnh vào ChatGPT → copy JSON → npm run nhap');

await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
setTimeout(() => process.exit(0), 300);
