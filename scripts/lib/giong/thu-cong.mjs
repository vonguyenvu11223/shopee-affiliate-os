import fs from 'node:fs';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import { khopMocThat } from './khop-whisper.mjs';

/*
 * Dùng file giọng BẠN TỰ CHUẨN BỊ, không gọi API nào.
 *
 *   Đặt file vào:  data/giong/<mã sản phẩm>.mp3   (hoặc .wav, .m4a)
 *   Rồi chạy:      npm run video -- <mã> --file
 *
 * ═══ DÙNG KHI NÀO ═══
 *
 * · Bạn tự thu giọng mình — cách chuyển đổi tốt nhất và tốn 0đ. Người xem tin
 *   một người thật nói về sản phẩm hơn bất kỳ giọng máy nào.
 * · Bạn sinh trên trang web của một dịch vụ TTS rồi tải MP3 về, thay vì trả tiền
 *   cho API của họ.
 *
 * ⚠️ Sinh trên gói FREE của ElevenLabs rồi tải về vẫn KHÔNG có quyền dùng thương
 * mại. Cách tải file không đổi được điều khoản bản quyền — nó chỉ đổi cách lấy
 * file. Video affiliate là dùng thương mại.
 *
 * ═══ VÌ SAO MỐC KARAOKE CHỈ LÀ XẤP XỈ ═══
 *
 * Không có API thì không ai nói cho ta biết tiếng nào phát ở giây nào. Cách duy
 * nhất còn lại là đo tổng độ dài file rồi chia theo tỉ lệ.
 *
 * Chia theo SỐ TIẾNG của từng câu chứ không chia đều số câu: câu 12 tiếng đọc
 * lâu gấp ba câu 4 tiếng, chia đều số câu là phụ đề trôi lệch dần và tới cuối
 * bài lệch cả giây. Tiếng Việt mỗi tiếng dài gần bằng nhau nên cách này sai số
 * nhỏ — với tiếng Anh thì không dùng được.
 */

const DUOI_NHAN = ['.mp3', '.wav', '.m4a', '.ogg'];

/** Ngắt câu theo dấu kết câu, giữ nguyên dấu để đếm cho đúng. */
function catCau(loiThoai) {
  return String(loiThoai)
    .split(/(?<=[.!?…])\s+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Rải mốc cho từng tiếng trong một câu, đều nhau trong khoảng của câu đó.
 *
 * Đánh dấu `ketCau` cho tiếng đứng trước dấu câu — karaoke dùng nó để ngắt cụm
 * cho tự nhiên; thiếu thì cụm phụ đề cắt giữa câu, đọc rất khó chịu.
 */
function raiTrongCau(cau, batDauMs, keoDaiMs) {
  const tho = cau.split(/\s+/).filter(Boolean);
  if (!tho.length) return [];
  const moiTieng = keoDaiMs / tho.length;

  return tho.map((t, i) => ({
    batDauMs: Math.round(batDauMs + i * moiTieng),
    keoDaiMs: Math.round(moiTieng),
    chu: t.replace(/[.,!?;:…"'`]+$/g, ''),
    ketCau: /[.,!?;:…]$/.test(t),
  }));
}

/**
 * "Sinh" giọng bằng cách đọc file có sẵn.
 *
 * Giữ đúng chữ ký của các nhà cung cấp khác để `render-video.mjs` không phải
 * phân biệt — chỉ khác ở chỗ nó không gọi mạng và không tốn gì.
 */
export async function docCaBai(loiThoai, { thuMucRa, tenFile, thuMucGiong }) {
  let nguon = null;
  for (const d of DUOI_NHAN) {
    const thu = path.join(thuMucGiong, `${tenFile}${d}`);
    if (fs.existsSync(thu)) {
      nguon = thu;
      break;
    }
  }
  if (!nguon) {
    throw new Error(
      `Không tìm thấy file giọng cho "${tenFile}".\n` +
        `   Đặt file vào: ${path.join(thuMucGiong, `${tenFile}.mp3`)}\n` +
        `   Chấp nhận: ${DUOI_NHAN.join(', ')}`
    );
  }

  const meta = await parseFile(nguon);
  const giay = meta.format.duration;
  if (!giay) throw new Error(`Không đọc được độ dài của ${path.basename(nguon)} — file có hỏng không?`);
  const tongMs = Math.round(giay * 1000);

  // Chép sang public/ để Remotion đọc được — nó chỉ phục vụ file trong publicDir.
  fs.mkdirSync(thuMucRa, { recursive: true });
  const duoi = path.extname(nguon);
  const dich = path.join(thuMucRa, `${tenFile}${duoi}`);
  fs.copyFileSync(nguon, dich);

  const cacCauChu = catCau(loiThoai);
  const tongTieng = cacCauChu.reduce((t, c) => t + c.split(/\s+/).filter(Boolean).length, 0);
  if (!tongTieng) throw new Error('Lời thoại rỗng — không rải được mốc nào.');

  /*
   * Ưu tiên mốc THẬT: đưa file qua Whisper để hỏi tiếng nào phát ở giây nào.
   * Tốn khoảng 50 đồng cho video 20 giây, và phụ đề khớp hẳn thay vì xấp xỉ.
   * Chưa cắm OPENAI_API_KEY thì `khopMocThat` trả null và ta lùi về chia tỉ lệ.
   */
  let tu = await khopMocThat(nguon, loiThoai, tongMs);

  if (!tu) {
    tu = [];
    let moc = 0;
    for (const cau of cacCauChu) {
      const soTieng = cau.split(/\s+/).filter(Boolean).length;
      const phan = (soTieng / tongTieng) * tongMs;
      tu.push(...raiTrongCau(cau, moc, phan));
      moc += phan;
    }
  }

  return {
    cacCau: [{ tep: `audio/${tenFile}${duoi}`, batDauMs: 0, keoDaiMs: tongMs }],
    tu,
    tongMs,
    nguonFile: nguon,
  };
}

export const TEN = 'File tự chuẩn bị';
/** Có mốc cho cả bài (xấp xỉ), nên đi cùng nhánh `docCaBai`. */
export const COT_MOC_SAN = true;
export const SAN_SANG = true;
