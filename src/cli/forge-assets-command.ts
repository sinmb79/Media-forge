import {
  addForgeAsset,
  listForgeAssets,
  removeForgeAsset,
  seedForgeAssetLibrary,
} from "../forge/assets/library.js";

export async function forgeAssetsCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, maybeId] = positionals;

  switch (subcommand) {
    case "list": {
      const assets = await listForgeAssets({
        ...(options.optionValues.category?.[0] ? { category: options.optionValues.category[0] } : {}),
        ...(options.optionValues.type?.[0] ? { type: options.optionValues.type[0] } : {}),
      });

      if (options.json) {
        return {
          exitCode: 0,
          output: `${JSON.stringify({ assets, count: assets.length }, null, 2)}\n`,
        };
      }

      return {
        exitCode: 0,
        output: `${assets.map((asset) => `${asset.id}  ${asset.category}/${asset.type}  ${asset.name}`).join("\n")}\n`,
      };
    }
    case "add": {
      const type = options.optionValues.type?.[0];
      const name = options.optionValues.name?.[0];
      const category = options.optionValues.category?.[0];
      const rawData = options.optionValues.data?.[0];

      if (!type || !name || !category || !rawData) {
        break;
      }

      const data = JSON.parse(rawData) as Record<string, unknown>;
      const asset = await addForgeAsset({
        category,
        data,
        name,
        type,
      });

      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify(asset, null, 2)}\n`
          : `Added asset: ${asset.id}\n`,
      };
    }
    case "remove":
      if (!maybeId) {
        break;
      }

      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify(await removeForgeAsset({ id: maybeId }), null, 2)}\n`
          : `Removed asset: ${maybeId}\n`,
      };
    case "seed": {
      const result = await seedForgeAssetLibrary();

      return {
        exitCode: 0,
        output: options.json
          ? `${JSON.stringify(result, null, 2)}\n`
          : `Seeded assets: ${result.seeded_count}\n`,
      };
    }
    default:
      break;
  }

  return {
    exitCode: 1,
    output: "Usage: engine forge assets <list|add|remove|seed> ...\n",
  };
}
