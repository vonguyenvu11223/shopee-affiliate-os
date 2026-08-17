import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import type { DoanAmThanh } from '../types';

/*
 * Phát nhiều file âm thanh nối tiếp nhau, mỗi câu một file.
 *
 * Vì sao không ghép thành một file trước: ghép mp3 cần ffmpeg. Remotion có mang
 * ffmpeg theo nhưng không cho gọi như một lệnh ngoài, nên phải cài thêm — trong
 * khi Remotion vốn xếp được nhiều đoạn âm thanh theo thời gian bằng `Sequence`.
 * Đỡ một phụ thuộc, và đổi lại còn dễ gỡ lỗi hơn: nghe riêng được từng câu để
 * biết câu nào máy đọc sai.
 */
export const AmThanhTheoCau: React.FC<{ cacCau: DoanAmThanh[] }> = ({ cacCau }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {cacCau.map((c, i) => (
        <Sequence
          key={c.tep}
          from={Math.round((c.batDauMs / 1000) * fps)}
          // Cộng thêm 2 khung: làm tròn xuống có thể cắt cụt vài mili-giây cuối,
          // nghe thành tiếng "tách" ở mỗi chỗ nối câu.
          durationInFrames={Math.round((c.keoDaiMs / 1000) * fps) + 2}
          name={`Câu ${i + 1}`}
        >
          <Audio src={staticFile(c.tep)} />
        </Sequence>
      ))}
    </>
  );
};
