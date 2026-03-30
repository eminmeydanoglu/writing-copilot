import {
  indexRequestRecords,
  parseRequestRecord
} from "../src/lib/requests";

describe("request schema", () => {
  it("parses a valid request record", () => {
    expect(
      parseRequestRecord(
        {
          id: "req-1",
          agent: "Writer",
          title: "Tighten ending",
          task: "Propose a stronger conclusion",
          createdAt: "2026-03-28T10:30:00.000Z",
          status: "completed",
          shadowRevision: "shadow-17",
          notesPath: "writings/example/requests/req-1.md",
          acceptedCount: 2,
          rejectedCount: 1
        },
        "writings/example/requests/req-1.json",
        "writings/example/requests/req-1.md"
      )
    ).toEqual({
      id: "req-1",
      agent: "Writer",
      title: "Tighten ending",
      task: "Propose a stronger conclusion",
      createdAt: "2026-03-28T10:30:00.000Z",
      status: "completed",
      shadowRevision: "shadow-17",
      sourcePath: "writings/example/requests/req-1.json",
      bodyPath: "writings/example/requests/req-1.md",
      notesPath: "writings/example/requests/req-1.md",
      resultPath: undefined,
      acceptedCount: 2,
      rejectedCount: 1
    });
  });

  it("accepts provider-specific statuses as long as they are non-empty strings", () => {
    expect(
      parseRequestRecord(
        {
          id: "req-2",
          agent: "Writer",
          title: "Provider status",
          task: "Test custom status",
          createdAt: "2026-03-28T10:30:00.000Z",
          status: "done",
          shadowRevision: "shadow-18"
        },
        "writings/example/requests/req-2.json"
      ).status
    ).toBe("done");
  });

  it("indexes records newest first and exposes lookup by id", () => {
    const index = indexRequestRecords([
      parseRequestRecord(
        {
          id: "old",
          agent: "Writer",
          title: "Old",
          task: "Older request",
          createdAt: "2026-03-28T09:00:00.000Z",
          status: "completed",
          shadowRevision: "shadow-old"
        },
        "writings/example/requests/old.json"
      ),
      parseRequestRecord(
        {
          id: "new",
          agent: "Philosopher",
          title: "New",
          task: "Newer request",
          createdAt: "2026-03-28T11:00:00.000Z",
          status: "reviewed",
          shadowRevision: "shadow-new"
        },
        "writings/example/requests/new.json"
      )
    ]);

    expect(index.records.map((record) => record.id)).toEqual(["new", "old"]);
    expect(index.latest?.id).toBe("new");
    expect(index.byId.old.agent).toBe("Writer");
  });

  it("sorts request records by actual time instead of lexicographic timestamp order", () => {
    const index = indexRequestRecords([
      parseRequestRecord(
        {
          id: "utc-later",
          agent: "Writer",
          title: "UTC later",
          task: "Later in absolute time",
          createdAt: "2026-03-28T10:00:00.000Z",
          status: "completed",
          shadowRevision: "shadow-utc"
        },
        "writings/example/requests/utc-later.json"
      ),
      parseRequestRecord(
        {
          id: "offset-earlier",
          agent: "Writer",
          title: "Offset earlier",
          task: "Earlier in absolute time",
          createdAt: "2026-03-28T12:00:00+03:00",
          status: "completed",
          shadowRevision: "shadow-offset"
        },
        "writings/example/requests/offset-earlier.json"
      )
    ]);

    expect(index.records.map((record) => record.id)).toEqual([
      "utc-later",
      "offset-earlier"
    ]);
    expect(index.latest?.id).toBe("utc-later");
  });
});
