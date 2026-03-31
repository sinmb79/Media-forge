"use client";

import { useCallback, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useDropzone } from "react-dropzone";

import { cn } from "@/lib/utils";
import { useStudioStore } from "@/lib/studio-store";
import type { UploadedFileRecord } from "@/lib/mediaforge-types";

export function FileDropInput({
  accept,
  label,
  description,
  onUploaded,
}: {
  accept?: Record<string, string[]>;
  label: string;
  description: string;
  onUploaded: (file: UploadedFileRecord) => void;
}) {
  const uploadFile = useStudioStore((state) => state.uploadFile);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFileRecord | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const record = await uploadFile(file);
      setUploaded(record);
      onUploaded(record);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
      setError(message);
    } finally {
      setUploading(false);
    }
  }, [onUploaded, uploadFile]);

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept,
    maxFiles: 1,
    onDrop,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-[28px] border border-dashed p-5 transition",
          isDragActive
            ? "border-emerald-300/50 bg-emerald-500/10"
            : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]",
        )}
      >
        <input {...getInputProps()} />
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
            <UploadCloud className="h-5 w-5 text-emerald-200" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{label}</div>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
            <div className="mt-3 text-xs uppercase tracking-[0.22em] text-zinc-500">
              {uploading ? "업로드 중..." : "파일을 놓거나 클릭해서 선택하세요"}
            </div>
          </div>
        </div>
      </div>

      {uploaded ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          저장 위치: {uploaded.relativePath}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
