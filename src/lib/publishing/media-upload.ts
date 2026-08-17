"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export const MEDIA_BUCKET = "content-media";
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const ALLOWED_TYPES = /^(video\/(mp4|quicktime|webm)|image\/(jpeg|png|webp))$/;

export interface UploadedMedia {
  url: string;
  path: string;
  kind: "VIDEO" | "PHOTO";
  contentType: string;
  sizeBytes: number;
}

const extensionFor = (type: string) => type.split("/")[1]?.replace("quicktime", "mov") ?? "bin";

/**
 * Upload thẳng từ browser lên Supabase Storage để không chạm giới hạn
 * body của serverless function. Đường dẫn bắt đầu bằng id người dùng theo policy.
 */
export async function uploadMediaFile(file: File): Promise<UploadedMedia> {
  if (!ALLOWED_TYPES.test(file.type)) throw new Error("Chỉ nhận video mp4/mov/webm hoặc ảnh jpg/png/webp.");
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) throw new Error("File phải lớn hơn 0 và nhỏ hơn 200 MB.");

  const supabase = createSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase chưa được cấu hình nên chưa thể tải file lên.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Bạn cần đăng nhập để tải file lên.");

  const path = `${auth.user.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Không thể tải file lên: ${error.message}`);

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return {
    url: data.publicUrl,
    path,
    kind: file.type.startsWith("image/") ? "PHOTO" : "VIDEO",
    contentType: file.type,
    sizeBytes: file.size,
  };
}
