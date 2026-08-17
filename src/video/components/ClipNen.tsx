import React from "react";
import { OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";

/*
 * Clip video làm nền, thay cho ảnh tĩnh.
 *
 * Dùng cho clip sinh từ TikTok Symphony (hoặc bất kỳ công cụ nào): Symphony lo
 * phần hình — người thật cầm sản phẩm — còn ở đây ta chồng lên giọng tiếng Việt,
 * phụ đề khớp từng tiếng, số liệu thật từ database, và dòng công bố tiếp thị.
 *
 * ⚠️ DÙNG `OffthreadVideo`, KHÔNG dùng `Video`.
 * `Video` phát bằng thẻ <video> của trình duyệt: lúc xem thử trong Studio thì ổn,
 * nhưng khi dựng hàng loạt nó phải chờ trình duyệt tua đúng khung — chậm và
 * thỉnh thoảng lấy nhầm khung kế bên. `OffthreadVideo` rút khung bằng ffmpeg,
 * đúng khung và nhanh hơn nhiều.
 *
 * ⚠️ CLIP THƯỜNG NGẮN HƠN GIỌNG ĐỌC. Symphony tối đa 12 giây, mà lời thoại
 * thường 15–25 giây. Nên phải LẶP clip cho kín thời lượng — không lặp thì phần
 * cuối video là màn đen, và Remotion không báo gì cả vì "hết video" là trạng
 * thái hợp lệ.
 */

export const ClipNen: React.FC<{
  /** Danh sách clip, phát nối tiếp rồi quay lại từ đầu cho tới hết video. */
  clip: string[];
  /** Độ dài mỗi clip, mili-giây. Cùng thứ tự với `clip`. */
  doDaiMs: number[];
  /** `cover` cắt cho kín khung; `contain` giữ nguyên tỉ lệ. */
  vua?: "cover" | "contain";
}> = ({ clip, doDaiMs, vua = "cover" }) => {
  const { fps, durationInFrames } = useVideoConfig();

  if (!clip.length) return null;

  /*
   * Dựng sẵn danh sách lượt phát cho tới khi phủ kín thời lượng.
   *
   * Tính trước thay vì để Remotion tự lặp: mỗi `Sequence` cần biết chính xác nó
   * bắt đầu ở khung nào, và tính trong lúc vẽ thì mỗi khung lại tính lại một lần.
   */
  const luot: { tep: string; tuKhung: number; soKhung: number }[] = [];
  let khung = 0;
  let i = 0;
  // Chặn 200 lượt: clip hỏng trả về độ dài 0 sẽ làm vòng lặp chạy vô hạn và treo
  // cả tiến trình dựng mà không có thông báo nào.
  let vongLap = 0;
  while (khung < durationInFrames && vongLap < 200) {
    const soKhung = Math.max(1, Math.round((doDaiMs[i % clip.length] / 1000) * fps));
    luot.push({ tep: clip[i % clip.length], tuKhung: khung, soKhung });
    khung += soKhung;
    i++;
    vongLap++;
  }

  return (
    <>
      {luot.map((l, k) => (
        <Sequence
          key={`${l.tep}-${k}`}
          from={l.tuKhung}
          durationInFrames={l.soKhung}
          name={`Clip ${k + 1}`}
        >
          <OffthreadVideo
            src={staticFile(l.tep)}
            style={{ width: "100%", height: "100%", objectFit: vua }}
            /*
             * TẮT tiếng của clip.
             *
             * Clip Symphony có sẵn giọng của nó (thường tiếng Anh). Không tắt thì
             * hai giọng chồng lên nhau — nghe ra ngay, nhưng dễ bỏ sót khi xem
             * bản dựng thử không bật loa.
             */
            muted
          />
        </Sequence>
      ))}
    </>
  );
};
