import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Karaoke } from "./components/Karaoke";
import { AmThanhTheoCau } from "./components/AmThanhTheoCau";
import { AnhChay } from "./components/AnhChay";
import { ClipNen } from "./components/ClipNen";
import { CHU_TIEU_DE, CHU_THUONG } from "./chu";
import type { ThongSoVideoSanPham } from "./types";

/*
 * Video review một sản phẩm affiliate — khung dọc 1080×1920.
 *
 * ═══ BỐ CỤC NÀY KHÁC VIDEO THÔNG THƯỜNG Ở ĐÂU ═══
 *
 * Video bán hàng bình thường dồn hết sức vào lời quảng cáo. Ở đây thứ nặng nhất
 * trên màn hình là CON SỐ, vì mọi con số đều truy được về CSV Shopee đã nhập —
 * đó là lợi thế duy nhất mà một affiliate có dữ liệu nắm được so với người chỉ
 * quay video nói hay.
 *
 * ⚠️ KHÔNG hiển thị bất cứ chỉ số nào hệ thống không đo được. Cụ thể là đừng
 * thêm "đánh giá 4.9 sao" hay "cam kết chính hãng" — CSV không có hai thứ đó,
 * và một con số bịa trên video là thứ người xem bắt được ngay trong bình luận.
 */

const CAM = "#f4622f";
const NEN = "#0d0f14";

/** Chiều cao khối chữ ở đáy. Ảnh nằm dưới, chỉ bị lớp phủ làm tối dần. */
const CAO_DAY = 880;

const soVnd = (n: number) => "₫" + Math.round(n).toLocaleString("vi-VN");

/** Lượt bán Shopee thường rất lớn — rút gọn cho đỡ chiếm chỗ. */
function gonSoLuong(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".0", "") + " triệu";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(".0", "") + "k";
  return String(n);
}

export const VideoSanPham: React.FC<ThongSoVideoSanPham> = p => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const vao = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 22 });

  /*
   * Tên sản phẩm rút đi sau 4,5 giây.
   *
   * Tên hàng Shopee thường dài hai ba dòng; để nó nằm cả video thì che mất ảnh
   * suốt thời lượng, mà người xem đã đọc xong từ giây thứ hai.
   */
  const roiTen = interpolate(frame, [fps * 4.5, fps * 5.2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dải hoa hồng hiện muộn hơn một nhịp — đây là thông tin quan trọng nhất với
  // người xem đang cân nhắc, nên nó không nên xuất hiện cùng lúc với tên.
  const vaoSo = spring({
    frame: frame - Math.round(fps * 1.2),
    fps,
    config: { damping: 200 },
    durationInFrames: 20,
  });

  const coTangTruong = p.tangTruongPhanTram !== null && Number.isFinite(p.tangTruongPhanTram);

  /*
   * Con số nào đang được lời thoại nói tới thì sáng lên.
   *
   * Trả về 0…1 chứ không phải true/false: bật tắt đột ngột trông như lỗi nhấp
   * nháy, còn dâng lên rồi lịm xuống trong 0,3 giây thì mắt đọc thành "chỗ này
   * đang được nhắc tới". Đây là thứ khiến video trông được biên tập chứ không
   * phải một bản slide có tiếng.
   */
  const ms = (frame / fps) * 1000;
  const dangSang = (loai: string): number => {
    const d = (p.doanNhanManh ?? []).find(
      x => x.loai === loai && ms >= x.batDauMs && ms < x.ketThucMs
    );
    if (!d) return 0;
    const mo = 300;
    return interpolate(
      ms,
      [d.batDauMs, d.batDauMs + mo, d.ketThucMs - mo, d.ketThucMs],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  };

  return (
    <AbsoluteFill style={{ background: NEN }}>
      <AmThanhTheoCau cacCau={p.cacCau ?? []} />

      {/* ── Nền: ưu tiên clip video, không có thì dùng ảnh ── */}
      {p.clipNen?.length ? (
        // Clip phủ kín khung bằng `cover`: clip Symphony vốn đã là khung dọc
        // 9:16, để `contain` là thừa hai dải đen hai bên.
        <ClipNen clip={p.clipNen} doDaiMs={p.clipDoDaiMs ?? []} vua="cover" />
      ) : p.doanAnh?.length ? (
        <AnhChay doan={p.doanAnh} vua="contain" vungNet={{ top: 210, bottom: CAO_DAY - 150 }} />
      ) : (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.25)",
            fontFamily: CHU_THUONG,
            fontSize: 28,
          }}
        >
          chưa có ảnh sản phẩm
        </AbsoluteFill>
      )}

      {/* Lớp phủ chuyển sắc: chỉ tối ở nơi có chữ, giữ ảnh rõ ở phần giữa. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, rgba(13,15,20,0.94) 0%, rgba(13,15,20,0.5) 11%, rgba(13,15,20,0) 24%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(to top, rgba(13,15,20,0.97) 0%, rgba(13,15,20,0.94) ${
            (CAO_DAY - 280) / 19.2
          }%, rgba(13,15,20,0) ${CAO_DAY / 19.2}%)`,
        }}
      />

      {/* ── Tên sản phẩm + cửa hàng ── */}
      <div
        style={{
          position: "absolute",
          top: 66,
          left: 52,
          right: 52,
          textAlign: "center",
          opacity: vao * roiTen,
          transform: `translateY(${interpolate(vao, [0, 1], [-20, 0]) - (1 - roiTen) * 26}px)`,
        }}
      >
        <div
          style={{
            fontFamily: CHU_TIEU_DE,
            fontSize: 60,
            lineHeight: 1.04,
            color: "#fff",
            textTransform: "uppercase",
            textShadow: "0 6px 30px rgba(0,0,0,0.8)",
          }}
        >
          {p.tenNganGon || p.tenSanPham}
        </div>
        {p.tenCuaHang ? (
          <div
            style={{
              fontFamily: CHU_THUONG,
              fontSize: 25,
              fontWeight: 500,
              letterSpacing: 2,
              color: "rgba(255,255,255,0.62)",
              marginTop: 14,
              textShadow: "0 3px 16px rgba(0,0,0,0.85)",
            }}
          >
            {p.tenCuaHang}
          </div>
        ) : null}
      </div>

      {/* ── Khối đáy: số liệu + phụ đề ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: CAO_DAY,
          padding: "0 42px 58px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 26,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            opacity: vaoSo,
            transform: `translateY(${interpolate(vaoSo, [0, 1], [18, 0])}px)`,
          }}
        >
          {/*
           * CHỈ hiện con số người XEM quan tâm.
           *
           * Bản đầu tôi để ô "Hoa hồng" to nhất giữa màn — sai đối tượng. Hoa
           * hồng là con số để BẠN quyết định có đáng làm video hay không; người
           * xem không quan tâm bạn được bao nhiêu, và thấy nó chỉ khiến họ nghĩ
           * video làm vì tiền chứ không vì sản phẩm. Nó thuộc về Radar trong
           * app, không thuộc về video.
           */}
          <O nhan="Giá" giaTri={soVnd(p.giaVnd)} mau={CAM} toHon sang={dangSang("gia")} />
          {p.daBan !== null ? (
            <O nhan="Đã bán" giaTri={gonSoLuong(p.daBan)} sang={dangSang("daBan")} />
          ) : null}
        </div>

        {/*
         * Chỉ hiện tăng trưởng khi THẬT SỰ có hai snapshot.
         *
         * Đây là điểm khác biệt duy nhất so với mọi công cụ affiliate khác, nên
         * rất cám dỗ để luôn hiện một con số gì đó. Nhưng hiện "0%" khi chưa đủ
         * dữ liệu là nói dối bằng cách im lặng — người xem đọc thành "sản phẩm
         * này đứng yên", trong khi sự thật là "chưa ai đo".
         */}
        {coTangTruong ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              padding: "14px 0",
              borderTop: "1px solid rgba(255,255,255,0.13)",
              borderBottom: "1px solid rgba(255,255,255,0.13)",
              opacity: vaoSo,
            }}
          >
            <span
              style={{
                fontFamily: CHU_THUONG,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Lượt bán thay đổi
            </span>
            <span
              style={{
                fontFamily: CHU_THUONG,
                fontSize: 38,
                fontWeight: 800,
                color: (p.tangTruongPhanTram as number) >= 0 ? "#4ade80" : "#f87171",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {(p.tangTruongPhanTram as number) >= 0 ? "+" : ""}
              {(p.tangTruongPhanTram as number).toFixed(1)}%
            </span>
          </div>
        ) : null}

        {/* Phụ đề: chiều cao CỐ ĐỊNH để cụm dài ngắn không đẩy bố cục trên nhảy. */}
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Karaoke tu={p.tu} />
        </div>
      </div>

      {/*
       * Công bố tiếp thị liên kết.
       *
       * TikTok và YouTube đều BẮT BUỘC công bố quan hệ có thù lao; thiếu nó là
       * lý do gỡ video và khoá kiếm tiền, không phải chuyện lịch sự. Đặt ngay
       * trên phụ đề, nhỏ nhưng đọc được — giấu vào mô tả thì nhiều nền tảng
       * không tính là đã công bố.
       */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 22,
          textAlign: "center",
          fontFamily: CHU_THUONG,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: 1.4,
          color: "rgba(255,255,255,0.42)",
        }}
      >
        {p.kenh === "shopee"
          ? "Tiếp thị liên kết · Sản phẩm gắn trong video"
          : "Tiếp thị liên kết · Link ở phần mô tả"}
      </div>

      {/* Thanh tiến độ — người xem video dọc quyết định lướt tiếp trong vài giây đầu. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 5,
          width: `${(frame / durationInFrames) * 100}%`,
          background: CAM,
        }}
      />
    </AbsoluteFill>
  );
};

const O: React.FC<{
  nhan: string;
  giaTri: string;
  mau?: string;
  /** Ô hoa hồng rộng và to hơn — nó là con số quyết định với người xem. */
  toHon?: boolean;
  /** 0…1: mức đang được lời thoại nói tới. */
  sang?: number;
}> = ({ nhan, giaTri, mau, toHon, sang = 0 }) => (
  <div
    style={{
      flex: toHon ? 1.35 : 1,
      padding: "0 16px",
      textAlign: "center",
      // Đường tóc thay cho khung bao: khung chia màn thành nhiều hộp rời rạc,
      // đường mảnh chỉ tách nội dung mà giữ dải là một khối.
      borderLeft: "1px solid rgba(255,255,255,0.14)",
      // Phóng nhẹ khi được nhắc tới. Chỉ dùng `transform` — animate kích thước
      // thật thì mỗi khung là một lần tính lại bố cục của cả dải.
      transform: `scale(${1 + sang * 0.07})`,
      opacity: 0.62 + sang * 0.38,
    }}
  >
    <div
      style={{
        fontFamily: CHU_THUONG,
        fontSize: 19,
        fontWeight: 600,
        letterSpacing: 1.6,
        textTransform: "uppercase",
        color: `rgba(255,255,255,${0.52 + sang * 0.35})`,
        marginBottom: 9,
      }}
    >
      {nhan}
    </div>
    <div
      style={{
        fontFamily: CHU_THUONG,
        fontSize: toHon ? 46 : 36,
        fontWeight: 800,
        color: mau ?? "#fff",
        lineHeight: 1.05,
        fontVariantNumeric: "tabular-nums",
        textShadow: sang > 0 ? `0 0 ${sang * 26}px ${mau ?? "#fff"}55` : undefined,
      }}
    >
      {giaTri}
    </div>
  </div>
);
