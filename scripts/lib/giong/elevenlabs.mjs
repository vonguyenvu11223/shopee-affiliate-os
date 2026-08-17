import fs from 'node:fs';
import path from 'node:path';

/*
 * ElevenLabs Text-to-Speech.
 *
 * Lấy khoá ở elevenlabs.io → Profile → API Keys, rồi đặt trong .env.local:
 *   ELEVENLABS_API_KEY=...
 *   ELEVENLABS_VOICE_ID=...     (tuỳ chọn, xem chú thích GIONG bên dưới)
 *
 * ═══ VÌ SAO NHÀ CUNG CẤP NÀY TỐT NHẤT TRONG BỐN CÁI ═══
 *
 * Nó là cái DUY NHẤT trả về mốc thời gian TỪNG KÝ TỰ (`alignment`). Ba cái kia:
 *   · Zalo, FPT  → không trả mốc gì → phải sinh từng câu rồi CHIA ĐỀU trong câu
 *   · Edge       → trả mốc từng TIẾNG, tốt nhưng thô hơn
 *   · ElevenLabs → mốc từng KÝ TỰ, dựng ngược ra mốc từng tiếng chính xác tuyệt đối
 *
 * Với phụ đề karaoke, khác biệt này nhìn thấy được: chia đều thì tiếng dài như
 * "nghìn" và tiếng ngắn như "và" được cấp cùng một khoảng thời gian, nên chữ tô
 * sáng luôn trôi lệch khỏi tiếng đọc chừng một phần tư giây.
 *
 * ⚠️ TIỀN: mỗi ký tự là một credit. Video 20 giây ≈ 250 ký tự. Gói Starter $6
 * cho 30.000 ký tự/tháng ≈ 120 video. Gói Free 10.000 ký tự nhưng KHÔNG có quyền
 * dùng thương mại — không dùng được cho video affiliate.
 */

const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';

/*
 * Giọng.
 *
 * ⚠️ "Adam" và các giọng mặc định nổi tiếng của ElevenLabs đều là giọng NGƯỜI
 * NÓI TIẾNG ANH. Model `eleven_multilingual_v2` đọc được tiếng Việt bằng giọng
 * đó, nhưng mang accent — nghe như người Mỹ nói tiếng Việt. Với video bán hàng
 * cho người Việt thì đó là điểm trừ, không phải điểm cộng.
 *
 * Nên: vào elevenlabs.io → Voices → lọc theo tiếng Việt, nghe thử, rồi đặt
 * ELEVENLABS_VOICE_ID. Mặc định dưới đây là Adam (giọng nam trầm) để chạy được
 * ngay, KHÔNG phải vì nó hợp nhất.
 */
const ADAM = 'pNInz6obpgDQGcFmaJgB';

export const GIONG = {
  nam: process.env.ELEVENLABS_VOICE_ID || ADAM,
  nu: process.env.ELEVENLABS_VOICE_ID_NU || process.env.ELEVENLABS_VOICE_ID || ADAM,
};

const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * Dựng mốc từng TIẾNG từ mốc từng KÝ TỰ.
 *
 * ElevenLabs trả ba mảng song song: ký tự, giây bắt đầu, giây kết thúc. Gom các
 * ký tự liền nhau không phải khoảng trắng thành một tiếng, lấy mốc bắt đầu của
 * ký tự đầu và mốc kết thúc của ký tự cuối.
 *
 * ⚠️ Phải nhận diện `ketCau` NGAY TẠI ĐÂY, lúc còn thấy dấu câu. Karaoke dùng nó
 * để ngắt cụm cho tự nhiên; bỏ qua thì cụm phụ đề cắt giữa câu và đọc rất khó chịu.
 */
function tuTuKyTu(alignment) {
  const kt = alignment?.characters ?? [];
  const dau = alignment?.character_start_times_seconds ?? [];
  const cuoi = alignment?.character_end_times_seconds ?? [];
  if (!kt.length) return [];

  const tu = [];
  let chu = '';
  let batDau = null;
  let ketThuc = null;

  const chot = (dauCauTheoSau) => {
    if (!chu) return;
    tu.push({
      batDauMs: Math.round((batDau ?? 0) * 1000),
      keoDaiMs: Math.max(1, Math.round(((ketThuc ?? 0) - (batDau ?? 0)) * 1000)),
      chu,
      ketCau: dauCauTheoSau,
    });
    chu = '';
    batDau = null;
    ketThuc = null;
  };

  for (let i = 0; i < kt.length; i++) {
    const c = kt[i];
    if (/\s/.test(c)) {
      chot(false);
      continue;
    }
    if (/[.,!?;:…—–-]/.test(c)) {
      // Dấu câu không phải một tiếng: nó kết thúc tiếng đứng trước.
      chot(true);
      continue;
    }
    if (!chu) batDau = dau[i];
    chu += c;
    ketThuc = cuoi[i];
  }
  chot(false);
  return tu;
}

async function goiApi(vanBan, voiceId) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key)
    throw new Error(
      'Thiếu ELEVENLABS_API_KEY trong .env.local.\n' +
        '   Lấy ở elevenlabs.io → Profile → API Keys.\n' +
        '   ⚠️ Gói Free KHÔNG có quyền dùng thương mại — video affiliate cần gói Starter trở lên.'
    );

  const r = await fetch(`${ENDPOINT}/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: vanBan, model_id: MODEL }),
  });

  const j = await r.json().catch(() => null);

  if (!r.ok) {
    const chiTiet = j?.detail?.message || j?.detail?.status || j?.detail || '(không có mô tả)';
    const e = new Error(`ElevenLabs từ chối (HTTP ${r.status}): ${JSON.stringify(chiTiet)}`);
    // 429 = vượt nhịp gọi; chờ rồi thử lại được. Các mã khác thì thử lại vô ích.
    e.choDuoc = r.status === 429;
    throw e;
  }
  if (!j?.audio_base64) throw new Error('ElevenLabs không trả về âm thanh');
  return j;
}

/** Sinh giọng cho CẢ BÀI, kèm mốc thật từng tiếng. */
export async function docCaBai(loiThoai, { giong, thuMucRa, tenFile, soLanThu = 3 }) {
  const voiceId = GIONG[giong] ?? GIONG.nam;
  let loiCuoi;
  let lanChan = 0;

  for (let lan = 1; lan <= soLanThu; lan++) {
    try {
      const j = await goiApi(loiThoai, voiceId);
      const buffer = Buffer.from(j.audio_base64, 'base64');
      if (buffer.length < 1000) throw new Error(`âm thanh quá ngắn (${buffer.length} byte)`);

      fs.mkdirSync(thuMucRa, { recursive: true });
      const duongDan = path.join(thuMucRa, `${tenFile}.mp3`);
      fs.writeFileSync(duongDan, buffer);

      /*
       * Ưu tiên `normalized_alignment`.
       *
       * ElevenLabs trả hai bản: `alignment` bám văn bản GỐC, còn
       * `normalized_alignment` bám văn bản SAU KHI chuẩn hoá (số viết thành chữ,
       * viết tắt mở ra…). Âm thanh phát ra theo bản chuẩn hoá, nên mốc của bản
       * gốc lệch dần ở mọi chỗ có chuyển đổi.
       */
      const tu = tuTuKyTu(j.normalized_alignment ?? j.alignment);
      if (!tu.length) throw new Error('không nhận được mốc thời gian');

      const cuoi = tu[tu.length - 1];
      const tongMs = cuoi.batDauMs + cuoi.keoDaiMs + 400;
      return {
        cacCau: [{ tep: `audio/${tenFile}.mp3`, batDauMs: 0, keoDaiMs: tongMs }],
        tu,
        tongMs,
      };
    } catch (e) {
      loiCuoi = e;
      if (e.choDuoc && lanChan < 4) {
        lanChan++;
        const cho = 3000 * lanChan;
        process.stdout.write(`(bị chặn, chờ ${cho / 1000}s) `);
        await nghi(cho);
        lan--;
        continue;
      }
      if (/ELEVENLABS_API_KEY|từ chối/.test(e.message)) throw e;
      if (lan < soLanThu) await nghi(1200 * lan);
    }
  }
  throw new Error(`ElevenLabs hỏng sau ${soLanThu} lần: ${loiCuoi?.message}`);
}

export const TEN = 'ElevenLabs';
/** Trả mốc thật cho cả bài — không cần chia đều theo câu. */
export const COT_MOC_SAN = true;
export const SAN_SANG = true;
