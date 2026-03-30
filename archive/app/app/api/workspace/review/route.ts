import { NextResponse } from "next/server";
import { getWorkspacePaths } from "@/src/lib/workspace/config";
import { ensureWorkspace, reviewWorkspace } from "@/src/lib/workspace/files";
import type { ReviewDecision } from "@/src/lib/workspace/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    decisions?: Partial<Record<string, ReviewDecision>>;
  };
  const paths = getWorkspacePaths();

  await ensureWorkspace(paths);
  const workspace = await reviewWorkspace(paths, body.decisions ?? {});

  return NextResponse.json(workspace);
}
