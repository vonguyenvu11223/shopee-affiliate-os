"use client";

import { useState } from "react";
import { ClipboardCheck, Clapperboard, FileVideo } from "lucide-react";
import { ContentTestBuilder } from "@/components/content-test-builder";
import { AiVideoStudio } from "@/components/ai-video-studio";
import { VisualPromptStudio } from "@/components/visual-prompt-studio";

type ManualProps = React.ComponentProps<typeof ContentTestBuilder>;
type VideoProps = React.ComponentProps<typeof AiVideoStudio>;
type PromptProps = React.ComponentProps<typeof VisualPromptStudio>;

export function ContentStudioTabs({ manual, video, prompt }: { manual: ManualProps; video: VideoProps; prompt: PromptProps }) {
  const [tab, setTab] = useState<"manual" | "prompt" | "video">("manual");
  return <>
    <div className="studio-tabs">
      <button type="button" className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>
        <ClipboardCheck size={16} /> Brief thủ công
      </button>
      <button type="button" className={tab === "prompt" ? "active" : ""} onClick={() => setTab("prompt")}>
        <Clapperboard size={16} /> Prompt ảnh/video <em>miễn phí</em>
      </button>
      <button type="button" className={tab === "video" ? "active" : ""} onClick={() => setTab("video")}>
        <FileVideo size={16} /> AI Video <em>chưa kiểm chứng</em>
      </button>
    </div>
    {tab === "manual" && <ContentTestBuilder {...manual} />}
    {tab === "prompt" && <VisualPromptStudio {...prompt} />}
    {tab === "video" && <AiVideoStudio {...video} />}
  </>;
}
