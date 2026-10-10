/**
 * Find Cliq Form
 *
 * Form to search for an existing Cliq by address.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ChainInfo } from "@/context/ChainsContext/types";
import { StargateClient } from "@cosmjs/stargate";
import { zodResolver } from "@hookform/resolvers/zod";
import { NextRouter, withRouter } from "next/router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useChains } from "../../context/ChainsContext";
import { exampleAddress } from "../../lib/displayHelpers";
import { ArrowRight } from "lucide-react";
import { KitIcon } from "@/components/icons/kit";

const existsCliqAccount = async (chain: ChainInfo, address: string) => {
  try {
    const client = await StargateClient.connect(chain.nodeAddress);
    const accountOnChain = await client.getAccount(address);
    return accountOnChain !== null;
  } catch {
    return false;
  }
};

interface FindCliqFormProps {
  router: NextRouter;
}

const FindCliqForm = ({ router }: FindCliqFormProps) => {
  const { chain } = useChains();

  const findCliqSchema = z.object({
    address: z
      .string()
      .trim()
      .min(1, "Required")
      .startsWith(chain.addressPrefix, `Invalid prefix for ${chain.chainDisplayName}`)
      .refine(async (address) => await existsCliqAccount(chain, address), {
        message: "CLIQ not found on chain",
      }),
  });

  const findCliqForm = useForm<z.infer<typeof findCliqSchema>>({
    resolver: zodResolver(findCliqSchema),
    defaultValues: { address: "" },
  });

  const submitFindCliq = ({ address }: z.infer<typeof findCliqSchema>) =>
    router.push(`/${chain.registryName}/${address}`);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KitIcon name="search" size={24} className="text-foreground" />
          Open a CLIQ by address
        </CardTitle>
        <CardDescription>
          Enter the address of your existing CLIQ on {chain.chainDisplayName || "Cosmos"} to view
          it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...findCliqForm}>
          <form onSubmit={findCliqForm.handleSubmit(submitFindCliq)} className="space-y-6">
            <FormField
              control={findCliqForm.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CLIQ Address</FormLabel>
                  <FormControl>
                    <Input
                      variant="institutional"
                      placeholder={`E.g. "${exampleAddress(0, chain.addressPrefix)}"`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" variant="action" className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Open CLIQ
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default withRouter(FindCliqForm);
