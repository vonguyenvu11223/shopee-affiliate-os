import fs from 'node:fs';
import path from 'node:path';

/*
 * FPT.AI Text-to-Speech.
 *
 * Gói miễn phí: 100.000 ký tự/tháng. Mỗi video ~300 ký tự → khoảng 330 video.
 * Lấy khoá ở console.fpt.ai, rồi:  $env:FPT_API_KEY="..."
 *
 * ⚠️ FPT KHÔNG trả về mốc thời gian từng tiếng, nên nhà cung cấp này chạy theo
 * đường "sinh từng câu rồi chia đều" — xem chú thích đầu `scripts/tts.mjs`.
 */

/*
 * Giọng FPT — đối chiếu từ chính bảng chọn trong console.fpt.ai (15/08/2026),
 * KHÔNG phải từ trí nhớ. Mã = tên hiển thị viết liền, bỏ dấu.
 *
 *   banmai    Ban Mai   Nữ  Bắc   (được đánh dấu "Most Popular")
 *   thuminh   Thu Minh  Nữ  Bắc
 *   leminh    Lê Minh   Nam Bắc
 *   myan      Mỹ An     Nữ  Trung
 *   ngoclam   Ngọc Lam  Nữ  Trung
 *   giahuy    Gia Huy   Nam Trung
 *   lannhi    Lan Nhi   Nữ  Nam
 *   linhsan   Linh San  Nữ  Nam
 *   minhquang Minh Quang Nam Nam
 *
 * Nhóm "AceSound" (banmaiace, thuminhace…) chất lượng cao hơn nhưng console ghi
 * rõ "Chỉ khả dụng cho các kí tự trả tiền" — gói miễn phí gọi vào là lỗi.
 *
 * Đổi giọng không cần sửa code: đặt FPT_VOICE_NU / FPT_VOICE_NAM.
 */
export const GIONG = {
  nu: process.env.FPT_VOICE_NU ?? 'banmai',
  nam: process.env.FPT_VOICE_NAM ?? 'leminh',
};

const ENDPOINT = 'https://api.fpt.ai/hmi/tts/v5';

/** Đặt lệnh sinh giọng. Trả về URL của file — file CHƯA chắc đã tồn tại ngay. */
async function datLenh(vanBan, maGiong) {
  const key = process.env.FPT_API_KEY;
  if (!key)
    throw new Error(
      'Thiếu FPT_API_KEY. PowerShell:  $env:FPT_API_KEY="..."\n' +
        '   Lấy khoá ở console.fpt.ai (gói miễn phí 100.000 ký tự/tháng).'
    );

  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      /*
       * Gửi CẢ HAI cách viết: tài liệu chính thức ghi `api_key`, còn dòng curl do
       * console.fpt.ai tự sinh lại ghi `api-key`. Không có cách nào phân biệt bên
       * nào đúng từ ngoài vào — sai tên header và sai khoá đều trả về đúng một
       * lỗi 401 "Invalid authentication credentials". Gửi thừa một header vô hại.
       */
      api_key: key,
      'api-key': key,
      voice: maGiong,
      speed: '0',
      format: 'mp3',
      // Phải khai charset — thiếu thì dấu tiếng Việt sang máy chủ thành ký tự lạ
      // và giọng đọc ra sai bét.
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: vanBan,
  });

  const j = await r.json().catch(() => null);

  /*
   * FPT báo lỗi theo HAI kiểu khác nhau — phải kiểm cả hai:
   *   - Lỗi xác thực → HTTP 4xx, thân KHÔNG có trường `error`
   *     (đo thật với khoá sai: `{"message":"Invalid authentication credentials"}`)
   *   - Lỗi nghiệp vụ (hết hạn mức, sai mã giọng) → HTTP 200, `error !== 0`
   * Chỉ kiểm `error !== 0` thì lỗi khoá hiện ra thành "FPT lỗi undefined".
   */
  if (!r.ok)
    throw new Error(
      `FPT từ chối (HTTP ${r.status}): ${j?.message ?? '(không có mô tả)'}` +
        (r.status === 401 || r.status === 403 ? '\n   → Kiểm lại FPT_API_KEY.' : '')
    );
  if (!j) throw new Error(`FPT trả về nội dung không đọc được (HTTP ${r.status})`);
  if (j.error !== 0)
    throw new Error(`FPT lỗi ${j.error}: ${j.message ?? '(không có mô tả)'}`);
  if (!j.async) throw new Error('FPT không trả về link âm thanh');

  return j.async;
}

/*
 * Chờ file xuất hiện.
 *
 * FPT sinh giọng ở phía họ rồi mới đẩy file lên — tài liệu ghi rõ có thể mất từ
 * 5 giây tới 2 phút. Tải ngay là nhận 404 hoặc file rỗng.
 *
 * Kiểm CẢ độ dài file chứ không chỉ mã HTTP: đã gặp trường hợp trả 200 nhưng
 * thân rỗng trong lúc file đang được ghi.
 */
async function choVaTai(url, { toiDaMs = 120000, nhipMs = 2000 } = {}) {
  const hetHan = Date.now() + toiDaMs;

  while (Date.now() < hetHan) {
    const r = await fetch(url);
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 1000) return buf;
    }
    await new Promise((res) => setTimeout(res, nhipMs));
  }
  throw new Error(`Chờ quá ${toiDaMs / 1000}s mà file vẫn chưa có: ${url}`);
}

/** Sinh giọng cho MỘT câu, ghi ra file. Trả về đường dẫn. */
export async function docMotCau(vanBan, { giong, thuMucRa, tenFile, soLanThu = 3 }) {
  const maGiong = GIONG[giong] ?? GIONG.nu;

  let loiCuoi;
  for (let lan = 1; lan <= soLanThu; lan++) {
    try {
      const url = await datLenh(vanBan, maGiong);
      const buffer = await choVaTai(url);
      fs.mkdirSync(thuMucRa, { recursive: true });
      const duongDan = path.join(thuMucRa, `${tenFile}.mp3`);
      fs.writeFileSync(duongDan, buffer);
      return duongDan;
    } catch (e) {
      loiCuoi = e;
      // Sai khoá hay hết hạn mức thì thử lại vô nghĩa — dừng ngay để báo đúng lỗi.
      if (/FPT_API_KEY|FPT lỗi|FPT từ chối/.test(e.message)) throw e;
      if (lan < soLanThu) await new Promise((r) => setTimeout(r, 1500 * lan));
    }
  }
  throw new Error(`FPT hỏng sau ${soLanThu} lần: ${loiCuoi?.message}`);
}

export const TEN = 'FPT.AI';
export const COT_MOC_SAN = false; // FPT không trả mốc từng tiếng
export const SAN_SANG = true;
