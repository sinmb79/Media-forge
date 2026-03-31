import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVisualTemplateSections,
  getFeaturedVisualTemplates,
} from "../src/lib/visual-template-catalog";
import type { VisualTemplateRecord } from "../src/lib/mediaforge-types";

const templates: VisualTemplateRecord[] = [
  {
    category: "effects",
    engine: "canvas",
    id: "effects/aurora-flow",
    label: "Aurora Flow",
    primaryColor: "0x5df2d6",
    summary: "Soft aurora ribbons moving across a nocturne sky.",
    tags: ["aurora", "dreamy"],
  },
  {
    category: "music",
    engine: "canvas",
    id: "music/equalizer-bars",
    label: "Equalizer Bars",
    primaryColor: "0x00ff88",
    summary: "Reactive equalizer bars with layered glow.",
    tags: ["audio", "beats"],
  },
  {
    category: "particle",
    engine: "canvas",
    id: "particle/starfield",
    label: "Starfield",
    primaryColor: "0x9ed6ff",
    summary: "Deep-space starfield flying toward the viewer.",
    tags: ["space", "travel"],
  },
];

test("buildVisualTemplateSections groups templates by dashboard section", () => {
  const sections = buildVisualTemplateSections(templates);

  assert.deepEqual(
    sections.map((section) => section.id),
    ["effects", "music", "particle"],
  );
  assert.equal(sections[1]?.templates[0]?.id, "music/equalizer-bars");
});

test("getFeaturedVisualTemplates keeps the most browseable presets first", () => {
  const featured = getFeaturedVisualTemplates(templates, 2);

  assert.equal(featured.length, 2);
  assert.equal(featured[0]?.id, "effects/aurora-flow");
  assert.equal(featured[1]?.id, "music/equalizer-bars");
});
