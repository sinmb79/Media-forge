import { NextResponse } from "next/server";

import { listVisualTemplates } from "@/lib/mediaforge-visual";
import { buildVisualTemplateSections, getFeaturedVisualTemplates } from "@/lib/visual-template-catalog";

export async function GET() {
  const templates = listVisualTemplates();

  return NextResponse.json({
    featured: getFeaturedVisualTemplates(templates),
    schema_version: "0.1",
    sections: buildVisualTemplateSections(templates),
    templates,
  });
}
