/**
 * Not found
 *
 * Branded 404. Also where the transaction page's router.push("/404") lands.
 * "/" resolves the chain and goes to Home.
 */

import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <DashboardLayout title="Page not found">
      <Card className="mx-auto max-w-xl">
        <CardHeader className="text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Page not found
          </h1>
          <CardDescription>
            The page or transaction you were looking for does not exist, or the link is out of date.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="action" size="action-lg">
            <Link href="/">Go Home</Link>
          </Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
