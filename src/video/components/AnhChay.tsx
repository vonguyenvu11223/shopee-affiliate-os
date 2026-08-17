import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

/*
 * Nhiều ảnh chạy nối tiếp trong cùng một ô, chuyển bằng mờ chồng.
 *
 * ═══ ẢNH ĐỔI THEO LỜI, KHÔNG CHIA ĐỀU THỜI LƯỢNG ═══
 *
 * Bản đầu tôi chia đều tổng thời lượng cho số ảnh. Sai: ảnh đổi giữa lúc người
 * đọc đang nói dở một ý, còn lúc lời chuyển sang ý mới thì hình vẫn đứng yên.
 * Người xem cảm nhận được sự lệch đó ngay cả khi không chỉ ra được là lệch gì.
 *
 * Nên mốc thời gian truyền từ NGOÀI vào (`doan`), lấy từ bảng phân cảnh: mỗi
 * cảnh biết nó bắt đầu ở câu nào, mà mỗi câu đã có mốc thật đo từ file âm thanh.
 *
 * ⚠️ VẼ CHỒNG TẤT CẢ, KHÔNG DÙNG `Sequence`.
 * `Sequence` gắn/tháo ảnh theo thời gian, nên bức sau chỉ bắt đầu TẢI đúng lúc
 * nó cần hiện — khung đầu của mỗi lần chuyển ra trắng. Ở đây mọi ảnh đều nằm
 * trong cây view ngay từ khung 0, chỉ đổi `opacity`; Remotion vì vậy tải sẵn
 * toàn bộ trước khi dựng.
 *
 * ⚠️ Chỉ động vào `opacity` và `transform` — hai thứ chạy trên tầng hợp thành.
 * Tháo phần tử ra hay đổi kích thước thật là mỗi lần chuyển một lần bố cục lại.
 */

const MO_CHONG_GIAY = 0.55;

export type DoanAnh = {
  tep: string;
  batDauMs: number;
  ketThucMs: number;
};

export const AnhChay: React.FC<{
  doan: DoanAnh[];
  /** `contain` cho ảnh tách nền, `cover` cho tranh có cảnh. */
  vua?: 'cover' | 'contain';
  /**
   * Vùng đặt ảnh NÉT, tính bằng px từ mép khung. Nền mờ luôn phủ kín cả khung.
   *
   * Cần tách hai vùng vì khối chữ ở đáy che mất gần một nửa màn: để ảnh nét căn
   * giữa cả khung thì nửa dưới con vật nằm sau lớp phủ, còn nửa trên là một mảng
   * trống. Căn giữa trong phần màn CÒN NHÌN THẤY mới đúng.
   */
  vungNet?: { top: number; bottom: number };
}> = ({ doan, vua = 'contain', vungNet }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (doan.length === 0) return null;

  const khung = (ms: number) => (ms / 1000) * fps;
  const mo = MO_CHONG_GIAY * fps;

  return (
    <>
      {doan.map((d, i) => {
        const dau = khung(d.batDauMs);
        const cuoi = khung(d.ketThucMs);

        /*
         * Ảnh ĐẦU phải rõ ngay từ khung 0, ảnh CUỐI phải giữ tới hết. Không chặn
         * hai đầu thì video mở ra bằng nửa giây đen và kết bằng nửa giây đen —
         * trông như lỗi dựng chứ không ai đọc ra là hiệu ứng.
         */
        const laDau = i === 0;
        const laCuoi = i === doan.length - 1;

        const doRo = interpolate(
          frame,
          [
            laDau ? -1 : dau - mo / 2,
            laDau ? 0 : dau + mo / 2,
            laCuoi ? durationInFrames : cuoi - mo / 2,
            laCuoi ? durationInFrames + 1 : cuoi + mo / 2,
          ],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        if (doRo <= 0) return null;

        // Phóng rất chậm (hiệu ứng Ken Burns) để hình không chết cứng.
        const phong = interpolate(frame, [dau, cuoi], [1, 1.06], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        /*
         * HAI LỚP cho mỗi ảnh: nền mờ phủ kín + ảnh nét ở giữa.
         *
         * Tranh phục dựng hay rất ngang (đo thật: 4000×1286, tỉ lệ 3,1:1) trong
         * khi khung video là 9:16. Chỉ dùng `cover` thì cắt mất 4/5 chiều ngang,
         * con vật còn lại cái bụng. Chỉ dùng `contain` thì hai đầu là hai dải
         * trống, nhìn như ảnh dán lên nền — đúng thứ trông nghiệp dư.
         *
         * Nền mờ lấy chính bức đó, phóng to phủ kín rồi làm nhoè và tối đi: khung
         * hình kín từ mép tới mép, màu sắc ăn nhập vì cùng một bức, mà con vật
         * vẫn nguyên vẹn.
         */
        return (
          <React.Fragment key={d.tep + i}>
            <Img
              src={staticFile(d.tep)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: doRo,
                // Phóng thêm 20%: `blur` lấy mẫu cả ngoài biên nên mép ảnh bị
                // nhoè thành viền sáng nếu không cho nó tràn ra ngoài khung.
                transform: `scale(${phong * 1.2})`,
                // Sáng 0,55 chứ không phải 0,34: tối quá thì nền đọc thành mảng
                // đen trơn, mất luôn tác dụng "phủ kín khung bằng chính bức ảnh".
                filter: 'blur(52px) brightness(0.55) saturate(1.2)',
              }}
            />
            {/* Bọc trong khung riêng rồi mới `contain` bên trong: đặt top/bottom
                thẳng lên thẻ ảnh thì nó kéo giãn theo khung chứ không căn giữa. */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: vungNet?.top ?? 0,
                bottom: vungNet?.bottom ?? 0,
              }}
            >
              <Img
                src={staticFile(d.tep)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: vua,
                  opacity: doRo,
                  transform: `scale(${phong})`,
                }}
              />
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
};
