/*
 * Theo dõi thư mục data/inbox/ và tự nhập mọi CSV mới vào Supabase.
 *
 *   npm run watch          chạy liên tục, nhập ngay khi có file mới
 *   npm run watch -- --1   quét một lượt rồi thoát (dùng cho Task Scheduler)
 *
 * ═══ CÁI NÀY LÀM GÌ VÀ KHÔNG LÀM GÌ ═══
 *
 * LÀM: đọc file CSV bạn đã tự tải về, phân tích, đẩy vào Supabase với đúng mốc
 * thời gian XUẤT file, rồi chuyển file sang thư mục lưu trữ.
 *
 * KHÔNG LÀM: không đăng nhập Shopee, không đọc cookie, không gọi endpoint nội bộ
 * của Shopee. Nó chỉ chạm vào file đã nằm trên đĩa máy bạn. Đó là ranh giới mà
 * chính dự án này đặt ra (xem mục "Đăng nhập bằng cookie: BLOCKED" trong Cài đặt)
 * và công cụ này không vượt qua.
 *
 * ═══ VÌ SAO KHÔNG GỌI API CỦA APP ═══
 *
 * Route /api/imports/shopee-products đòi cookie phiên trình duyệt và chặn khác
 * nguồn gốc. Script chạy nền không có trình duyệt. Nên nó đăng nhập thẳng bằng
 * Supabase Auth với tài khoản của chính bạn, rồi gọi cùng một RPC mà app gọi —
 * tức đi qua đúng những kiểm tra và RLS đó, không đi cửa sau bằng khoá service.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseAffiliateExportCsv } from '../src/lib/data/affiliate-export-parser.ts';
import { docMocXuatTuTenFile } from '../src/lib/data/export-timestamp.ts';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOP_THU = path.join(GOC, 'data', 'inbox');
const LUU_TRU = path.join(GOC, 'data', 'imports');

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
const KHOA_CONG_KHAI = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = env.PROFITOS_EMAIL;
const MAT_KHAU = env.PROFITOS_PASSWORD;

if (!URL_SUPABASE || !KHOA_CONG_KHAI) {
  console.error('❌ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY trong .env.local');
  process.exit(1);
}
if (!EMAIL || !MAT_KHAU) {
  console.error('❌ Thiếu PROFITOS_EMAIL / PROFITOS_PASSWORD trong .env.local.');
  console.error('   Đó là email và mật khẩu bạn dùng để đăng nhập vào chính app này.');
  console.error('   Dùng tài khoản thường, KHÔNG dùng khoá service — script cố ý đi qua RLS.');
  process.exit(1);
}

/*
 * Vân tay phải tính GIỐNG HỆT `src/lib/data/import-fingerprint.ts`.
 *
 * ⚠️ Không import lại từ đó vì tệp kia có thể đổi cách chuẩn hoá; nhưng nếu nó
 * đổi mà chỗ này không đổi theo thì cùng một file nhập qua web và qua script sẽ
 * ra hai vân tay khác nhau → lọt vào DB hai lần, thành hai snapshot trùng nội
 * dung. Sửa một bên phải sửa cả hai.
 */
function vanTay(csv, mocIso) {
  const chuanHoa = csv
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((d) => d.trimEnd())
    .join('\n')
    .trimEnd();
  const ngay = new Date(mocIso).toISOString().slice(0, 10);
  return createHash('sha256').update(`PRODUCT_EXPORT\n${ngay}\n${chuanHoa}`).digest('hex');
}

// ─────────────────────────── nhập một file ───────────────────────────

async function nhapMotFile(supabase, duongDan) {
  const ten = path.basename(duongDan);
  const csv = fs.readFileSync(duongDan, 'utf8');

  // Mốc XUẤT file, không phải mốc chạy script. Xem `lib/data/export-timestamp.ts`.
  const mocXuat = docMocXuatTuTenFile(ten);
  if (!mocXuat) {
    console.log(`   ⚠️  ${ten}: không đọc được mốc xuất từ tên file → dùng giờ hiện tại.`);
    console.log('       Đổi tên file là mất mốc thật; nên giữ nguyên tên Shopee đặt.');
  }
  const moc = mocXuat ?? new Date().toISOString();

  const sanPham = parseAffiliateExportCsv(csv, moc);
  if (!sanPham.length) {
    console.log(`   ❌ ${ten}: không có sản phẩm hợp lệ, bỏ qua.`);
    return { ok: false };
  }

  const { data, error } = await supabase.rpc('import_product_export', {
    p_source_filename: ten,
    p_content_hash: vanTay(csv, moc),
    p_captured_at: moc,
    p_products: sanPham,
  });
  if (error) {
    console.log(`   ❌ ${ten}: ${error.message}`);
    return { ok: false };
  }

  const ngay = moc.slice(0, 10);
  if (data?.duplicate) {
    console.log(`   ⏭  ${ten}: đã nhập rồi (cùng nội dung, cùng ngày ${ngay}).`);
  } else {
    console.log(`   ✅ ${ten}: ${sanPham.length} sản phẩm, mốc ${ngay}`);
  }
  return { ok: true, duplicate: Boolean(data?.duplicate) };
}

// ─────────────────────────── lọc bản dở ───────────────────────────

/*
 * Cùng một NGÀY mà có nhiều file thì chỉ giữ file nhiều sản phẩm nhất.
 *
 * ═══ VÌ SAO ═══
 *
 * Trang "Lấy link hàng loạt" của Shopee tải xuống một file MỖI LẦN bấm. Người
 * dùng tích thêm từng trang rồi bấm lại, nên một buổi chọn 100 sản phẩm để lại 5
 * file: 20, 40, 60, 80, 100 — mỗi file là tập con của file sau.
 *
 * Nhập cả 5 thì sản phẩm nằm trong cả năm file có 5 snapshot cách nhau vài giây.
 * Hại kép:
 *   · Velocity tính trên khoảng cách 12 giây → ra số vô nghĩa.
 *   · Radar đếm đủ 3 snapshot nên tưởng đã đủ bằng chứng để xếp hạng — tức hệ
 *     thống tự phá đúng cái hàng rào "không xếp hạng khi thiếu lịch sử" của nó.
 *
 * Lọc theo NGÀY chứ không theo giờ: hai lần xuất cách nhau vài tiếng trong cùng
 * ngày vẫn là cùng một lát cắt thị trường, không phải hai quan sát độc lập.
 */
function locBanDayDuNhat(danhSach) {
  const theoNgay = new Map();

  for (const t of danhSach) {
    const ten = path.basename(t);
    const moc = docMocXuatTuTenFile(ten);
    // Không đọc được ngày thì giữ lại, đừng đoán — nhóm riêng theo tên file.
    const khoa = moc ? moc.slice(0, 10) : `khong-ro:${ten}`;
    let soDong = 0;
    try {
      soDong = fs.readFileSync(t, 'utf8').split(/\r?\n/).filter(Boolean).length;
    } catch {
      soDong = 0;
    }
    const cu = theoNgay.get(khoa);
    if (!cu || soDong > cu.soDong) theoNgay.set(khoa, { t, soDong, bo: cu ? [...cu.bo, cu.t] : [] });
    else cu.bo.push(t);
  }

  const giu = [];
  for (const [khoa, v] of theoNgay) {
    if (v.bo.length) {
      console.log(`   ℹ  ngày ${khoa}: có ${v.bo.length + 1} file, chỉ nhập bản đầy đủ nhất (${v.soDong - 1} sản phẩm).`);
      // Chuyển bản dở sang thư mục riêng — giữ lại chứ không xoá, nhưng để ngoài
      // đường quét để lần sau không hỏi lại.
      const thuMucDo = path.join(LUU_TRU, 'ban-do');
      fs.mkdirSync(thuMucDo, { recursive: true });
      for (const b of v.bo) {
        try {
          fs.renameSync(b, path.join(thuMucDo, path.basename(b)));
        } catch {
          /* đổi tên hỏng thì cứ để nguyên, lượt sau xử lý */
        }
      }
    }
    giu.push(v.t);
  }
  return giu;
}

// ─────────────────────────── quét thư mục ───────────────────────────

async function quet(supabase) {
  fs.mkdirSync(HOP_THU, { recursive: true });
  fs.mkdirSync(LUU_TRU, { recursive: true });

  let tep = fs
    .readdirSync(HOP_THU)
    .filter((t) => t.toLowerCase().endsWith('.csv'))
    .map((t) => path.join(HOP_THU, t));

  if (!tep.length) return 0;

  tep = locBanDayDuNhat(tep);

  let xong = 0;
  for (const t of tep) {
    /*
     * Chờ file ngừng lớn lên rồi mới đọc.
     *
     * Trình duyệt tải file theo từng khúc; đọc lúc đang tải thì được một CSV cụt,
     * phân tích ra vài dòng đầu và nhập thiếu sản phẩm — mà KHÔNG có lỗi nào báo,
     * vì một CSV cụt vẫn là CSV hợp lệ.
     */
    const co1 = fs.statSync(t).size;
    await new Promise((r) => setTimeout(r, 1200));
    if (!fs.existsSync(t)) continue;
    if (fs.statSync(t).size !== co1) {
      console.log(`   ⏳ ${path.basename(t)}: đang tải dở, để lượt sau.`);
      continue;
    }

    const kq = await nhapMotFile(supabase, t);
    if (!kq.ok) continue;

    // Chuyển sang thư mục lưu trữ để không quét lại. Giữ file chứ không xoá:
    // đây là bằng chứng gốc của mọi con số trong hệ thống.
    let dich = path.join(LUU_TRU, path.basename(t));
    if (fs.existsSync(dich)) dich = path.join(LUU_TRU, `${Date.now()}-${path.basename(t)}`);
    fs.renameSync(t, dich);
    xong++;
  }
  return xong;
}

// ─────────────────────────── chạy ───────────────────────────

const supabase = createClient(URL_SUPABASE, KHOA_CONG_KHAI, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: loiDangNhap } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: MAT_KHAU,
});
if (loiDangNhap) {
  console.error(`❌ Đăng nhập hỏng: ${loiDangNhap.message}`);
  console.error('   Kiểm PROFITOS_EMAIL / PROFITOS_PASSWORD trong .env.local.');
  process.exit(1);
}
console.log(`🔑 Đã đăng nhập: ${EMAIL}`);

/*
 * Đóng client cho gọn trước khi thoát.
 *
 * ⚠️ KHÔNG dùng `process.exit(0)` ở đây. Client Supabase còn giữ kênh realtime và
 * bộ hẹn giờ của phiên đăng nhập; gọi exit lúc chúng đang đóng dở thì libuv trên
 * Windows ném thẳng:
 *     Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c
 * Việc nhập DỮ LIỆU vẫn xong xuôi trước đó, nhưng tiến trình thoát với mã lỗi —
 * và Task Scheduler sẽ coi đó là "tác vụ thất bại" rồi báo động mỗi ngày.
 */
async function dongRoiThoat(ma = 0) {
  try {
    await supabase.removeAllChannels();
  } catch {
    /* không có kênh nào thì thôi */
  }
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    /* đăng xuất hỏng không ảnh hưởng dữ liệu đã nhập */
  }
  /*
   * Vẫn phải thoát cưỡng bức, nhưng SAU một nhịp ngắn.
   *
   * Bỏ hẳn `process.exit` thì tiến trình TREO vĩnh viễn — client Supabase giữ
   * vòng lặp sự kiện mở kể cả khi đã đăng xuất (đo thật: chạy quá 5 phút không
   * thoát). Gọi exit ngay lập tức thì dính assertion của libuv. 300ms là đủ để
   * handle đóng xong mà người dùng không cảm thấy chờ.
   */
  setTimeout(() => process.exit(ma), 300);
}

const motLuot = process.argv.includes('--1');

if (motLuot) {
  const n = await quet(supabase);
  console.log(n ? `\n✅ Đã nhập ${n} file.` : '\n(không có file mới trong data/inbox/)');
  /*
   * `dongRoiThoat` HẸN GIỜ thoát chứ không thoát ngay, nên bắt buộc phải có
   * `else` bọc nhánh dưới. Thiếu nó thì chạy một lượt xong vẫn rơi tiếp xuống
   * chế độ theo dõi, in ra hai thông báo mâu thuẫn ("không có file mới" rồi
   * "đang theo dõi"), và người dùng tưởng nó còn chạy nền trong khi 300ms sau
   * tiến trình tắt.
   */
  await dongRoiThoat(0);
} else {
  console.log(`👀 Đang theo dõi: ${HOP_THU}`);
  console.log('   Thả file CSV tải từ Shopee vào đây, máy tự nhập.');
  console.log('   Ctrl+C để dừng.\n');

  await quet(supabase);
  // Quét theo chu kỳ thay vì dùng fs.watch: fs.watch trên Windows bắn nhiều sự
  // kiện cho một lần ghi và bỏ sót khi file được đổi tên vào thư mục. Quét 5
  // giây một lần đơn giản hơn và không bao giờ sót.
  setInterval(() => {
    quet(supabase).catch((e) => console.error('Lỗi khi quét:', e.message));
  }, 5000);
}
