/**
 * Validator Dashboard Page
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
    <div className="container mx-auto max-w-[1800px] px-4 py-8 sm:px-6 lg:px-[0.75in]">
      <Head title={`Validator Dashboard - ${chain.chainDisplayName || "Cosmos"}`} />

      <div className="space-y-6">
        {/* Breadcrumb */}
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
              <BreadcrumbPage>Validator Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page title: first thing on the page in every dashboard state */}
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Validator Dashboard
        </h1>

        {/* Dashboard */}
        <ValidatorDashboard />
      </div>
    </div>
  );
}
