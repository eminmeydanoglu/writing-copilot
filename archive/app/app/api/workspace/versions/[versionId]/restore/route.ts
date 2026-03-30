import { NextResponse } from "next/server";
import { getWorkspacePaths } from "@/src/lib/workspace/config";
import { ensureWorkspace, restoreVersion } from "@/src/lib/workspace/files";

export async function POST(
  _request: Request,
  context: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await context.params;
  const paths = getWorkspacePaths();

  await ensureWorkspace(paths);

  try {
    const workspace = await restoreVersion(paths, versionId);
    return NextResponse.json(workspace);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not restore version"
      },
      { status: 404 }
    );
  }
}
