/**
 * Audit & tests
 *
 * Public report of what changed and what was checked. No wallet gate. The data
 * is content/audit-report.json, imported at build time (rules in CLAUDE.md §1).
 */

import Link from "next/link";
import AuditReport from "@/components/audit/AuditReport";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useChains } from "@/context/ChainsContext";
import type { AuditReport as AuditReportData } from "@/lib/auditReport";
import report from "@/content/audit-report.json";

export default function AuditPage() {
  const { chain } = useChains();

  return (
    <DashboardLayout title="Audit & tests">
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                {chain.registryName ? (
                  <Link href={`/${chain.registryName}/dashboard`}>Home</Link>
                ) : null}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Audit &amp; tests</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <AuditReport report={report as AuditReportData} />
      </div>
    </DashboardLayout>
  );
}
