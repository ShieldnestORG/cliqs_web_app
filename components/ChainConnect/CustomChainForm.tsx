import { useChains } from "@/context/ChainsContext";
import { setNewConnection } from "@/context/ChainsContext/helpers";
import { RegistryAsset } from "@/types/chainRegistry";
import { zodResolver } from "@hookform/resolvers/zod";
import { Coins, Globe, Hash, Image as ImageIcon, Link2, Server, Tag, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

const JsonEditor = dynamic(() => import("../inputs/JsonEditor"), { ssr: false });

export default function CustomChainForm() {
  const { chain, chains, newConnection, chainsDispatch } = useChains();
  const [showAssetsEditor, setShowAssetsEditor] = useState(false);

  useEffect(() => {
    // Unblock the main thread
    setTimeout(() => {
      setShowAssetsEditor(true);
    }, 0);
  }, []);

  const formSchema = z
    .object({
      localRegistryName: z
        .string({ required_error: "Local registry name is required" })
        .refine((val) => !chains.mainnets.has(val) && !chains.testnets.has(val), {
          message: "Name already exists in remote registry",
        }),
      chainName: z.string({ required_error: "Chain name is required" }),
      chainId: z.string({ required_error: "Chain ID is required" }),
      baseDenom: z.string({ required_error: "Base denom is required" }),
      displayDenom: z.string({ required_error: "Display denom is required" }),
      denomExponent: z.string({ required_error: "Denom exponent is required" }),
      bech32Prefix: z.string({ required_error: "Address prefix is required" }),
      gasPrice: z.string({ required_error: "Gas price is required" }),
      rpcNodes: z.string({ required_error: "Comma separated rpc nodes are required" }),
      explorerTxLink: z.string({ required_error: "Explorer tx url is required" }),
      explorerAccountLink: z.string({ required_error: "Explorer account url is required" }),
      logo: z.string({ required_error: "Logo url is required" }),
      assets: z.string({ required_error: "Assets json is required" }),
    })
    .required();

  const defaultChain = newConnection.chain ?? chain;
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      localRegistryName: defaultChain.registryName,
      chainName: defaultChain.chainDisplayName,
      chainId: defaultChain.chainId,
      baseDenom: defaultChain.denom,
      displayDenom: defaultChain.displayDenom,
      denomExponent: String(defaultChain.displayDenomExponent),
      bech32Prefix: defaultChain.addressPrefix,
      gasPrice: defaultChain.gasPrice,
      rpcNodes: defaultChain.nodeAddresses.join(", "),
      explorerTxLink: defaultChain.explorerLinks.tx,
      explorerAccountLink: defaultChain.explorerLinks.account,
      logo: defaultChain.logo,
      assets: JSON.stringify(defaultChain.assets),
    },
  });

  function onSubmit(chainFromForm: z.infer<typeof formSchema>) {
    const rpcNodes = chainFromForm.rpcNodes.split(", ");

    setNewConnection(chainsDispatch, {
      action: "confirm",
      chain: {
        registryName: chainFromForm.localRegistryName,
        logo: chainFromForm.logo,
        chainId: chainFromForm.chainId,
        chainDisplayName: chainFromForm.chainName,
        nodeAddress: "",
        nodeAddresses: rpcNodes,
        denom: chainFromForm.baseDenom,
        displayDenom: chainFromForm.displayDenom,
        displayDenomExponent: Number(chainFromForm.denomExponent),
        assets: JSON.parse(chainFromForm.assets) as RegistryAsset[],
        gasPrice: chainFromForm.gasPrice,
        addressPrefix: chainFromForm.bech32Prefix,
        explorerLinks: {
          tx: chainFromForm.explorerTxLink,
          account: chainFromForm.explorerAccountLink,
        },
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-label-comment text-[10px] text-label">Basic Information</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              name="localRegistryName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">
                    Local Registry Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="mynetwork"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[10px] text-muted-foreground">
                    Unique key for local storage
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              name="chainName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">Chain Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Network"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              name="chainId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">Chain ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="my-net-4"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Token Info Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="text-label-comment text-[10px] text-label">Token Configuration</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="baseDenom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">Base Denom</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="umycoin"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              name="displayDenom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">
                    Display Denom
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="MYCOIN"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              name="denomExponent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">Exponent</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="6"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              name="gasPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">Gas Price</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0.04umycoin"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Network Info Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-label-comment text-[10px] text-label">Network Settings</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              name="bech32Prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">
                    Address Prefix (Bech32)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="mynet"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <ImageIcon className="h-3 w-3" />
                    Logo URI
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://..."
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* RPC & Explorer Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-label-comment text-[10px] text-label">Endpoints & Explorer</span>
          </div>
          <FormField
            name="rpcNodes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-foreground">RPC Nodes</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://rpc1.example.com, https://rpc2.example.com"
                    className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-[10px] text-muted-foreground">
                  Comma-separated list of RPC endpoints
                </FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              name="explorerTxLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Link2 className="h-3 w-3" />
                    Explorer TX Link
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://explorer.example.com/tx/${txHash}"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[10px] text-muted-foreground">
                    Include {"${txHash}"} placeholder
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              name="explorerAccountLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Globe className="h-3 w-3" />
                    Explorer Account Link
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://explorer.example.com/account/${accountAddress}"
                      className="h-10 border-2 border-border bg-muted/30 font-mono text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-green))] focus:ring-2 focus:ring-[hsl(var(--accent-green)/0.2)]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[10px] text-muted-foreground">
                    Include {"${accountAddress}"} placeholder
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Assets JSON Section */}
        {showAssetsEditor && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-label-comment text-[10px] text-label">
                Assets Configuration
              </span>
            </div>
            <FormField
              name="assets"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">Assets JSON</FormLabel>
                  <FormControl>
                    <div className="overflow-hidden rounded-lg border-2 border-border">
                      <JsonEditor
                        content={{ text: field.value }}
                        onChange={(newMsgContent) => {
                          field.onChange(
                            "text" in newMsgContent ? (newMsgContent.text ?? "{}") : "{}",
                          );
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end border-t border-border pt-4">
          <Button variant="action" size="action" type="submit">
            Add Custom Chain
          </Button>
        </div>
      </form>
    </Form>
  );
}
