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
import { CHI_DAN, GIAY_MUC_TIEU } from './lib/chi-dan-chatgpt.mjs';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THU_MUC = path.join(GOC, 'data', 'kich-ban');

const thamSo = process.argv.slice(2).filter((a) => !a.startsWith('-'));
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

const noiDung = [
  `Viết prompt video ${GIAY_MUC_TIEU} giây và lời thoại cho sản phẩm dưới đây.`,
  'Tôi có đính kèm ảnh sản phẩm — hãy nhìn ảnh trước khi viết.',
  '',
  'SẢN PHẨM:',
  JSON.stringify(khoi, null, 2),
  '',
  'Nhắc lại: không thêm bất kỳ dữ kiện nào ngoài khối trên và những gì thấy trong ảnh.',
].join('\n');

const tepRa = path.join(THU_MUC, 'prompt-san-pham.txt');
fs.writeFileSync(tepRa, noiDung + '\n');
fs.writeFileSync(path.join(THU_MUC, '.dang-cho.json'), JSON.stringify({ itemId: sp.itemId }, null, 2));

console.log(noiDung);
console.log('\n──────────────────────────────────────────────────────────────');

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
