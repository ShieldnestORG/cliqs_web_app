import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MsgTypeUrl, MsgTypeUrls } from "@/types/txMsg";
import { Coins, Gavel, Globe, Send, TrendingUp, Users, Vote, Wallet, Settings } from "lucide-react";
import { useState } from "react";

interface TransactionType {
  typeUrl: MsgTypeUrl;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: "validator" | "standard";
}

const transactionTypes: TransactionType[] = [
  // Validator Commands
  {
    typeUrl: MsgTypeUrls.CreateValidator,
    name: "Create Validator",
    description: "Register as a validator",
    icon: <Gavel className="h-6 w-6" />,
    category: "validator",
  },
  {
    typeUrl: MsgTypeUrls.EditValidator,
    name: "Edit Validator",
    description: "Update validator info",
    icon: <Settings className="h-6 w-6" />,
    category: "validator",
  },
  {
    typeUrl: MsgTypeUrls.Delegate,
    name: "Delegate",
    description: "Stake tokens to validator",
    icon: <TrendingUp className="h-6 w-6" />,
    category: "standard",
  },
  {
    typeUrl: MsgTypeUrls.Delegate,
    name: "Delegate",
    description: "Stake tokens to validator",
    icon: <TrendingUp className="h-6 w-6" />,
    category: "validator",
  },
  {
    typeUrl: MsgTypeUrls.Undelegate,
    name: "Undelegate",
    description: "Unstake tokens from validator",
    icon: <TrendingUp className="h-6 w-6" />,
    category: "standard",
  },
  {
    typeUrl: MsgTypeUrls.Undelegate,
    name: "Undelegate",
    description: "Unstake tokens from validator",
    icon: <TrendingUp className="h-6 w-6" />,
    category: "validator",
  },
  {
    typeUrl: MsgTypeUrls.BeginRedelegate,
    name: "Redelegate",
    description: "Move stake between validators",
    icon: <TrendingUp className="h-6 w-6" />,
    category: "standard",
  },
  {
    typeUrl: MsgTypeUrls.BeginRedelegate,
    name: "Redelegate",
    description: "Move stake between validators",
    icon: <TrendingUp className="h-6 w-6" />,
    category: "validator",
  },
  {
    typeUrl: MsgTypeUrls.WithdrawDelegatorReward,
    name: "Withdraw Rewards",
    description: "Claim staking rewards",
    icon: <Coins className="h-6 w-6" />,
    category: "standard",
  },
  {
    typeUrl: MsgTypeUrls.WithdrawDelegatorReward,
    name: "Withdraw Rewards",
    description: "Claim staking rewards",
    icon: <Coins className="h-6 w-6" />,
    category: "validator",
  },
  {
    typeUrl: MsgTypeUrls.WithdrawValidatorCommission,
    name: "Withdraw Commission",
    description: "Claim validator commission",
    icon: <Coins className="h-6 w-6" />,
    category: "validator",
  },
  {
    typeUrl: MsgTypeUrls.FundCommunityPool,
    name: "Fund Community Pool",
    description: "Contribute to community pool",
    icon: <Wallet className="h-6 w-6" />,
    category: "standard",
  },
  {
    typeUrl: MsgTypeUrls.SetWithdrawAddress,
    name: "Set Withdraw Address",
    description: "Change reward withdrawal address",
    icon: <Wallet className="h-6 w-6" />,
    category: "validator",
  },
  // Standard User Commands
  {
    typeUrl: MsgTypeUrls.Send,
    name: "Send",
    description: "Transfer tokens to address",
    icon: <Send className="h-6 w-6" />,
    category: "standard",
  },
  {
    typeUrl: MsgTypeUrls.Transfer,
    name: "IBC Transfer",
    description: "Transfer tokens across chains",
    icon: <Globe className="h-6 w-6" />,
    category: "standard",
  },
  {
    typeUrl: MsgTypeUrls.Vote,
    name: "Vote",
    description: "Vote on governance proposals",
    icon: <Vote className="h-6 w-6" />,
    category: "standard",
  },
  {
    typeUrl: MsgTypeUrls.Vote,
    name: "Vote",
    description: "Vote on governance proposals",
    icon: <Vote className="h-6 w-6" />,
    category: "validator",
  },
  {
    typeUrl: MsgTypeUrls.CreateVestingAccount,
    name: "Create Vesting Account",
    description: "Create time-locked account",
    icon: <Users className="h-6 w-6" />,
    category: "standard",
  },
];

interface TransactionTypeSelectorProps {
  onSelect: (typeUrl: MsgTypeUrl) => void;
  disabled?: (typeUrl: MsgTypeUrl) => boolean;
}

export default function TransactionTypeSelector({
  onSelect,
  disabled,
}: TransactionTypeSelectorProps) {
  const [activeTab, setActiveTab] = useState("standard");

  const validatorCommands = transactionTypes.filter((t) => t.category === "validator");
  const standardCommands = transactionTypes.filter((t) => t.category === "standard");

  const _renderCommands = (
    commands: TransactionType[],
    variant: "default" | "highlight" | "accent" | "muted" = "default",
  ) => (
    <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {commands.map((tx) => {
        const isDisabled = disabled?.(tx.typeUrl) ?? false;
        return (
          <BentoCard
            key={tx.typeUrl}
            variant={variant}
            interactive={!isDisabled}
            onClick={() => !isDisabled && onSelect(tx.typeUrl)}
            className={cn(isDisabled ? "cursor-not-allowed opacity-50" : "", "min-h-0 p-4")}
          >
            <div className="flex h-full flex-col">
              <div className="mb-2 flex items-center gap-2">
                {tx.icon}
                <h4 className="font-heading text-sm font-semibold leading-tight">{tx.name}</h4>
              </div>
              <p className="text-xs leading-tight text-muted-foreground">{tx.description}</p>
            </div>
          </BentoCard>
        );
      })}
    </BentoGrid>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mb-6 grid h-auto w-full grid-cols-2 rounded-lg bg-muted/50 p-1">
        <TabsTrigger
          value="standard"
          className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <Users className="h-4 w-4" />
          <span>Standard User Commands</span>
        </TabsTrigger>
        <TabsTrigger
          value="validator"
          className="gap-2 px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          <Gavel className="h-4 w-4" />
          <span>Validator Commands</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="standard" className="mt-0 space-y-8">
        {/* Staking & Governance Section */}
        <div>
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">{`// Staking & Governance`}</h3>
          <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {standardCommands
              .filter((cmd) =>
                ["Delegate", "Redelegate", "Undelegate", "Withdraw Rewards", "Vote"].includes(
                  cmd.name,
                ),
              )
              .map((tx) => {
                const isDisabled = disabled?.(tx.typeUrl) ?? false;
                return (
                  <BentoCard
                    key={tx.typeUrl}
                    variant="default"
                    interactive={!isDisabled}
                    onClick={() => !isDisabled && onSelect(tx.typeUrl)}
                    className={cn(isDisabled ? "cursor-not-allowed opacity-50" : "", "min-h-0 p-4")}
                  >
                    <div className="flex h-full flex-col">
                      <div className="mb-2 flex items-center gap-2">
                        {tx.icon}
                        <h4 className="font-heading text-sm font-semibold leading-tight">
                          {tx.name}
                        </h4>
                      </div>
                      <p className="text-xs leading-tight text-muted-foreground">
                        {tx.description}
                      </p>
                    </div>
                  </BentoCard>
                );
              })}
          </BentoGrid>
        </div>

        {/* Transfer Section */}
        <div>
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">{`// Transfers`}</h3>
          <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {standardCommands
              .filter((cmd) => ["IBC Transfer", "Send"].includes(cmd.name))
              .map((tx) => {
                const isDisabled = disabled?.(tx.typeUrl) ?? false;
                return (
                  <BentoCard
                    key={tx.typeUrl}
                    variant="default"
                    interactive={!isDisabled}
                    onClick={() => !isDisabled && onSelect(tx.typeUrl)}
                    className={cn(isDisabled ? "cursor-not-allowed opacity-50" : "", "min-h-0 p-4")}
                  >
                    <div className="flex h-full flex-col">
                      <div className="mb-2 flex items-center gap-2">
                        {tx.icon}
                        <h4 className="font-heading text-sm font-semibold leading-tight">
                          {tx.name}
                        </h4>
                      </div>
                      <p className="text-xs leading-tight text-muted-foreground">
                        {tx.description}
                      </p>
                    </div>
                  </BentoCard>
                );
              })}
          </BentoGrid>
        </div>

        {/* Advanced Section */}
        <div>
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">{`// Advanced`}</h3>
          <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {standardCommands
              .filter((cmd) => ["Create Vesting Account", "Fund Community Pool"].includes(cmd.name))
              .map((tx) => {
                const isDisabled = disabled?.(tx.typeUrl) ?? false;
                return (
                  <BentoCard
                    key={tx.typeUrl}
                    variant="muted"
                    interactive={!isDisabled}
                    onClick={() => !isDisabled && onSelect(tx.typeUrl)}
                    className={cn(isDisabled ? "cursor-not-allowed opacity-50" : "", "min-h-0 p-4")}
                  >
                    <div className="flex h-full flex-col">
                      <div className="mb-2 flex items-center gap-2">
                        {tx.icon}
                        <h4 className="font-heading text-sm font-semibold leading-tight">
                          {tx.name}
                        </h4>
                      </div>
                      <p className="text-xs leading-tight text-muted-foreground">
                        {tx.description}
                      </p>
                    </div>
                  </BentoCard>
                );
              })}
          </BentoGrid>
        </div>
      </TabsContent>

      <TabsContent value="validator" className="mt-0 space-y-8">
        {/* Staking & Governance Section */}
        <div>
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">{`// Staking & Governance`}</h3>
          <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {validatorCommands
              .filter((cmd) =>
                ["Delegate", "Redelegate", "Undelegate", "Withdraw Rewards", "Vote"].includes(
                  cmd.name,
                ),
              )
              .map((tx) => {
                const isDisabled = disabled?.(tx.typeUrl) ?? false;
                return (
                  <BentoCard
                    key={`${tx.typeUrl}-${tx.category}`}
                    variant="highlight"
                    interactive={!isDisabled}
                    onClick={() => !isDisabled && onSelect(tx.typeUrl)}
                    className={cn(isDisabled ? "cursor-not-allowed opacity-50" : "", "min-h-0 p-4")}
                  >
                    <div className="flex h-full flex-col">
                      <div className="mb-2 flex items-center gap-2">
                        {tx.icon}
                        <h4 className="font-heading text-sm font-semibold leading-tight">
                          {tx.name}
                        </h4>
                      </div>
                      <p className="text-xs leading-tight text-muted-foreground">
                        {tx.description}
                      </p>
                    </div>
                  </BentoCard>
                );
              })}
          </BentoGrid>
        </div>

        {/* Validator Management Section */}
        <div>
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">{`// Validator Management`}</h3>
          <BentoGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {validatorCommands
              .filter(
                (cmd) =>
                  !["Delegate", "Redelegate", "Undelegate", "Withdraw Rewards", "Vote"].includes(
                    cmd.name,
                  ),
              )
              .map((tx) => {
                const isDisabled = disabled?.(tx.typeUrl) ?? false;
                return (
                  <BentoCard
                    key={`${tx.typeUrl}-${tx.category}`}
                    variant="highlight"
                    interactive={!isDisabled}
                    onClick={() => !isDisabled && onSelect(tx.typeUrl)}
                    className={cn(isDisabled ? "cursor-not-allowed opacity-50" : "", "min-h-0 p-4")}
                  >
                    <div className="flex h-full flex-col">
                      <div className="mb-2 flex items-center gap-2">
                        {tx.icon}
                        <h4 className="font-heading text-sm font-semibold leading-tight">
                          {tx.name}
                        </h4>
                      </div>
                      <p className="text-xs leading-tight text-muted-foreground">
                        {tx.description}
                      </p>
                    </div>
                  </BentoCard>
                );
              })}
          </BentoGrid>
        </div>
      </TabsContent>
    </Tabs>
  );
}
