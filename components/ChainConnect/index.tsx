import { useChains } from "@/context/ChainsContext";
import { setNewConnection } from "@/context/ChainsContext/helpers";
import { Network } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList } from "../ui/tabs";
import ChooseChain from "./ChooseChain";
import ConfirmConnection from "./ConfirmConnection";
import CustomChainForm from "./CustomChainForm";
import DialogButton from "./DialogButton";
import TabButton from "./TabButton";

const tabs = { choose: "choose", custom: "custom" };

export default function ChainConnect() {
  const { newConnection, chainsDispatch } = useChains();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        setNewConnection(chainsDispatch, { action: "edit" });
      }}
    >
      <DialogButton />
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[85vh] max-w-4xl flex-col overflow-hidden border-2 border-border bg-card p-0"
        style={newConnection.action === "confirm" ? { maxWidth: "fit-content", height: "auto" } : {}}
      >
        <DialogTitle className="sr-only">Connect to a new chain</DialogTitle>
        {newConnection.action === "confirm" ? (
          <div className="p-6">
            <ConfirmConnection closeDialog={() => setDialogOpen(false)} />
          </div>
        ) : (
          <Tabs defaultValue={newConnection.chain ? tabs.custom : tabs.choose} className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="flex-shrink-0 border-b border-border bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="icon-container h-10 w-10 rounded-lg">
                  <Network className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-label text-label-comment text-[10px]">Select Network</span>
                  <span className="font-heading text-lg font-semibold text-foreground">
                    Connect to Blockchain
                  </span>
                </div>
              </div>
              <TabsList className="mt-4 justify-start gap-3 bg-transparent p-0">
                <TabButton value={tabs.choose}>Choose chain</TabButton>
                <TabButton value={tabs.custom}>Custom chain</TabButton>
              </TabsList>
            </DialogHeader>
            <TabsContent value={tabs.choose} className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
              <ChooseChain />
            </TabsContent>
            <TabsContent value={tabs.custom} className="mt-0 min-h-0 flex-1 overflow-y-auto p-6">
              <CustomChainForm />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
