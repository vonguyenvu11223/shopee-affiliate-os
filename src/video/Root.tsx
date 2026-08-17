import React from "react";
import { Composition } from "remotion";
import { VideoSanPham } from "./VideoSanPham";
import type { ThongSoVideoSanPham } from "./types";

export const FPS = 30;
export const RONG = 1080;
export const CAO = 1920;

/*
 * Thông số mặc định CHỈ để mở Remotion Studio xem bố cục.
 *
 * Khi dựng thật, `scripts/render-video.mjs` truyền props lấy từ Supabase và tính
 * lại số khung theo ĐỘ DÀI GIỌNG ĐỌC — không dùng con số ở đây.
 *
 * ⚠️ Số liệu dưới đây là GIẢ, đặt tên rõ ràng để không ai nhầm là dữ liệu thật.
 */
const MAC_DINH: ThongSoVideoSanPham = {
  id: "xem-thu",
  tenSanPham: "Sản phẩm mẫu — mở Studio để xem bố cục",
  tenNganGon: "Sản phẩm mẫu",
  tenCuaHang: "Cửa hàng mẫu",
  giaVnd: 199000,
  hoaHongPhanTram: 15,
  hoaHongVnd: 29850,
  daBan: 12400,
  tangTruongPhanTram: 8.4,
  anh: [],
  clipNen: [],
  clipDoDaiMs: [],
  loiThoai: "",
  cacCau: [],
  tu: [],
  doanAnh: [],
  doanNhanManh: [],
  tongMs: 30000,
  giongNguon: "",
};

export const Root: React.FC = () => (
  <Composition
    id="VideoSanPham"
    component={VideoSanPham}
    durationInFrames={Math.round((MAC_DINH.tongMs / 1000) * FPS)}
    fps={FPS}
    width={RONG}
    height={CAO}
    defaultProps={MAC_DINH}
  />
);
