/**
 * Validator Dashboard Page
 *
 * File: pages/[chainName]/validator.tsx
 *
 * Free validator dashboard for single-signature transactions.
 * Allows validators to claim commission, withdraw rewards, and
 * set withdraw addresses without needing a multisig.
 */

import Head from "@/components/head";
import { useChains } from "@/context/ChainsContext";
import ValidatorDashboard from "@/components/dataViews/ValidatorDashboard";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";

export default function ValidatorPage() {
  const { chain } = useChains();

  return (
    <div className="container mx-auto max-w-[1800px] px-[0.75in] py-8">
      <Head title={`Validator Dashboard - ${chain.chainDisplayName || "Cosmos"}`} />

      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                {chain.registryName ? (
                  <Link href={`/${chain.registryName}`}>{chain.chainDisplayName || "Home"}</Link>
                ) : null}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Validator Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Dashboard */}
        <ValidatorDashboard />
      </div>
    </div>
  );
}
