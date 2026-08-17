import fs from 'node:fs';
import path from 'node:path';
import { duoiTheoNoiDung } from './dinh-dang.mjs';

/*
 * Zalo AI Text-to-Speech.
 *
 * Lấy khoá ở ai.zalo.solutions (trước đây là zalo.ai, đã đổi tên miền), rồi:
 *   $env:ZALO_API_KEY="..."
 *
 * ⚠️ Zalo KHÔNG trả về mốc thời gian từng tiếng, nên nhà cung cấp này chạy theo
 * đường "sinh từng câu rồi chia đều" — xem chú thích đầu `scripts/tts.mjs`.
 *
 * ⚠️ ĐỪNG dùng `ai.zalo.cloud/api/demo/v1/tts/synthesize` mà một số hướng dẫn
 * trên mạng chép lại. Đó là endpoint của trang DEMO công khai, xác thực bằng
 * cookie trình duyệt và ràng buộc header `origin`/`referer` — nó là cào trang
 * web của người ta, không phải API. Hỏng bất cứ lúc nào họ đổi trang, mà hỏng
 * thì không có ai để hỏi.
 */

/*
 * Zalo định danh giọng bằng SỐ, không phải tên.
 *
 *   1  Nữ  miền Nam
 *   2  Nữ  miền Bắc
 *   3  Nam miền Nam
 *   4  Nam miền Bắc
 *   5  Nữ  miền Bắc  (giọng khác)
 *   6  Nữ  miền Nam  (giọng khác)
 *
 * Mặc định lấy giọng miền Bắc cho khớp lối đọc thuyết minh phim tài liệu.
 * Đổi không cần sửa code: đặt ZALO_VOICE_NU / ZALO_VOICE_NAM.
 */
export const GIONG = {
  nu: process.env.ZALO_VOICE_NU ?? '2',
  nam: process.env.ZALO_VOICE_NAM ?? '4',
};

const ENDPOINT = 'https://api.zalo.ai/v1/tts/synthesize';

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/** Đặt lệnh sinh giọng. Trả về URL của file — file CHƯA chắc đã tồn tại ngay. */
async function datLenh(vanBan, maGiong) {
  const key = process.env.ZALO_API_KEY;
  if (!key)
    throw new Error(
      'Thiếu ZALO_API_KEY. PowerShell:  $env:ZALO_API_KEY="..."\n' +
        '   Lấy khoá ở ai.zalo.solutions'
    );

  // Zalo nhận form-urlencoded, KHÔNG nhận JSON. Gửi JSON thì máy chủ đọc ra rỗng
  // và trả lỗi tham số, chứ không báo là sai định dạng.
  const than = new URLSearchParams({
    input: vanBan,
    speaker_id: maGiong,
    speed: process.env.ZALO_SPEED ?? '1.0', // hợp lệ trong khoảng [0.8, 1.2]
  });

  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: than,
  });

  const j = await r.json().catch(() => null);
  if (!j) throw new Error(`Zalo trả về nội dung không đọc được (HTTP ${r.status})`);

  /*
   * Zalo báo lỗi bằng `error_code` trong thân JSON. Đo thật với khoá sai:
   *   {"error_code":401,"error_message":"Invalid authentication credentials","data":{}}
   * HTTP cũng là 401 ở ca này, nhưng đừng dựa vào mã HTTP — lỗi hạn mức và lỗi
   * tham số có thể về kèm HTTP 200.
   */
  /*
   * 429 = gọi quá nhanh, KHÔNG phải sai gì cả. Ném ra một loại lỗi riêng để lớp
   * trên biết là nên chờ rồi thử lại, thay vì bỏ cuộc như với lỗi khoá.
   *
   * Đo thật (15/08/2026): sinh liền 8 câu thì bị chặn ở câu thứ 9. Zalo không
   * công bố ngưỡng cụ thể.
   */
  /*
   * ⚠️ Zalo dùng CHUNG mã 429 cho hai chuyện rất khác nhau:
   *   · gọi quá nhanh          → chờ vài giây là xong
   *   · hết hạn mức trong NGÀY → chờ tới nửa đêm, thử lại bao nhiêu cũng vô ích
   *
   * Không phân biệt được từ mã lỗi, nên: in NGUYÊN VĂN `error_message` của Zalo
   * thay vì đoán hộ, và nếu thử lại vẫn hỏng thì nói rõ cả hai khả năng. Bản đầu
   * tôi viết cứng là "gọi quá nhanh" — người dùng ngồi chờ máy thử lại năm lần
   * trong khi thứ họ cần biết là hạn mức đã hết.
   */
  if (j.error_code === 429) {
    const e = new Error(`Zalo 429: ${j.error_message ?? '(không có mô tả)'}`);
    e.choDuoc = true;
    e.choMs = Number(r.headers.get('retry-after')) * 1000 || 0;
    throw e;
  }

  if (j.error_code !== 0)
    throw new Error(
      `Zalo lỗi ${j.error_code}: ${j.error_message ?? '(không có mô tả)'}` +
        (j.error_code === 401 ? '\n   → Kiểm lại ZALO_API_KEY.' : '')
    );

  const url = j.data?.url;
  if (!url) throw new Error('Zalo báo thành công nhưng không kèm link âm thanh');
  return url;
}

/*
 * Chờ file xuất hiện.
 *
 * Zalo sinh giọng ở phía họ rồi mới đẩy file lên, giống FPT — tải ngay là nhận
 * 404 hoặc file rỗng. Kiểm CẢ độ dài chứ không chỉ mã HTTP: file đang được ghi
 * dở vẫn trả 200 với thân ngắn ngủn.
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

/*
 * Sinh giọng cho MỘT câu, ghi ra file. Trả về đường dẫn.
 *
 * ⚠️ `soLanThu` để 2 chứ không phải 3 như các nhà cung cấp khác: hạn mức miễn phí
 * của Zalo chỉ 2.000 ký tự/NGÀY (đo trên trang API quota, 15/08/2026), mà mỗi lần
 * thử lại là một lần gọi tính tiền đầy đủ. Thử lại nhiều lần khi mạng chập chờn
 * có thể ngốn hết hạn mức cả ngày cho đúng một video.
 */
export async function docMotCau(vanBan, { giong, thuMucRa, tenFile, soLanThu = 2 }) {
  const maGiong = GIONG[giong] ?? GIONG.nu;

  let loiCuoi;
  // Đếm riêng lần bị chặn: chúng KHÔNG tính vào `soLanThu`. Bị chặn nghĩa là yêu
  // cầu chưa hề được xử lý — tính nó như một lần thử hỏng thì đang phạt người
  // dùng vì lỗi của nhịp gọi, và bỏ cuộc khi chỉ cần chờ thêm vài giây.
  let lanChan = 0;

  for (let lan = 1; lan <= soLanThu; lan++) {
    try {
      const url = await datLenh(vanBan, maGiong);
      const buffer = await choVaTai(url);
      fs.mkdirSync(thuMucRa, { recursive: true });

      // Zalo trả WAV chứ không phải MP3 (đo thật 15/08/2026 — byte đầu là
      // `RIFF....WAVE`). Đuôi file phải khớp nội dung, xem `dinh-dang.mjs`.
      const duoi = duoiTheoNoiDung(buffer) ?? 'wav';
      const duongDan = path.join(thuMucRa, `${tenFile}.${duoi}`);
      fs.writeFileSync(duongDan, buffer);
      return duongDan;
    } catch (e) {
      loiCuoi = e;

      if (e.choDuoc && lanChan < 5) {
        lanChan++;
        const cho = Math.max(e.choMs, 4000 * lanChan);
        process.stdout.write(`(bị chặn, chờ ${Math.round(cho / 1000)}s) `);
        await nghi(cho);
        lan--; // không tính lượt này
        continue;
      }

      // Sai khoá hay hết hạn mức thì thử lại vô nghĩa — dừng ngay để báo đúng lỗi.
      if (/ZALO_API_KEY|Zalo lỗi/.test(e.message)) throw e;
      if (lan < soLanThu) await nghi(1500 * lan);
    }
  }
  if (loiCuoi?.choDuoc)
    throw new Error(
      `${loiCuoi.message}\n` +
        '   Đã chờ và thử lại 5 lần mà vẫn bị chặn — nhiều khả năng HẾT HẠN MỨC NGÀY\n' +
        '   (gói miễn phí 2.000 ký tự, làm mới lúc nửa đêm), không phải gọi quá nhanh.\n' +
        '   Kiểm ở ai.zalo.solutions → Account → API Quota.\n' +
        '   Câu đã sinh hôm nay vẫn nằm trong đệm, mai chạy lại không mất thêm.'
    );
  throw new Error(`Zalo hỏng sau ${soLanThu} lần: ${loiCuoi?.message}`);
}

export const TEN = 'Zalo AI';
export const COT_MOC_SAN = false; // Zalo không trả mốc từng tiếng
export const SAN_SANG = true;
