import assert from "node:assert/strict";
import test from "node:test";

import {
  buildForgeAssetCards,
} from "../src/lib/asset-library";

test("buildForgeAssetCards maps official asset metadata into dashboard cards", () => {
  const cards = buildForgeAssetCards([
    {
      category: "backgrounds",
      created_at: "2026-03-30T00:00:00.000Z",
      data: {
        summary: "Neo city alley with reflective puddles",
      },
      id: "bg-neo-city",
      is_official: true,
      name: "Neo City Alley",
      name_ko: "네오 시티 골목",
      thumbnail: "data/seeds/thumbs/neo-city.png",
      type: "reference_image",
      usage_count: 18,
    },
  ]);

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.kind, "library");
  assert.equal(cards[0]?.category, "Library · backgrounds");
  assert.match(cards[0]?.description ?? "", /official/i);
  assert.match(cards[0]?.description ?? "", /Neo city alley/i);
});
