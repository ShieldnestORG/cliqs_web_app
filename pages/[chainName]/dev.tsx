import DevTools from "@/components/DevTools/DevToolsPage";
import Head from "@/components/head";
import { useChains } from "@/context/ChainsContext";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DevPage() {
  const { chain } = useChains();

  return (
    <DashboardLayout>
      <Head title={`Developer Tools - ${chain.chainDisplayName || "Cosmos Hub"}`} />
      
      <div className="py-2">
        <div className="space-y-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  {chain.registryName ? (
                    <Link href={`/${chain.registryName}/dashboard`}>Home</Link>
                  ) : (
                    <Link href="/">Home</Link>
                  )}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Developer Tools</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <DevTools />
        </div>
      </div>
    </DashboardLayout>
  );
}
