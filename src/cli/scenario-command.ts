import { createCharacter, getCharacter, listCharacters } from "../forge/character/manager.js";
import { ingestScenario } from "../scenario/ingest.js";

export async function scenarioCommand(
  positionals: string[],
  options: {
    json: boolean;
    optionValues: Record<string, string[]>;
  },
): Promise<{ exitCode: number; output: string }> {
  const [subcommand, secondArg] = positionals;

  if (subcommand === "ingest") {
    const scenarioPath = secondArg ?? options.optionValues.path?.[0];
    if (!scenarioPath) {
      return {
        exitCode: 1,
        output: "Usage: engine scenario ingest <path> [--format webtoon,shortform,longform] [--simulate]\n",
      };
    }

    const simulate = options.optionValues.simulate !== undefined
      || positionals.includes("--simulate");

    const result = await ingestScenario({
      scenarioPath,
      simulate,
    });

    if (options.json) {
      return { exitCode: 0, output: `${JSON.stringify(result, null, 2)}\n` };
    }

    const lines = [
      `Scenario: ${result.scenario.title}`,
      `Characters: ${result.resolved_characters.map((c) => `${c.name}${c.newly_created ? " (new)" : ""}`).join(", ")}`,
      `Outputs:`,
      ...result.planned_outputs.map(
        (p) => `  ${p.format}: ${p.scene_count} scenes, ${p.estimated_duration_sec ? `~${p.estimated_duration_sec}s` : "N/A"} [${p.status}]`,
      ),
    ];

    return { exitCode: 0, output: lines.join("\n") + "\n" };
  }

  if (subcommand === "character") {
    const action = secondArg;

    if (action === "create") {
      const name = options.optionValues.name?.[0];
      const desc = options.optionValues.desc?.[0] ?? "";
      const ref = options.optionValues.ref?.[0];
      const type = options.optionValues.type?.[0] ?? "realistic";

      if (!name) {
        return {
          exitCode: 1,
          output: "Usage: engine scenario character create --name <name> --desc <description> [--ref <image>] [--type realistic|anime|2d]\n",
        };
      }

      const character = await createCharacter({
        name,
        description: desc,
        reference_images: ref ? [ref] : [],
        type: type as "realistic" | "anime" | "2d" | "custom",
      });

      if (options.json) {
        return { exitCode: 0, output: `${JSON.stringify(character, null, 2)}\n` };
      }

      return { exitCode: 0, output: `Created character: ${character.name} (${character.id})\n` };
    }

    if (action === "list") {
      const characters = await listCharacters();
      if (options.json) {
        return { exitCode: 0, output: `${JSON.stringify(characters, null, 2)}\n` };
      }

      if (characters.length === 0) {
        return { exitCode: 0, output: "No characters registered.\n" };
      }

      const lines = characters.map(
        (c) => `${c.id} | ${c.name} | ${c.type} | refs: ${c.reference_images.length}`,
      );
      return { exitCode: 0, output: lines.join("\n") + "\n" };
    }

    if (action === "get") {
      const idOrName = positionals[2] ?? options.optionValues.id?.[0] ?? options.optionValues.name?.[0];
      if (!idOrName) {
        return { exitCode: 1, output: "Usage: engine scenario character get <id-or-name>\n" };
      }

      const character = await getCharacter({ idOrName });
      if (!character) {
        return { exitCode: 1, output: `Character not found: ${idOrName}\n` };
      }

      if (options.json) {
        return { exitCode: 0, output: `${JSON.stringify(character, null, 2)}\n` };
      }

      return {
        exitCode: 0,
        output: `${character.name} (${character.id})\nType: ${character.type}\nRefs: ${character.reference_images.join(", ") || "none"}\nDesc: ${character.description}\n`,
      };
    }

    return {
      exitCode: 1,
      output: "Usage: engine scenario character <create|list|get> ...\n",
    };
  }

  return {
    exitCode: 1,
    output: "Usage: engine scenario <ingest|character> ...\n",
  };
}
