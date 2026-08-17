import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { MocTu } from '../types';
import { CHU_THUONG } from '../chu';

/*
 * Phụ đề chạy theo giọng đọc.
 *
 * Nguyên tắc: KHÔNG hiện cả đoạn rồi tô dần. Video dọc chỉ cao 1920px mà phần
 * phụ đề chiếm chưa tới 1/5 màn — nhét cả đoạn vào là chữ bé như kiến. Thay vào
 * đó cắt thành từng CỤM ngắn, chỉ hiện cụm đang được đọc, và tô sáng đúng tiếng
 * đang phát trong cụm đó.
 */

const TIENG_MOI_CUM = 7;

/*
 * Chia lời thoại thành cụm để hiện từng cụm một.
 *
 * KHÔNG cắt cứng mỗi 7 tiếng: làm vậy thì câu bị cắt giữa chừng và cụm sau mở
 * đầu bằng mảnh đuôi của câu trước — đo thật thấy ra kiểu "…gấp hơn bảy lần / Và
 * nó", đọc rất khó chịu.
 *
 * Nên: đủ 5 tiếng trở lên mà gặp dấu câu thì ngắt luôn; quá 7 tiếng thì buộc
 * phải ngắt dù chưa gặp dấu, không thì cụm dài tràn khỏi khung.
 */
function chiaCum(tu: MocTu[]): MocTu[][] {
  const cum: MocTu[][] = [];
  let hienTai: MocTu[] = [];

  for (const t of tu) {
    hienTai.push(t);
    const gapDauCau = t.ketCau === true;
    if ((hienTai.length >= 5 && gapDauCau) || hienTai.length >= TIENG_MOI_CUM) {
      cum.push(hienTai);
      hienTai = [];
    }
  }
  if (hienTai.length) cum.push(hienTai);
  return cum;
}

export const Karaoke: React.FC<{ tu: MocTu[] }> = ({ tu }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const msHienTai = (frame / fps) * 1000;

  const cacCum = React.useMemo(() => chiaCum(tu), [tu]);

  /*
   * Tìm cụm đang đọc. Dùng "tiếng cuối cùng đã BẮT ĐẦU" chứ không phải khoảng
   * [bắt đầu, kết thúc] của từng tiếng: giữa hai tiếng luôn có khoảng lặng, mà
   * dò theo khoảng thì phụ đề sẽ chớp tắt ở mọi chỗ ngắt hơi.
   */
  let chiSoTieng = -1;
  for (let i = 0; i < tu.length; i++) {
    if (tu[i].batDauMs <= msHienTai) chiSoTieng = i;
    else break;
  }
  if (chiSoTieng < 0) return null;

  /*
   * Dò cụm chứa tiếng đang đọc bằng cách cộng dồn độ dài từng cụm.
   *
   * ⚠️ KHÔNG dùng `chiSoTieng / TIENG_MOI_CUM` như trước: cụm giờ dài ngắn khác
   * nhau (ngắt theo dấu câu), nên phép chia đó trỏ sai cụm ngay từ chỗ ngắt đầu
   * tiên — và sai lặng lẽ, phụ đề vẫn hiện, chỉ là tô nhầm tiếng.
   */
  let batDauCum = 0;
  let cum: MocTu[] | undefined;
  for (const c of cacCum) {
    if (chiSoTieng < batDauCum + c.length) {
      cum = c;
      break;
    }
    batDauCum += c.length;
  }
  if (!cum) return null;

  const viTriTrongCum = chiSoTieng - batDauCum;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0 18px',
        padding: '0 60px',
        textAlign: 'center',
      }}
    >
      {cum.map((t, i) => {
        const daDoc = i < viTriTrongCum;
        const dangDoc = i === viTriTrongCum;
        return (
          <span
            key={`${t.batDauMs}-${i}`}
            style={{
              fontFamily: CHU_THUONG,
              fontSize: 66,
              fontWeight: 800,
              lineHeight: 1.22,
              letterSpacing: -0.5,
              // Tiếng đang đọc bật lên màu hổ phách; tiếng đã đọc trắng; chưa
              // đọc thì mờ — mắt bám được nhịp mà không bị chói.
              color: dangDoc ? '#ffc94d' : daDoc ? '#ffffff' : 'rgba(255,255,255,0.42)',
              transform: dangDoc ? 'scale(1.08)' : 'scale(1)',
              // Viền tối để chữ đọc được trên mọi nền ảnh, kể cả ảnh sáng.
              textShadow: '0 4px 18px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9)',
            }}
          >
            {t.chu}
          </span>
        );
      })}
    </div>
  );
};
