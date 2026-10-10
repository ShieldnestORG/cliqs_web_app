import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AuditReport as AuditReportType, AuditStatus } from "@/lib/auditReport";

const GITHUB_BASE = "https://github.com/ShieldnestORG/cliqs_web_app/blob/main";

function StatusBadge({ status }: { status: AuditStatus }) {
  if (status === "verified") {
    return (
      <Badge variant="success" mark="signal">
        Verified
      </Badge>
    );
  }
  if (status === "shipped") {
    return (
      <Badge variant="info" mark="signal">
        Shipped
      </Badge>
    );
  }
  return (
    <Badge variant="warning" mark="half">
      In progress
    </Badge>
  );
}

function EvidenceLink({ label, url }: { label: string; url: string }) {
  if (/^https:\/\//.test(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
        {label}
      </a>
    );
  }
  return (
    <a
      href={`${GITHUB_BASE}/${url}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-info hover:underline"
    >
      {label}
    </a>
  );
}

export default function AuditReport({ report }: { report: AuditReportType }) {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        Audit &amp; tests
      </h1>
      <p className="text-sm text-muted-foreground">Last updated {report.updatedAt}</p>
      {report.testSuite ? (
        <p className="text-sm text-muted-foreground">
          Tests: {report.testSuite.passed} of {report.testSuite.tests} passed in{" "}
          {report.testSuite.suites} suites · commit{" "}
          <span className="font-mono">{report.testSuite.commit}</span> · {report.testSuite.ranAt}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        What has been built, checked and tested in CLIQS. Open a row for details and proof.
      </p>

      {report.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <Card className="bg-none">
          <CardContent className="pt-6">
            <Accordion type="multiple">
              {report.entries.map((entry) => (
                <AccordionItem key={entry.id} value={entry.id}>
                  <AccordionTrigger className="gap-3 hover:no-underline">
                    <span className="flex flex-1 flex-col items-start gap-1 text-left">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{entry.title}</span>
                        <StatusBadge status={entry.status} />
                        <span className="font-mono text-xs text-muted-foreground">
                          {entry.date}
                        </span>
                      </span>
                      <span className="line-clamp-1 text-sm font-normal text-muted-foreground sm:line-clamp-none">
                        {entry.summary}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {entry.details.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {entry.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    ) : null}
                    {entry.evidence.length > 0 ? (
                      <p className="mt-3 text-sm">
                        <span className="text-muted-foreground">Proof:</span>{" "}
                        {entry.evidence.map((ev, i) => (
                          <span key={i}>
                            {i > 0 ? " · " : null}
                            <EvidenceLink label={ev.label} url={ev.url} />
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
