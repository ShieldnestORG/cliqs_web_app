import { render, screen } from "@testing-library/react";
import AuditReport from "@/components/audit/AuditReport";
import { validateAuditReport, type AuditReport as AuditReportType } from "@/lib/auditReport";
import report from "@/content/audit-report.json";

function makeValidReport(): AuditReportType {
  return {
    schemaVersion: 1,
    updatedAt: "2026-10-09",
    testSuite: {
      suites: 63,
      tests: 460,
      passed: 460,
      failed: 0,
      command: "npm run test:ci",
      commit: "ffadc3f",
      ranAt: "2026-10-09",
    },
    entries: [
      {
        id: "ux-flow-cleanup-2026-10",
        date: "2026-10-09",
        area: "ux",
        status: "verified",
        title: "Navigation and flows cleaned up",
        summary: "One menu, one home for each action, old paths redirected.",
        details: ["One menu per action", "Old paths redirect"],
        evidence: [
          {
            label: "PR #78",
            url: "https://github.com/ShieldnestORG/cliqs_web_app/pull/78",
          },
        ],
      },
      {
        id: "docs-setup-2026-09",
        date: "2026-09-01",
        area: "docs",
        status: "shipped",
        title: "Docs written",
        summary: "Setup guide written.",
        details: [],
        evidence: [],
      },
    ],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("validateAuditReport", () => {
  it("accepts the shipped content file", () => {
    expect(validateAuditReport(report)).toEqual([]);
  });

  it("accepts a valid minimal report", () => {
    expect(validateAuditReport(makeValidReport())).toEqual([]);
  });

  it("rejects a non-object report", () => {
    const errors = validateAuditReport(null);
    expect(errors.some((e) => e.includes("top level"))).toBe(true);
  });

  it("rejects a wrong schemaVersion", () => {
    const data = clone(makeValidReport()) as unknown as { schemaVersion: number };
    data.schemaVersion = 2;
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("schemaVersion"))).toBe(true);
  });

  it("rejects a non-object entry", () => {
    const data = clone(makeValidReport());
    data.entries[0] = 42 as never;
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("entry"))).toBe(true);
  });

  it("rejects a bad id", () => {
    const data = clone(makeValidReport());
    data.entries[0].id = "Bad_ID";
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("rejects a duplicate id", () => {
    const data = clone(makeValidReport());
    data.entries[1].id = data.entries[0].id;
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("duplicate") || e.includes("unique"))).toBe(true);
  });

  it("rejects the impossible date 2026-02-30", () => {
    const data = clone(makeValidReport());
    data.entries[0].date = "2026-02-30";
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("date"))).toBe(true);
  });

  it("rejects an unknown area", () => {
    const data = clone(makeValidReport());
    data.entries[0].area = "meme" as never;
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("area"))).toBe(true);
  });

  it("rejects an unknown status", () => {
    const data = clone(makeValidReport());
    data.entries[0].status = "done" as never;
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("status"))).toBe(true);
  });

  it("rejects a title longer than 70 chars", () => {
    const data = clone(makeValidReport());
    data.entries[0].title = "a".repeat(71);
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("title"))).toBe(true);
  });

  it("rejects a summary with a newline", () => {
    const data = clone(makeValidReport());
    data.entries[0].summary = "line one\nline two";
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("summary"))).toBe(true);
  });

  it("rejects 9 details", () => {
    const data = clone(makeValidReport());
    data.entries[0].details = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("details"))).toBe(true);
  });

  it("rejects verified without evidence", () => {
    const data = clone(makeValidReport());
    data.entries[0].status = "verified";
    data.entries[0].evidence = [];
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("verified"))).toBe(true);
  });

  it("rejects a url with '..'", () => {
    const data = clone(makeValidReport());
    data.entries[0].evidence[0].url = "../secret/file.md";
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("url"))).toBe(true);
  });

  it("rejects entries out of order", () => {
    const data = clone(makeValidReport());
    data.entries[0].date = "2026-08-01";
    data.entries[1].date = "2026-09-01";
    data.updatedAt = "2026-09-01";
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("order"))).toBe(true);
  });

  it("rejects updatedAt older than the newest entry", () => {
    const data = clone(makeValidReport());
    data.updatedAt = "2026-10-08";
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("updatedAt"))).toBe(true);
  });

  it("rejects passed + failed > tests", () => {
    const data = clone(makeValidReport());
    data.testSuite = {
      suites: 1,
      tests: 10,
      passed: 8,
      failed: 5,
      command: "x",
      commit: "y",
      ranAt: "2026-10-09",
    };
    const errors = validateAuditReport(data);
    expect(errors.some((e) => e.includes("passed"))).toBe(true);
  });
});

describe("<AuditReport />", () => {
  it("renders the title and a Verified badge", () => {
    render(<AuditReport report={makeValidReport()} />);
    expect(screen.getByText("Audit & tests")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
  });
});
