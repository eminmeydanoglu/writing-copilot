import type { TAbstractFile, TFile, Vault } from "obsidian";
import type {
  KnownRequestStatus,
  RequestRecord,
  RequestRecordIndex,
  RequestStatus
} from "./types";

const KNOWN_REQUEST_STATUSES: KnownRequestStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "reviewed"
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileLike(entry: TAbstractFile | null | undefined): entry is TFile {
  return !!entry && typeof (entry as TFile).extension === "string";
}

function hasChildren(entry: TAbstractFile | null | undefined): entry is TAbstractFile & {
  children: TAbstractFile[];
} {
  return !!entry && Array.isArray((entry as { children?: unknown }).children);
}

function requireStringField(
  payload: Record<string, unknown>,
  field: string,
  sourcePath: string
): string {
  const value = payload[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Request record ${sourcePath} is missing a valid "${field}" string.`);
  }

  return value;
}

function readOptionalStringField(
  payload: Record<string, unknown>,
  field: string,
  sourcePath: string
): string | undefined {
  const value = payload[field];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Request record ${sourcePath} has an invalid "${field}" field.`);
  }

  return value;
}

function readOptionalCountField(
  payload: Record<string, unknown>,
  field: string,
  sourcePath: string
): number | undefined {
  const value = payload[field];

  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(`Request record ${sourcePath} has an invalid "${field}" count.`);
  }

  return value;
}

export function isRequestStatus(value: string): value is RequestStatus {
  return value.trim().length > 0;
}

export function isKnownRequestStatus(value: string): value is KnownRequestStatus {
  return KNOWN_REQUEST_STATUSES.includes(value as KnownRequestStatus);
}

export function parseRequestRecord(
  input: unknown,
  sourcePath: string,
  bodyPath?: string
): RequestRecord {
  if (!isPlainObject(input)) {
    throw new Error(`Request record ${sourcePath} must be a JSON object.`);
  }

  const createdAt = requireStringField(input, "createdAt", sourcePath);
  const status = requireStringField(input, "status", sourcePath);

  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error(`Request record ${sourcePath} has an invalid "createdAt" value.`);
  }

  if (!isRequestStatus(status)) {
    throw new Error(`Request record ${sourcePath} is missing a valid "status" string.`);
  }

  return {
    id: requireStringField(input, "id", sourcePath),
    agent: requireStringField(input, "agent", sourcePath),
    title: requireStringField(input, "title", sourcePath),
    task: requireStringField(input, "task", sourcePath),
    createdAt,
    status,
    shadowRevision: requireStringField(input, "shadowRevision", sourcePath),
    sourcePath,
    bodyPath,
    notesPath: readOptionalStringField(input, "notesPath", sourcePath),
    resultPath: readOptionalStringField(input, "resultPath", sourcePath),
    acceptedCount: readOptionalCountField(input, "acceptedCount", sourcePath),
    rejectedCount: readOptionalCountField(input, "rejectedCount", sourcePath)
  };
}

export function indexRequestRecords(records: RequestRecord[]): RequestRecordIndex {
  const toTimestamp = (record: RequestRecord): number => Date.parse(record.createdAt);
  const sortedRecords = [...records].sort((left, right) =>
    toTimestamp(right) - toTimestamp(left)
  );

  return {
    records: sortedRecords,
    byId: Object.fromEntries(sortedRecords.map((record) => [record.id, record])),
    latest: sortedRecords[0] ?? null
  };
}

export async function loadRequestIndex(
  vault: Vault,
  requestsPath: string
): Promise<RequestRecordIndex> {
  const requestsRoot = vault.getAbstractFileByPath(requestsPath);

  if (!hasChildren(requestsRoot)) {
    return indexRequestRecords([]);
  }

  const markdownBodyPaths = new Map<string, string>();
  const jsonFiles: TFile[] = [];

  for (const child of requestsRoot.children) {
    if (!isFileLike(child)) {
      continue;
    }

    if (child.extension === "json") {
      jsonFiles.push(child);
      continue;
    }

    if (child.extension === "md") {
      markdownBodyPaths.set(child.basename, child.path);
    }
  }

  const parsedRecords = await Promise.all(
    jsonFiles.map(async (jsonFile) => {
      const rawJson = await vault.cachedRead(jsonFile);
      let payload: unknown;

      try {
        payload = JSON.parse(rawJson) as unknown;
      } catch (error) {
        throw new Error(
          `Request record ${jsonFile.path} contains invalid JSON: ${
            error instanceof Error ? error.message : "Unknown parse error."
          }`
        );
      }

      return parseRequestRecord(
        payload,
        jsonFile.path,
        markdownBodyPaths.get(jsonFile.basename)
      );
    })
  );

  return indexRequestRecords(parsedRecords);
}
