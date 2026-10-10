export const AUDIT_AREAS = [
  "security",
  "signing",
  "ux",
  "tests",
  "infrastructure",
  "docs",
  "contracts",
] as const;
export const AUDIT_STATUSES = ["verified", "shipped", "in-progress"] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];
export type AuditStatus = (typeof AUDIT_STATUSES)[number];
export interface AuditEvidence {
  label: string;
  url: string;
}
export interface AuditEntry {
  id: string;
  date: string;
  area: AuditArea;
  status: AuditStatus;
  title: string;
  summary: string;
  details: string[];
  evidence: AuditEvidence[];
}
export interface AuditTestSuite {
  suites: number;
  tests: number;
  passed: number;
  failed: number;
  command: string;
  commit: string;
  ranAt: string;
}
export interface AuditReport {
  schemaVersion: 1;
  updatedAt: string;
  testSuite?: AuditTestSuite;
  entries: AuditEntry[];
}

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidUrl(url: string): boolean {
  if (/^https:\/\//.test(url)) return true;
  // repo-relative path: no leading "/", no "..", no spaces
  if (url.startsWith("/")) return false;
  if (url.includes("..")) return false;
  if (/\s/.test(url)) return false;
  return true;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function validateAuditReport(data: unknown): string[] {
  const errors: string[] = [];

  if (!isRecord(data)) {
    errors.push("top level: report must be an object");
    return errors;
  }

  if (data.schemaVersion !== 1) {
    errors.push("top level: schemaVersion must equal 1");
  }

  if (!isNonEmptyString(data.updatedAt) || !isRealDate(data.updatedAt)) {
    errors.push("top level: updatedAt must be a real calendar date YYYY-MM-DD");
  }

  if (!Array.isArray(data.entries)) {
    errors.push("top level: entries must be an array");
    return errors;
  }

  const seenIds = new Set<string>();

  data.entries.forEach((entry, index) => {
    const at = (name: string) => `entry ${index}: ${name}`;

    if (!isRecord(entry)) {
      errors.push(at("entry must be an object"));
      return;
    }

    const id = entry.id;
    if (typeof id !== "string" || !ID_RE.test(id)) {
      errors.push(at("id must be kebab-case (lowercase letters, digits, single hyphens)"));
    } else if (seenIds.has(id)) {
      errors.push(at(`id "${id}" is duplicated (ids must be unique)`));
    } else {
      seenIds.add(id);
    }

    if (typeof entry.date !== "string" || !isRealDate(entry.date)) {
      errors.push(at("date must be a real calendar date YYYY-MM-DD"));
    }

    if (
      typeof entry.area !== "string" ||
      !(AUDIT_AREAS as readonly string[]).includes(entry.area)
    ) {
      errors.push(at("area must be one of AUDIT_AREAS"));
    }

    if (
      typeof entry.status !== "string" ||
      !(AUDIT_STATUSES as readonly string[]).includes(entry.status)
    ) {
      errors.push(at("status must be one of AUDIT_STATUSES"));
    }

    if (!isNonEmptyString(entry.title)) {
      errors.push(at("title must be a non-empty string"));
    } else if (entry.title.length > 70) {
      errors.push(at("title must be at most 70 characters"));
    }

    if (!isNonEmptyString(entry.summary)) {
      errors.push(at("summary must be a non-empty string"));
    } else if (entry.summary.length > 140) {
      errors.push(at("summary must be at most 140 characters"));
    } else if (entry.summary.includes("\n") || entry.summary.includes("\r")) {
      errors.push(at("summary must be a single line (no newline)"));
    }

    if (!Array.isArray(entry.details)) {
      errors.push(at("details must be an array"));
    } else if (entry.details.length > 8) {
      errors.push(at("details must have at most 8 items"));
    } else {
      entry.details.forEach((detail, di) => {
        if (!isNonEmptyString(detail)) {
          errors.push(at(`details[${di}] must be a non-empty string`));
        } else if (detail.length > 200) {
          errors.push(at(`details[${di}] must be at most 200 characters`));
        }
      });
    }

    if (!Array.isArray(entry.evidence)) {
      errors.push(at("evidence must be an array"));
    } else {
      entry.evidence.forEach((ev, ei) => {
        if (!isRecord(ev)) {
          errors.push(at(`evidence[${ei}] must be an object`));
          return;
        }
        if (!isNonEmptyString(ev.label)) {
          errors.push(at(`evidence[${ei}] label must be a non-empty string`));
        }
        if (typeof ev.url !== "string" || !isValidUrl(ev.url)) {
          errors.push(
            at(
              `evidence[${ei}] url must be an https:// URL or a repo-relative path (no leading "/", no "..", no spaces)`,
            ),
          );
        }
      });
    }

    if (entry.status === "verified" && Array.isArray(entry.evidence) && entry.evidence.length < 1) {
      errors.push(at(`status "verified" requires at least one evidence item`));
    }
  });

  // ordering: entries newest first; updatedAt >= newest entry date
  for (let i = 0; i < data.entries.length - 1; i++) {
    const cur = data.entries[i];
    const next = data.entries[i + 1];
    if (
      isRecord(cur) &&
      isRecord(next) &&
      typeof cur.date === "string" &&
      typeof next.date === "string" &&
      isRealDate(cur.date) &&
      isRealDate(next.date) &&
      cur.date < next.date
    ) {
      errors.push(
        `entry "${String(cur.id)}": entries are out of order; sort newest first (date must be >= the next entry's date)`,
      );
    }
  }

  if (
    typeof data.updatedAt === "string" &&
    isRealDate(data.updatedAt) &&
    data.entries.length > 0 &&
    isRecord(data.entries[0]) &&
    typeof data.entries[0].date === "string" &&
    isRealDate(data.entries[0].date) &&
    data.updatedAt < data.entries[0].date
  ) {
    errors.push("top level: updatedAt must be >= the newest entry date");
  }

  // testSuite (optional)
  if (data.testSuite !== undefined) {
    if (!isRecord(data.testSuite)) {
      errors.push("testSuite: must be an object");
    } else {
      const ts = data.testSuite;
      if (!nonNegativeInteger(ts.suites)) {
        errors.push("testSuite: suites must be a non-negative integer");
      }
      if (!nonNegativeInteger(ts.tests)) {
        errors.push("testSuite: tests must be a non-negative integer");
      }
      if (!nonNegativeInteger(ts.passed)) {
        errors.push("testSuite: passed must be a non-negative integer");
      }
      if (!nonNegativeInteger(ts.failed)) {
        errors.push("testSuite: failed must be a non-negative integer");
      }
      if (
        nonNegativeInteger(ts.passed) &&
        nonNegativeInteger(ts.failed) &&
        nonNegativeInteger(ts.tests) &&
        ts.passed + ts.failed > ts.tests
      ) {
        errors.push("testSuite: passed + failed must be <= tests");
      }
      if (!isNonEmptyString(ts.command)) {
        errors.push("testSuite: command must be a non-empty string");
      }
      if (!isNonEmptyString(ts.commit)) errors.push("testSuite: commit must be a non-empty string");
      if (!isNonEmptyString(ts.ranAt) || !isRealDate(ts.ranAt)) {
        errors.push("testSuite: ranAt must be a real calendar date YYYY-MM-DD");
      }
    }
  }

  return errors;
}
