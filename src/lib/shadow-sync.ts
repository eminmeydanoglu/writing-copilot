import { diff } from "@codemirror/merge";

interface LineChange {
  from: number;
  to: number;
  insert: string[];
}

interface MergeRegion {
  from: number;
  to: number;
  hasCanonical: boolean;
  hasShadow: boolean;
}

function shouldMergeRegions(left: MergeRegion, right: MergeRegion): boolean {
  if (right.from < left.to && right.to > left.from) {
    return true;
  }

  if (right.from !== left.to) {
    return false;
  }

  return left.from === left.to || right.from === right.to;
}

function splitIntoLineTokens(text: string): string[] {
  if (text.length === 0) {
    return [];
  }

  const matches = text.match(/.*?(?:\r\n|\n|$)/g) ?? [];
  return matches.filter((line) => line.length > 0);
}

function encodeLineSets(...lineSets: string[][]): string[] {
  const tokenByLine = new Map<string, string>();
  let nextCodePoint = 0xe000;

  return lineSets.map((lines) =>
    lines
      .map((line) => {
        let token = tokenByLine.get(line);

        if (!token) {
          token = String.fromCodePoint(nextCodePoint);
          nextCodePoint += 1;
          tokenByLine.set(line, token);
        }

        return token;
      })
      .join("")
  );
}

function buildLineChanges(baseLines: string[], targetLines: string[]): LineChange[] {
  const encodedSets = encodeLineSets(baseLines, targetLines);
  const baseEncoded = encodedSets[0] ?? "";
  const targetEncoded = encodedSets[1] ?? "";

  return diff(baseEncoded, targetEncoded, {
    scanLimit: 500
  }).map((change) => ({
    from: change.fromA,
    to: change.toA,
    insert: targetLines.slice(change.fromB, change.toB)
  }));
}

function mapBaseIndexToTarget(
  changes: readonly LineChange[],
  index: number,
  assoc: "start" | "end"
): number {
  let offset = 0;

  for (const change of changes) {
    if (index < change.from) {
      break;
    }

    if (index > change.to) {
      offset += change.insert.length - (change.to - change.from);
      continue;
    }

    if (index === change.to && change.from !== change.to) {
      return change.from + offset + change.insert.length;
    }

    if (index === change.from && change.from === change.to) {
      return change.from + offset + (assoc === "end" ? change.insert.length : 0);
    }

    return assoc === "end"
      ? change.from + offset + change.insert.length
      : change.from + offset;
  }

  return index + offset;
}

function sliceTargetLines(
  targetLines: readonly string[],
  changes: readonly LineChange[],
  from: number,
  to: number
): string[] {
  const start = mapBaseIndexToTarget(changes, from, "start");
  const end = mapBaseIndexToTarget(changes, to, "end");
  return targetLines.slice(start, end);
}

function buildMergeRegions(
  canonicalChanges: readonly LineChange[],
  shadowChanges: readonly LineChange[]
): MergeRegion[] {
  const taggedChanges = [
    ...canonicalChanges.map((change) => ({ ...change, source: "canonical" as const })),
    ...shadowChanges.map((change) => ({ ...change, source: "shadow" as const }))
  ].sort((left, right) => {
    if (left.from !== right.from) {
      return left.from - right.from;
    }

    if (left.to !== right.to) {
      return left.to - right.to;
    }

    return left.source === "canonical" ? -1 : 1;
  });

  const regions: MergeRegion[] = [];

  for (const change of taggedChanges) {
    const lastRegion = regions[regions.length - 1];
    const nextRegion: MergeRegion = {
      from: change.from,
      to: change.to,
      hasCanonical: change.source === "canonical",
      hasShadow: change.source === "shadow"
    };

    if (
      lastRegion &&
      shouldMergeRegions(lastRegion, nextRegion)
    ) {
      lastRegion.to = Math.max(lastRegion.to, nextRegion.to);
      lastRegion.hasCanonical ||= nextRegion.hasCanonical;
      lastRegion.hasShadow ||= nextRegion.hasShadow;
      continue;
    }

    regions.push(nextRegion);
  }

  return regions;
}

export function syncShadowWithCanonicalChange(
  previousCanonical: string,
  nextCanonical: string,
  currentShadow: string
): string {
  if (previousCanonical === nextCanonical) {
    return currentShadow;
  }

  if (currentShadow === previousCanonical) {
    return nextCanonical;
  }

  const baseLines = splitIntoLineTokens(previousCanonical);
  const canonicalLines = splitIntoLineTokens(nextCanonical);
  const shadowLines = splitIntoLineTokens(currentShadow);
  const canonicalChanges = buildLineChanges(baseLines, canonicalLines);
  const shadowChanges = buildLineChanges(baseLines, shadowLines);

  if (canonicalChanges.length === 0) {
    return currentShadow;
  }

  if (shadowChanges.length === 0) {
    return nextCanonical;
  }

  const regions = buildMergeRegions(canonicalChanges, shadowChanges);
  const mergedLines: string[] = [];
  let baseIndex = 0;

  for (const region of regions) {
    if (baseIndex < region.from) {
      mergedLines.push(...baseLines.slice(baseIndex, region.from));
    }

    if (region.hasCanonical) {
      mergedLines.push(
        ...sliceTargetLines(canonicalLines, canonicalChanges, region.from, region.to)
      );
    } else {
      mergedLines.push(
        ...sliceTargetLines(shadowLines, shadowChanges, region.from, region.to)
      );
    }

    baseIndex = region.to;
  }

  if (baseIndex < baseLines.length) {
    mergedLines.push(...baseLines.slice(baseIndex));
  }

  return mergedLines.join("");
}
