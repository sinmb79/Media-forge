import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getMediaForgeRuntime } from "@/lib/mediaforge-runtime";

export async function POST(request: Request) {
  const runtime = getMediaForgeRuntime();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        reason: "No file provided.",
      },
      { status: 400 },
    );
  }

  const uploadDir = path.resolve(runtime.rootDir, "data", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const targetPath = path.resolve(uploadDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(targetPath, buffer);

  return NextResponse.json({
    filename: safeName,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name,
    path: targetPath,
    relativePath: path.relative(runtime.rootDir, targetPath),
    sizeBytes: buffer.length,
    url: `/api/uploads/${encodeURIComponent(safeName)}`,
  });
}

function sanitizeFileName(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "upload.bin";
}
