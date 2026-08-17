/*
 * Lấy dữ liệu MỘT sản phẩm từ Supabase, dạng đã sẵn sàng cho kịch bản và video.
 *
 * Dùng chung cho `prompt.mjs`, `nhap.mjs` và `render-video.mjs` — ba chỗ này phải
 * nhìn thấy CÙNG một bộ số. Tính riêng ở từng chỗ thì prompt nói hoa hồng 13%,
 * video hiện 10%, và không ai biết bên nào đúng.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function docEnv() {
  const tep = path.join(GOC, '.env.local');
  if (!fs.existsSync(tep)) return {};
  const ra = {};
  for (const dong of fs.readFileSync(tep, 'utf8').split(/\r?\n/)) {
    const m = dong.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) ra[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return ra;
}

export async function ketNoi() {
  const env = { ...docEnv(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const khoa = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !khoa || !env.PROFITOS_EMAIL || !env.PROFITOS_PASSWORD) {
    throw new Error('Thiếu cấu hình Supabase hoặc PROFITOS_EMAIL/PROFITOS_PASSWORD trong .env.local');
  }
  const supabase = createClient(url, khoa, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: env.PROFITOS_EMAIL,
    password: env.PROFITOS_PASSWORD,
  });
  if (error) throw new Error(`Đăng nhập hỏng: ${error.message}`);
  return supabase;
}

/** Rút gọn tên hàng Shopee cho vừa tiêu đề video. */
export function tenNganGon(ten) {
  return String(ten)
    // Bỏ mấy khối trong ngoặc vuông kiểu "[CHÍNH HÃNG ĐỦ 10 MÀU]" — chúng là
    // chữ SEO của người bán, không phải tên sản phẩm.
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/[-–—,]/)[0]
    .trim()
    .split(/\s+/)
    .slice(0, 7)
    .join(' ');
}

/**
 * Đọc một sản phẩm kèm lịch sử snapshot.
 *
 * Trả về `null` nếu không có sản phẩm. Ném lỗi nếu truy vấn hỏng — hai chuyện
 * khác nhau, và gộp lại thì "gõ nhầm mã" trông giống hệt "mất kết nối".
 */
export async function docSanPham(supabase, itemId) {
  const { data, error } = await supabase
    .from('products')
    .select('item_id,title,shop_name,product_url,product_snapshots(price,sold,commission_rate,commission_amount,captured_at)')
    .eq('item_id', itemId)
    .maybeSingle();
  if (error) throw new Error(`Không đọc được sản phẩm: ${error.message}`);
  if (!data) return null;

  const snap = [...(data.product_snapshots ?? [])].sort(
    (a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at)
  );
  const moiNhat = snap[snap.length - 1] ?? null;
  const trươcDo = snap.length >= 2 ? snap[snap.length - 2] : null;

  /*
   * Tăng trưởng lượt bán giữa hai lần chụp gần nhất.
   *
   * `null` khi chưa đủ hai snapshot — KHÔNG trả 0. Số 0 nghĩa là "đo được và
   * không đổi", còn null nghĩa là "chưa đo". Trộn hai thứ là video sẽ hiện
   * "0%" cho sản phẩm chưa ai theo dõi, tức bịa một quan sát chưa từng xảy ra.
   */
  let tangTruong = null;
  if (moiNhat && trươcDo && Number(trươcDo.sold) > 0 && moiNhat.sold != null && trươcDo.sold != null) {
    tangTruong = ((Number(moiNhat.sold) - Number(trươcDo.sold)) / Number(trươcDo.sold)) * 100;
  }

  const anhTep = path.join(GOC, 'public', 'anh-san-pham', `${data.item_id}.jpg`);

  return {
    itemId: data.item_id,
    tenSanPham: data.title,
    tenNganGon: tenNganGon(data.title),
    tenCuaHang: data.shop_name ?? '',
    productUrl: data.product_url ?? '',
    giaVnd: Number(moiNhat?.price ?? 0),
    hoaHongPhanTram: Number(moiNhat?.commission_rate ?? 0),
    hoaHongVnd: Number(moiNhat?.commission_amount ?? 0),
    daBan: moiNhat?.sold == null ? null : Number(moiNhat.sold),
    tangTruongPhanTram: tangTruong,
    soSnapshot: snap.length,
    coAnh: fs.existsSync(anhTep),
    anhTep: fs.existsSync(anhTep) ? `anh-san-pham/${data.item_id}.jpg` : null,
  };
}
