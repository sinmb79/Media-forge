export interface ParsedCommandArgs {
  flags: Set<string>;
  optionValues: Record<string, string[]>;
  positionals: string[];
}

export function parseCommandArgs(args: string[]): ParsedCommandArgs {
  const flags = new Set<string>();
  const optionValues: Record<string, string[]> = {};
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token) {
      continue;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const name = token.slice(2);
    const nextToken = args[index + 1];

    if (nextToken && !nextToken.startsWith("--")) {
      optionValues[name] = [...(optionValues[name] ?? []), nextToken];
      index += 1;
      continue;
    }

    flags.add(name);
  }

  return {
    flags,
    optionValues,
    positionals,
  };
}

export function getOptionValue(
  parsed: ParsedCommandArgs,
  name: string,
): string | null {
  return parsed.optionValues[name]?.[0] ?? null;
}
