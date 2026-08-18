/*
 * Dựng MP4 cho một sản phẩm: lấy dữ liệu + kịch bản → lồng tiếng → ghép video.
 *
 *   npm run video -- 43254028178            dùng giọng mặc định (Edge, miễn phí)
 *   npm run video -- 43254028178 --zalo     giọng Zalo AI (hay hơn Edge, 2.000 ký tự/ngày)
 *   npm run video -- 43254028178 --11       ElevenLabs (hay nhất + mốc từng ký tự)
 *   npm run video -- 43254028178 --file     dùng file giọng bạn tự chuẩn bị ở data/giong/
 *   npm run video -- 43254028178 --nam      giọng nam
 *
 * ═══ VÌ SAO MẶC ĐỊNH LÀ EDGE ═══
 *
 * Zalo nghe tự nhiên hơn nhưng gói miễn phí chỉ 2.000 ký tự/NGÀY. Trong lúc thử
 * bố cục, bạn sẽ dựng lại cùng một video năm bảy lần — đủ để đốt sạch hạn mức
 * cho một video chưa ưng. Chốt bố cục rồi mới đổi sang Zalo cho bản cuối.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { ketNoi, docSanPham } from './lib/du-lieu-san-pham.mjs';
import { parseFile } from 'music-metadata';
import { catCau, doDaiMs, raiMocTrongCau, NGHI_GIUA_CAU_MS } from './lib/cau.mjs';
import * as edge from './lib/giong/edge.mjs';
import * as zalo from './lib/giong/zalo.mjs';
import * as fpt from './lib/giong/fpt.mjs';
import * as eleven from './lib/giong/elevenlabs.mjs';
import * as thuCong from './lib/giong/thu-cong.mjs';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const THU_MUC_AUDIO = path.join(GOC, 'public', 'audio');
const THU_MUC_RA = path.join(GOC, 'out');

const coCo = (t) => process.argv.includes(t);
const itemId = process.argv.slice(2).find((a) => !a.startsWith('--'));

if (!itemId) {
  console.error('Dùng: npm run video -- <mã sản phẩm> [--zalo|--fpt] [--nam]');
  process.exit(1);
}

const nhaCungCap = coCo('--file')
  ? thuCong
  : coCo('--11')
    ? eleven
    : coCo('--zalo')
      ? zalo
      : coCo('--fpt')
        ? fpt
        : edge;
const THU_MUC_GIONG = path.join(GOC, 'data', 'giong');
const giong = coCo('--nam') ? 'nam' : 'nu';

// ─────────────────────────── đọc dữ liệu ───────────────────────────

const tepKichBan = path.join(GOC, 'data', 'kich-ban', `${itemId}.json`);
if (!fs.existsSync(tepKichBan)) {
  console.error(`❌ Chưa có kịch bản cho ${itemId}.`);
  console.error(`   Chạy: npm run prompt -- ${itemId}  → dán sang ChatGPT → npm run nhap`);
  process.exit(1);
}
const kichBan = JSON.parse(fs.readFileSync(tepKichBan, 'utf8'));

const supabase = await ketNoi();
const sp = await docSanPham(supabase, itemId);
if (!sp) {
  console.error(`❌ Không có sản phẩm "${itemId}" trong dữ liệu.`);
  process.exit(1);
}
if (!sp.coAnh) {
  console.error(`❌ Chưa có ảnh cho ${itemId}. Chạy: npm run anh -- ${itemId}`);
  process.exit(1);
}

console.log(`🎬 ${sp.tenNganGon}`);
console.log(`   giọng: ${nhaCungCap.TEN} (${giong})`);

// ─────────────────────────── lồng tiếng ───────────────────────────

const cauChu = catCau(kichBan.loiThoai);
process.stdout.write(`🔊 ${cauChu.length} câu `);

const cacCau = [];
const tu = [];
let moc = 0;

for (let i = 0; i < cauChu.length; i++) {
  const tenFile = `${itemId}-c${String(i + 1).padStart(2, '0')}`;
  let duongDan;

  if (nhaCungCap.COT_MOC_SAN) {
    /*
     * Edge trả mốc cho CẢ BÀI trong một lần gọi, chính xác hơn hẳn cách chia đều
     * theo câu. Nhưng nó chỉ làm được khi gọi nguyên bài — nên nhánh này chạy một
     * lần rồi thoát vòng lặp, không lặp từng câu.
     */
    break;
  }

  // Nhường nhịp: Zalo chặn khi gọi liên tiếp (đo thật: câu thứ 9 dính 429).
  if (i > 0) await new Promise((r) => setTimeout(r, 900));
  duongDan = await nhaCungCap.docMotCau(cauChu[i], {
    giong,
    thuMucRa: THU_MUC_AUDIO,
    tenFile,
  });
  const dai = await doDaiMs(duongDan);
  cacCau.push({ tep: `audio/${path.basename(duongDan)}`, batDauMs: moc, keoDaiMs: dai });
  tu.push(...raiMocTrongCau(cauChu[i], moc, dai));
  moc += dai + NGHI_GIUA_CAU_MS;
  process.stdout.write('.');
}

let tongMs;
if (nhaCungCap.COT_MOC_SAN) {
  const kq = await nhaCungCap.docCaBai(kichBan.loiThoai, {
    giong,
    thuMucRa: THU_MUC_AUDIO,
    tenFile: itemId,
    thuMucGiong: THU_MUC_GIONG,
  });
  cacCau.push(...kq.cacCau);
  tu.push(...kq.tu);
  tongMs = kq.tongMs;
  process.stdout.write('(cả bài)');
} else {
  tongMs = moc - NGHI_GIUA_CAU_MS + 400;
}
console.log(` → ${(tongMs / 1000).toFixed(1)}s, ${tu.length} tiếng`);

// ─────────────────────── mốc cho từng cảnh ───────────────────────

/*
 * Đổi bảng phân cảnh thành mốc thời gian thật, để con số trên màn hình sáng lên
 * đúng lúc câu nói tới nó.
 *
 * Lùi về "không nhấn mạnh gì" trong hai trường hợp, cả hai đều lùi có chủ ý:
 *   · Không có bảng phân cảnh.
 *   · Số câu đếm từ `canh` không khớp số đoạn âm thanh — ChatGPT sửa chữ khi
 *     chép lại, hoặc người sửa lời thoại sau khi đã có phân cảnh. Thà không nhấn
 *     gì còn hơn nhấn trật nhịp, vì trật nhịp trông như lỗi dựng.
 */
function tinhDoanNhanManh() {
  const canh = kichBan.canh ?? [];
  if (!canh.length || !cacCau.length) return [];

  const demCau = (s) => (String(s).match(/[.!?…]+(\s|$)/g) ?? []).length || 1;
  const canDung = canh.reduce((t, c) => t + demCau(c.cau), 0);

  if (cacCau.length < canDung) {
    console.log(
      `   ⚠️  phân cảnh cần ${canDung} câu nhưng chỉ có ${cacCau.length} đoạn âm thanh` +
        ' — bỏ phần nhấn mạnh theo lời.'
    );
    return [];
  }

  const ra = [];
  let i = 0;
  for (const c of canh) {
    const so = demCau(c.cau);
    const dau = cacCau[i];
    const cuoi = cacCau[Math.min(i + so - 1, cacCau.length - 1)];
    if (c.nhanManh && c.nhanManh !== 'khong') {
      ra.push({ loai: c.nhanManh, batDauMs: dau.batDauMs, ketThucMs: cuoi.batDauMs + cuoi.keoDaiMs });
    }
    i += so;
  }
  return ra;
}

const doanNhanManh = tinhDoanNhanManh();

/*
 * Clip nền từ TikTok Symphony (hoặc bất kỳ công cụ nào), nếu có.
 *
 * Đặt file vào  data/clip/<mã sản phẩm>/  — mọi .mp4 trong đó được phát nối
 * tiếp rồi lặp lại cho kín thời lượng giọng đọc. Symphony tối đa 12 giây mà lời
 * thoại thường 15–25 giây, nên phải lặp; không lặp thì phần cuối là màn đen và
 * Remotion KHÔNG báo gì, vì "hết video" là trạng thái hợp lệ.
 */
const thuMucClip = path.join(GOC, 'data', 'clip', itemId);
const clipNen = [];
const clipDoDaiMs = [];
if (fs.existsSync(thuMucClip)) {
  const ds = fs
    .readdirSync(thuMucClip)
    .filter((t) => /\.(mp4|mov|webm)$/i.test(t))
    .sort();

  for (const t of ds) {
    const nguon = path.join(thuMucClip, t);
    // Chép sang public/ vì Remotion chỉ phục vụ file nằm trong publicDir.
    const dichClip = path.join(GOC, 'public', 'clip', itemId, t);
    fs.mkdirSync(path.dirname(dichClip), { recursive: true });
    fs.copyFileSync(nguon, dichClip);

    const m = await parseFile(nguon);
    if (!m.format.duration) {
      // Không đọc được độ dài thì bỏ hẳn clip đó. Đoán bừa một con số là clip
      // bị cắt giữa chừng hoặc để lại màn đen, mà không có lỗi nào báo.
      console.log(`   ⚠️  bỏ qua ${t}: không đọc được độ dài`);
      continue;
    }
    clipNen.push(`clip/${itemId}/${t}`);
    clipDoDaiMs.push(Math.round(m.format.duration * 1000));
  }

  if (clipNen.length) {
    const tong = clipDoDaiMs.reduce((a, b) => a + b, 0) / 1000;
    console.log(`🎞  ${clipNen.length} clip nền (${tong.toFixed(1)}s)`);
  }
}

// Một ảnh duy nhất cho cả video — CSV Shopee chỉ cho được ảnh đại diện. Hiệu ứng
// phóng chậm trong `AnhChay` giữ cho khung hình không chết cứng.
const doanAnh = [{ tep: sp.anhTep, batDauMs: 0, ketThucMs: tongMs }];

// ─────────────────────────── dựng video ───────────────────────────

const props = {
  id: itemId,
  /*
   * Kênh đăng do `npm run prompt` chốt và `npm run nhap` lưu lại — KHÔNG đoán ở
   * đây. Lời thoại đã viết theo kênh nào thì dòng công bố cuối màn phải theo
   * kênh đó; lệch nhau là giọng nói "chạm giỏ hàng" mà chữ ghi "link ở mô tả".
   */
  kenh: kichBan.kenh ?? 'ngoai',
  tenSanPham: sp.tenSanPham,
  tenNganGon: kichBan.tieuDe || sp.tenNganGon,
  tenCuaHang: sp.tenCuaHang,
  giaVnd: sp.giaVnd,
  hoaHongPhanTram: sp.hoaHongPhanTram,
  hoaHongVnd: sp.hoaHongVnd,
  daBan: sp.daBan,
  tangTruongPhanTram: sp.tangTruongPhanTram,
  anh: [sp.anhTep],
  clipNen,
  clipDoDaiMs,
  loiThoai: kichBan.loiThoai,
  cacCau,
  tu,
  doanAnh,
  doanNhanManh,
  tongMs,
  giongNguon: nhaCungCap.TEN,
};

console.log('📦 Đang đóng gói...');
const serveUrl = await bundle({
  entryPoint: path.join(GOC, 'src', 'video', 'index.ts'),
  publicDir: path.join(GOC, 'public'),
});

const composition = await selectComposition({ serveUrl, id: 'VideoSanPham', inputProps: props });
fs.mkdirSync(THU_MUC_RA, { recursive: true });
const duongDanRa = path.join(THU_MUC_RA, `${itemId}.mp4`);

// Số khung tính từ ĐỘ DÀI GIỌNG ĐỌC, không đặt cứng — đặt cứng thì lời dài bị cắt
// giữa câu, lời ngắn thì thừa mấy giây im lặng ở cuối.
const durationInFrames = Math.max(1, Math.round((tongMs / 1000) * FPS));

let mocDaIn = -1;
await renderMedia({
  composition: { ...composition, durationInFrames },
  serveUrl,
  codec: 'h264',
  outputLocation: duongDanRa,
  inputProps: props,
  onProgress: ({ progress }) => {
    const m = Math.floor(progress * 10) * 10;
    if (m > mocDaIn) {
      mocDaIn = m;
      process.stdout.write(`   ${m}%\n`);
    }
  },
});

console.log(`\n✅ out/${itemId}.mp4  (${(tongMs / 1000).toFixed(1)}s)`);

await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
setTimeout(() => process.exit(0), 300);
