import {
  listVisualTemplates as listEngineVisualTemplates,
  runVisualRender,
} from "../../../dist/src/forge/visual/render.js";

import type { VisualTemplateRecord } from "./mediaforge-types";

export function listVisualTemplates(): VisualTemplateRecord[] {
  return (listEngineVisualTemplates() as VisualTemplateRecord[]).map((template) => ({
    ...template,
    tags: [...template.tags],
  }));
}

export {
  runVisualRender,
};
