/*
 * Nhận diện định dạng âm thanh theo NỘI DUNG file, không theo lời hứa của API.
 *
 * Vì sao cần: Zalo AI trả về WAV dù không khai gì về định dạng, trong khi FPT và
 * Edge trả MP3. Đặt cứng đuôi `.mp3` cho mọi nhà cung cấp thì file WAV mang tên
 * mp3 — `music-metadata` dò theo đuôi nên báo "không đọc được độ dài", còn
 * Remotion thì phát ra tiếng rè hoặc câm. Cả hai đều không nói ra nguyên nhân.
 *
 * Đọc byte đầu là cách duy nhất đúng với mọi nhà cung cấp, kể cả nhà cung cấp
 * đổi định dạng mặc định về sau mà không báo ai.
 */

/** Đoán đuôi file từ vài byte đầu. Trả về 'mp3' | 'wav' | null. */
export function duoiTheoNoiDung(buffer) {
  if (buffer.length < 12) return null;

  // RIFF....WAVE
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE')
    return 'wav';

  // Thẻ ID3 ở đầu, hoặc khung MPEG trần (0xFF Ex/Fx)
  if (buffer.toString('ascii', 0, 3) === 'ID3') return 'mp3';
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3';

  return null;
}
