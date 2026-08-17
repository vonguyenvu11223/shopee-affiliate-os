import { parseFile } from 'music-metadata';

/*
 * Cắt câu + tính mốc thời gian từng tiếng.
 *
 * ═══ VÌ SAO LÀM THẾ NÀY ═══
 *
 * Edge TTS trả về mốc từng tiếng miễn phí. Gần như không nhà cung cấp nào khác
 * có — VBee, FPT, Viettel đều chỉ trả về file âm thanh.
 *
 * Cách lấy lại mốc mà KHÔNG cần công cụ nhận dạng giọng nói: sinh giọng RIÊNG
 * TỪNG CÂU. Khi đó biết chính xác mỗi câu dài bao nhiêu (đọc từ chính file mp3),
 * nên biết câu nào bắt đầu ở giây nào — không phải đoán. Trong mỗi câu thì chia
 * đều cho từng tiếng.
 *
 * Sai số vì thế bị NHỐT trong một câu (~3–5 giây) chứ không cộng dồn cả bài.
 * Tiếng Việt mỗi tiếng dài gần bằng nhau nên thực tế lệch dưới 0,1 giây — mắt
 * không bắt được ở mức đó.
 *
 * Cách này cũng tránh được rủi ro của whisper: nó NGHE LẠI chứ không căn theo
 * văn bản có sẵn, mà tiếng Việt có dấu thì nó nhầm chữ khá thường xuyên, rồi gán
 * mốc vào sai chỗ.
 */

/** Khoảng lặng chèn giữa hai câu, cho nhịp thở tự nhiên. */
export const NGHI_GIUA_CAU_MS = 260;

/*
 * Cắt theo dấu kết câu. Giữ lại dấu câu trong nội dung để nhà cung cấp TTS đọc
 * đúng ngữ điệu — bỏ dấu chấm đi thì máy đọc liền tù tì như một câu dài.
 */
export function catCau(loiThoai) {
  return loiThoai
    .split(/(?<=[.!?…])\s+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Đọc độ dài thật của file âm thanh. Không đoán theo số ký tự — mỗi giọng một
 * tốc độ. Nhận cả mp3 lẫn wav; `parseFile` dò theo ĐUÔI FILE nên đuôi phải khớp
 * nội dung, xem `doiDuoiTheoNoiDung` trong `lib/giong/dinh-dang.mjs`.
 */
export async function doDaiMs(duongDan) {
  const meta = await parseFile(duongDan);
  const giay = meta.format.duration;
  if (!giay) throw new Error(`Không đọc được độ dài của ${duongDan}`);
  return Math.round(giay * 1000);
}

/**
 * Rải mốc thời gian cho từng tiếng trong MỘT câu.
 *
 * Chia đều theo số tiếng. Có thể tinh vi hơn (cân theo số ký tự, theo nguyên âm)
 * nhưng đo thử thấy không hơn đáng kể, mà lại thêm chỗ để sai.
 */
export function raiMocTrongCau(cau, batDauMs, keoDaiMs) {
  const tieng = cau.trim().split(/\s+/).filter(Boolean);
  if (tieng.length === 0) return [];

  const moiTieng = keoDaiMs / tieng.length;

  return tieng.map((chu, i) => ({
    batDauMs: Math.round(batDauMs + i * moiTieng),
    keoDaiMs: Math.round(moiTieng),
    // Bỏ dấu câu khi HIỆN LÊN — phụ đề video ngắn không cần dấu chấm, mà để lại
    // thì tiếng cuối câu trông thừa một chấm lơ lửng.
    chu: chu.replace(/[.,!?;:…]+$/, ''),
    // Tiếng cuối câu = chỗ ngắt cụm phụ đề. Ở đây biết chắc, không phải dò ngược
    // về văn bản gốc như khi dùng Edge TTS.
    ketCau: i === tieng.length - 1,
  }));
}
