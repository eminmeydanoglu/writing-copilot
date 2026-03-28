"use client";

import React from "react";
import ReactMarkdown from "react-markdown";

function splitFrontmatter(markdown: string): {
  frontmatter: string | null;
  body: string;
} {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return {
      frontmatter: null,
      body: markdown
    };
  }

  return {
    frontmatter: match[1] ?? null,
    body: markdown.slice(match[0].length)
  };
}

export function RenderedMarkdownDocument({
  markdown
}: {
  markdown: string;
}) {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const trimmedBody = body.trim();

  return (
    <article className="rounded-[26px] border border-[color:var(--line)] bg-white px-6 py-6 shadow-[0_18px_40px_rgba(22,32,29,0.04)]">
      {frontmatter ? (
        <section className="mb-6 rounded-[20px] border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">
              Frontmatter
            </p>
          </div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-7 text-[color:var(--muted)]">
            {frontmatter}
          </pre>
        </section>
      ) : null}

      {trimmedBody ? (
        <div className="writing-rendered-markdown">
          <ReactMarkdown>{trimmedBody}</ReactMarkdown>
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-[color:var(--line)] bg-[color:var(--paper)] px-5 py-8 text-sm text-[color:var(--muted)]">
          The draft is empty.
        </div>
      )}
    </article>
  );
}
