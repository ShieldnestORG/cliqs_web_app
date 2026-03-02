import AccountView from "@/components/dataViews/AccountView";
import Head from "@/components/head";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useChains } from "@/context/ChainsContext";
import Link from "next/link";

export default function AccountPage() {
  const { chain } = useChains();

  return (
    <div className="container mx-auto max-w-[1600px] px-[0.75in] py-8">
      <Head title={`Account - ${chain.chainDisplayName || "Cosmos Hub"}`} />

      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                {chain.registryName ? <Link href={`/${chain.registryName}`}>Home</Link> : null}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Account</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <AccountView />
      </div>
    </div>
  );
}
