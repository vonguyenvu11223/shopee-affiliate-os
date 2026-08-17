import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Edge TTS — miễn phí, không cần khoá.
 *
 * ═══ VÌ SAO EDGE CHẠY KHÁC CÁC NHÀ CUNG CẤP KHÁC ═══
 *
 * Edge là nhà cung cấp DUY NHẤT trả về mốc thời gian từng tiếng. Nên nó sinh
 * giọng cho CẢ BÀI trong một lần gọi và dùng mốc thật của máy chủ — chính xác
 * hơn hẳn cách chia đều theo câu.
 *
 * Ban đầu tôi ép Edge cũng chạy theo câu cho "thống nhất kiến trúc". Sai hai
 * đường: vừa mất mốc thật, vừa hỏng nặng — mỗi video mở 4 kết nối liên tiếp thay
 * vì 1, và máy chủ Edge trả về file RỖNG cho phần lớn số đó. Đo thật: gọi liền
 * 4 câu chỉ 1/4 có tiếng; giãn 2,5 giây giữa các câu cũng chỉ lên 3/4.
 *
 * Thống nhất kiến trúc không đáng giá bằng việc dùng đúng thế mạnh của từng bên.
 */

export const GIONG = {
  nu: 'vi-VN-HoaiMyNeural',
  nam: 'vi-VN-NamMinhNeural',
};

/** Nhà cung cấp này TỰ trả về mốc từng tiếng — không cần chia đều theo câu. */
export const COT_MOC_SAN = true;

const tickSangMs = (tick) => Math.round(tick / 10000);

/*
 * Máy chủ trả về nhiều đối tượng JSON NỐI THẲNG vào nhau, dạng `}{`, không xuống
 * dòng giữa các gói. Tách theo `\n` hay parse cả chuỗi đều ra rỗng mà KHÔNG báo
 * lỗi — phải quét theo độ sâu ngoặc. Có xử lý chuỗi và ký tự thoát vì lời thoại
 * hoàn toàn có thể chứa dấu ngoặc nhọn.
 */
function tachCacGoiJson(raw) {
  const goi = [];
  let sau = 0;
  let batDau = -1;
  let trongChuoi = false;
  let thoat = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (trongChuoi) {
      if (thoat) thoat = false;
      else if (c === '\\') thoat = true;
      else if (c === '"') trongChuoi = false;
      continue;
    }
    if (c === '"') trongChuoi = true;
    else if (c === '{') {
      if (sau === 0) batDau = i;
      sau++;
    } else if (c === '}') {
      sau--;
      if (sau === 0 && batDau >= 0) {
        goi.push(raw.slice(batDau, i + 1));
        batDau = -1;
      }
    }
  }
  return goi;
}

async function sinhMotLan(loiThoai, maGiong) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(maGiong, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
    /*
     * ⚠️ Bỏ cờ này ra là luồng âm thanh trả về ĐÚNG 0 BYTE — không lỗi, không
     * cảnh báo, chỉ câm. Đã mất công truy vì tưởng không cần metadata nữa.
     */
    wordBoundaryEnabled: true,
    voiceLocale: 'vi-VN',
  });

  const { audioStream, metadataStream } = tts.toStream(loiThoai);
  const khoiAmThanh = [];
  const khoiMeta = [];
  audioStream.on('data', (c) => khoiAmThanh.push(c));
  metadataStream?.on('data', (c) => khoiMeta.push(c.toString()));

  // Chờ CẢ HAI luồng đóng. Chỉ chờ luồng âm thanh thì đọc mốc khi nó chưa về đủ.
  await Promise.all([
    new Promise((r) => audioStream.on('close', r)),
    metadataStream ? new Promise((r) => metadataStream.on('close', r)) : Promise.resolve(),
  ]);
  tts.close();

  const buffer = Buffer.concat(khoiAmThanh);
  if (buffer.length === 0) throw new Error('AM_THANH_RONG');

  const tu = [];
  for (const goi of tachCacGoiJson(khoiMeta.join(''))) {
    let j;
    try {
      j = JSON.parse(goi);
    } catch {
      continue;
    }
    for (const m of j.Metadata ?? []) {
      if (m.Type !== 'WordBoundary') continue;
      tu.push({
        batDauMs: tickSangMs(m.Data.Offset),
        keoDaiMs: tickSangMs(m.Data.Duration),
        chu: m.Data.text.Text,
      });
    }
  }
  if (tu.length === 0) throw new Error('THIEU_MOC_TU');

  // Đánh dấu tiếng đứng trước dấu câu — máy chủ trả về tiếng đã lược sạch dấu,
  // nên phải dò ngược về văn bản gốc. Dùng để ngắt cụm phụ đề cho tự nhiên.
  let viTri = 0;
  for (const t of tu) {
    const i = loiThoai.indexOf(t.chu, viTri);
    if (i < 0) {
      t.ketCau = false;
      continue;
    }
    viTri = i + t.chu.length;
    t.ketCau = /^[.,!?;:—…]/.test(loiThoai.slice(viTri, viTri + 1));
  }

  return { buffer, tu };
}

/** Sinh giọng cho CẢ BÀI. Trả về một đoạn âm thanh + mốc từng tiếng thật. */
export async function docCaBai(loiThoai, { giong, thuMucRa, tenFile, soLanThu = 5 }) {
  const maGiong = GIONG[giong] ?? GIONG.nu;

  let loiCuoi;
  for (let lan = 1; lan <= soLanThu; lan++) {
    try {
      const { buffer, tu } = await sinhMotLan(loiThoai, maGiong);
      fs.mkdirSync(thuMucRa, { recursive: true });
      const duongDan = path.join(thuMucRa, `${tenFile}.mp3`);
      fs.writeFileSync(duongDan, buffer);

      const cuoi = tu[tu.length - 1];
      const tongMs = cuoi.batDauMs + cuoi.keoDaiMs + 400;
      return {
        cacCau: [{ tep: `audio/${tenFile}.mp3`, batDauMs: 0, keoDaiMs: tongMs }],
        tu,
        tongMs,
      };
    } catch (e) {
      loiCuoi = e;
      if (lan < soLanThu) {
        process.stdout.write(`(thử lại ${lan}) `);
        await new Promise((r) => setTimeout(r, 900 * lan));
      }
    }
  }
  throw new Error(
    `Edge TTS hỏng sau ${soLanThu} lần (${loiCuoi?.message}). ` +
      'Máy chủ Edge chập chờn theo mạng — chạy lại lệnh thường là được.'
  );
}

export const TEN = 'Edge TTS';
export const SAN_SANG = true;
