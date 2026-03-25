import { NextResponse } from "next/server";
import { getWorkspacePaths } from "@/src/lib/workspace/config";
import {
  ensureWorkspace,
  readWorkspace,
  syncShadow,
  writeCanonical
} from "@/src/lib/workspace/files";

const DEFAULT_DOCUMENT = `# Untitled Draft

Start writing here.
`;

async function ensureDefaultWorkspace() {
  const paths = getWorkspacePaths();
  await ensureWorkspace(paths, DEFAULT_DOCUMENT);
  return readWorkspace(paths);
}

export async function GET() {
  const workspace = await ensureDefaultWorkspace();
  return NextResponse.json(workspace);
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { canonical?: string };
  const paths = getWorkspacePaths();

  await ensureDefaultWorkspace();
  await writeCanonical(paths, body.canonical ?? DEFAULT_DOCUMENT, {
    source: "manual",
    label: "Saved canonical draft"
  });
  await syncShadow(paths);

  const workspace = await readWorkspace(paths);
  return NextResponse.json(workspace);
}
