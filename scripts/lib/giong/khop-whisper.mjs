import fs from 'node:fs';
import path from 'node:path';

/*
 * Lấy mốc thời gian THẬT của từng tiếng trong một file giọng có sẵn.
 *
 * Dùng khi bạn tự thu giọng hoặc tải MP3 từ đâu đó: không có API nào nói cho ta
 * biết tiếng nào phát ở giây nào, nên đưa file qua nhận dạng giọng nói để hỏi.
 *
 * Model: `whisper-1`. ⚠️ Đây là model DUY NHẤT của OpenAI còn trả mốc từng
 * tiếng — các model `gpt-4o-transcribe` mới hơn KHÔNG hỗ trợ
 * `timestamp_granularities`, dù nghe tên thì có vẻ tiến bộ hơn.
 *
 * Giá $0,006/phút → video 20 giây tốn khoảng 50 đồng.
 *
 * ═══ VÌ SAO KHÔNG DÙNG THẲNG CHỮ WHISPER NHẬN RA ═══
 *
 * Whisper nghe tiếng Việt khá tốt nhưng vẫn sai dấu và tách từ khác ta. Ta ĐÃ
 * BIẾT chính xác lời thoại — nó là thứ ta đưa cho người đọc. Nên chỉ lấy MỐC
 * THỜI GIAN của Whisper rồi gắn vào chữ của mình. Lấy cả chữ của nó thì phụ đề
 * sẽ hiện "khong nghin" thay vì "không nghìn", và không ai hiểu vì sao.
 */

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

/** Bỏ dấu và dấu câu để so khớp — chỉ dùng để đối chiếu, không dùng để hiển thị. */
const gon = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Gọi Whisper, trả về mảng { chu, batDauMs, ketThucMs } theo cách NÓ nghe được.
 * Ném lỗi nếu không có khoá hoặc gọi hỏng.
 */
async function nhanDang(duongDanAmThanh) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('KHONG_CO_KHOA');

  const form = new FormData();
  const buf = fs.readFileSync(duongDanAmThanh);
  form.append('file', new Blob([buf]), path.basename(duongDanAmThanh));
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  // Mảng, phải append từng phần tử — gửi chuỗi "word" thì máy chủ bỏ qua lặng lẽ
  // và trả về kết quả KHÔNG có mốc từng tiếng, mà vẫn HTTP 200.
  form.append('timestamp_granularities[]', 'word');
  // Khai ngôn ngữ để nó khỏi đoán — đoán nhầm sang tiếng Trung là chuyện có thật
  // với câu ngắn nhiều thanh điệu.
  form.append('language', 'vi');

  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Whisper lỗi HTTP ${r.status}: ${j?.error?.message ?? '(không rõ)'}`);
  if (!Array.isArray(j?.words) || !j.words.length)
    throw new Error('Whisper không trả về mốc từng tiếng — kiểm lại model có phải whisper-1 không');

  return j.words.map((w) => ({
    chu: w.word,
    batDauMs: Math.round(w.start * 1000),
    ketThucMs: Math.round(w.end * 1000),
  }));
}

/**
 * Gắn mốc của Whisper vào ĐÚNG chữ trong lời thoại của ta.
 *
 * Whisper có thể nghe thiếu, nghe thừa, hoặc tách từ khác. Nên: khớp tham lam
 * theo dạng đã bỏ dấu, tiếng nào khớp thì lấy mốc thật làm NEO; những tiếng nằm
 * giữa hai neo thì nội suy đều.
 *
 * Cách này chịu được sai sót của Whisper mà vẫn giữ đúng chữ hiển thị — quan
 * trọng hơn hẳn việc đòi khớp 100%, vì phụ đề sai chữ thì người xem thấy ngay
 * còn lệch 80ms thì không ai nhận ra.
 */
function ganMoc(tuCuaTa, tuWhisper, tongMs) {
  const neo = new Array(tuCuaTa.length).fill(null);
  let j = 0;

  for (let i = 0; i < tuCuaTa.length && j < tuWhisper.length; i++) {
    const ta = gon(tuCuaTa[i]);
    if (!ta) continue;
    // Nhìn trước tối đa 3 tiếng của Whisper: nó hay chèn thêm một tiếng lạ,
    // nhưng nhìn xa hơn nữa thì bắt đầu khớp nhầm sang chỗ khác trong câu.
    for (let k = j; k < Math.min(j + 3, tuWhisper.length); k++) {
      if (gon(tuWhisper[k].chu) === ta) {
        neo[i] = tuWhisper[k];
        j = k + 1;
        break;
      }
    }
  }

  const soNeo = neo.filter(Boolean).length;

  const ra = [];
  for (let i = 0; i < tuCuaTa.length; i++) {
    if (neo[i]) {
      ra.push({
        batDauMs: neo[i].batDauMs,
        keoDaiMs: Math.max(1, neo[i].ketThucMs - neo[i].batDauMs),
      });
      continue;
    }
    // Nội suy giữa neo trước và neo sau.
    let truoc = i - 1;
    while (truoc >= 0 && !neo[truoc]) truoc--;
    let sau = i + 1;
    while (sau < tuCuaTa.length && !neo[sau]) sau++;

    const mocTruoc = truoc >= 0 ? neo[truoc].ketThucMs : 0;
    const mocSau = sau < tuCuaTa.length ? neo[sau].batDauMs : tongMs;
    const soChen = sau - truoc - 1;
    const buoc = (mocSau - mocTruoc) / Math.max(1, soChen);
    const viTri = i - truoc - 1;
    ra.push({
      batDauMs: Math.round(mocTruoc + viTri * buoc),
      keoDaiMs: Math.max(1, Math.round(buoc)),
    });
  }
  return { moc: ra, soNeo };
}

/**
 * Trả về mảng MocTu khớp thật, hoặc `null` khi không làm được.
 *
 * `null` KHÔNG phải lỗi — chưa cắm khoá OpenAI là chuyện bình thường. Nơi gọi
 * phải tự lùi về cách chia theo tỉ lệ.
 */
export async function khopMocThat(duongDanAmThanh, loiThoai, tongMs) {
  let tuWhisper;
  try {
    tuWhisper = await nhanDang(duongDanAmThanh);
  } catch (e) {
    if (e.message === 'KHONG_CO_KHOA') return null;
    console.log(`   ⚠️  Không khớp được mốc thật: ${e.message}`);
    return null;
  }

  const tho = String(loiThoai).split(/\s+/).filter(Boolean);
  const { moc, soNeo } = ganMoc(tho, tuWhisper, tongMs);

  const tiLe = tho.length ? soNeo / tho.length : 0;
  /*
   * Dưới 60% số tiếng khớp được thì đừng dùng.
   *
   * Khớp quá ít nghĩa là Whisper nghe ra một bài khác — thường do file giọng
   * không phải bài này, hoặc thu quá ồn. Lúc đó mốc "thật" còn tệ hơn chia đều,
   * vì nó lệch bất thường chứ không lệch đều, nhìn như video hỏng.
   */
  if (tiLe < 0.6) {
    console.log(
      `   ⚠️  Chỉ khớp ${soNeo}/${tho.length} tiếng (${Math.round(tiLe * 100)}%) — dùng cách chia đều.`
    );
    return null;
  }

  console.log(`   🎯 Khớp mốc thật: ${soNeo}/${tho.length} tiếng (${Math.round(tiLe * 100)}%)`);

  return tho.map((t, i) => ({
    batDauMs: moc[i].batDauMs,
    keoDaiMs: moc[i].keoDaiMs,
    chu: t.replace(/[.,!?;:…"'`]+$/g, ''),
    ketCau: /[.,!?;:…]$/.test(t),
  }));
}
