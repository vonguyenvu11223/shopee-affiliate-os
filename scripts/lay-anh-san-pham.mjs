/*
 * Lấy ảnh sản phẩm về máy để dựng video.
 *
 *   npm run anh              lấy ảnh cho mọi sản phẩm chưa có
 *   npm run anh -- 43254028178   chỉ một mã
 *
 * ═══ LẤY Ở ĐÂU VÀ VÌ SAO ĐƯỢC PHÉP ═══
 *
 * CSV "Lấy link hàng loạt" của Shopee KHÔNG có cột ảnh. Ảnh nằm ở thẻ `og:image`
 * trên chính trang sản phẩm CÔNG KHAI — thẻ đó tồn tại để Facebook, Zalo,
 * Messenger hiện ảnh xem trước khi ai đó dán link. Lấy nó là dùng đúng thứ nó
 * sinh ra để dùng.
 *
 * Việc này KHÁC hẳn thứ dự án chặn (xem "Đăng nhập bằng cookie: BLOCKED" trong
 * Cài đặt): không đăng nhập, không cookie, không endpoint nội bộ, không phiên.
 * Chỉ là một lần GET vào một trang ai cũng mở được.
 *
 * Dù vậy vẫn tự giới hạn, vì lịch sự và vì không muốn bị chặn:
 *   · Mỗi sản phẩm gọi ĐÚNG MỘT LẦN trong đời — có ảnh rồi thì bỏ qua vĩnh viễn.
 *   · Giãn 2 giây giữa các lần gọi.
 *   · Khai User-Agent thật, không giả dạng trình duyệt để né kiểm tra.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THU_MUC_ANH = path.join(GOC, 'public', 'anh-san-pham');

const NHIP_MS = 2000;
const UA = 'ProfitOS/0.1 (cong cu affiliate ca nhan; chi doc og:image tren trang cong khai)';

// ─────────────────────────── cấu hình ───────────────────────────

function docEnv() {
  const tep = path.join(GOC, '.env.local');
  if (!fs.existsSync(tep)) return {};
  const ra = {};
  for (const dong of fs.readFileSync(tep, 'utf8').split(/\r?\n/)) {
    const m = dong.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) ra[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return ra;
}

const env = { ...docEnv(), ...process.env };
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KHOA = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = env.PROFITOS_EMAIL;
const MAT_KHAU = env.PROFITOS_PASSWORD;

if (!URL_SUPABASE || !KHOA || !EMAIL || !MAT_KHAU) {
  console.error('❌ Thiếu cấu hình Supabase hoặc PROFITOS_EMAIL/PROFITOS_PASSWORD trong .env.local');
  process.exit(1);
}

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────── lấy ảnh ───────────────────────────

/** Đọc URL ảnh từ thẻ og:image của trang sản phẩm. `null` nếu không có. */
async function docOgImage(urlSanPham) {
  const r = await fetch(urlSanPham, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();

  /*
   * Bắt cả hai thứ tự thuộc tính: `property` có thể đứng trước hoặc sau `content`
   * tuỳ cách trang được dựng. Chỉ khớp một chiều là thỉnh thoảng trả về null cho
   * những trang hoàn toàn bình thường.
   */
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}

async function taiAnh(url, dichDen) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`tải ảnh HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  // Ảnh Shopee thường 80–200 KB. Dưới 2 KB gần như chắc chắn là ảnh báo lỗi
  // hoặc ảnh giữ chỗ — lưu vào thì video hiện một ô xám mà không ai biết vì sao.
  if (buf.length < 2048) throw new Error(`ảnh quá nhỏ (${buf.length} byte), có thể là ảnh lỗi`);
  fs.mkdirSync(path.dirname(dichDen), { recursive: true });
  fs.writeFileSync(dichDen, buf);
  return buf.length;
}

// ─────────────────────────── chạy ───────────────────────────

const supabase = createClient(URL_SUPABASE, KHOA, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: loiDn } = await supabase.auth.signInWithPassword({ email: EMAIL, password: MAT_KHAU });
if (loiDn) {
  console.error(`❌ Đăng nhập hỏng: ${loiDn.message}`);
  process.exit(1);
}

const locMa = process.argv.slice(2).find((a) => !a.startsWith('-'));

let truyVan = supabase.from('products').select('item_id,title,product_url');
if (locMa) truyVan = truyVan.eq('item_id', locMa);
const { data: sanPham, error } = await truyVan;
if (error) {
  console.error(`❌ Không đọc được danh sách sản phẩm: ${error.message}`);
  process.exit(1);
}

fs.mkdirSync(THU_MUC_ANH, { recursive: true });

let daCo = 0;
let lay = 0;
let hong = 0;

for (const sp of sanPham ?? []) {
  const dich = path.join(THU_MUC_ANH, `${sp.item_id}.jpg`);

  // Có rồi thì bỏ qua vĩnh viễn — mỗi sản phẩm chỉ gọi Shopee đúng một lần.
  if (fs.existsSync(dich)) {
    daCo++;
    continue;
  }
  if (!sp.product_url) {
    console.log(`   ⏭  ${sp.item_id}: không có link sản phẩm trong dữ liệu.`);
    hong++;
    continue;
  }

  try {
    await nghi(NHIP_MS);
    const urlAnh = await docOgImage(sp.product_url);
    if (!urlAnh) {
      console.log(`   ❌ ${sp.item_id}: trang không có thẻ og:image.`);
      hong++;
      continue;
    }
    const co = await taiAnh(urlAnh, dich);
    lay++;
    console.log(`   ✅ ${sp.item_id}  ${Math.round(co / 1024)} KB  ${String(sp.title).slice(0, 42)}`);
  } catch (e) {
    hong++;
    console.log(`   ❌ ${sp.item_id}: ${e.message}`);
  }
}

console.log(`\nĐã có sẵn: ${daCo} · Lấy mới: ${lay} · Hỏng: ${hong}`);
console.log(`Thư mục: ${THU_MUC_ANH}`);

await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
setTimeout(() => process.exit(0), 300);
