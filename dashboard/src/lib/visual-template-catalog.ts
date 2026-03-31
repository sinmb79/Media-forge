import type {
  VisualTemplateRecord,
  VisualTemplateSectionRecord,
} from "./mediaforge-types";

const SECTION_LABELS: Record<VisualTemplateRecord["category"], string> = {
  effects: "효과",
  music: "뮤직 비주얼",
  particle: "파티클 씬",
};

export function buildVisualTemplateSections(
  templates: VisualTemplateRecord[],
): VisualTemplateSectionRecord[] {
  return (["effects", "music", "particle"] as const)
    .map((category) => ({
      id: category,
      label: SECTION_LABELS[category],
      templates: templates
        .filter((template) => template.category === category)
        .sort((left, right) => left.label.localeCompare(right.label)),
    }))
    .filter((section) => section.templates.length > 0);
}

export function getFeaturedVisualTemplates(
  templates: VisualTemplateRecord[],
  limit = 6,
): VisualTemplateRecord[] {
  const scored = templates.map((template) => ({
    score: scoreTemplate(template),
    template,
  }));

  return scored
    .sort((left, right) => right.score - left.score || left.template.label.localeCompare(right.template.label))
    .slice(0, limit)
    .map((entry) => entry.template);
}

function scoreTemplate(template: VisualTemplateRecord): number {
  const categoryWeight = template.category === "effects"
    ? 30
    : template.category === "music"
      ? 20
      : 10;

  return categoryWeight + template.tags.length;
}
