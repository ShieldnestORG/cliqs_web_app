import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegistryAsset } from "@/types/chainRegistry";

export const CUSTOM_DENOM_VALUE = "__custom__";

function getDenomLabel(asset: RegistryAsset, allAssets: readonly RegistryAsset[]): string {
  const duplicateCount = allAssets.filter((a) => a.symbol === asset.symbol).length;

  if (duplicateCount > 1) {
    const baseDenom =
      asset.base.length > 24
        ? asset.base.slice(0, 12) + "\u2026" + asset.base.slice(-8)
        : asset.base;
    return `${asset.symbol} (${baseDenom})`;
  }

  return asset.symbol;
}

interface DenomSelectProps {
  readonly assets: readonly RegistryAsset[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
}

export function DenomSelect({ assets, value, onValueChange }: DenomSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select denom" />
      </SelectTrigger>
      <SelectContent>
        {assets.map((asset) => (
          <SelectItem key={asset.base} value={asset.base}>
            {getDenomLabel(asset, assets)}
          </SelectItem>
        ))}
        {assets.length > 0 && <SelectSeparator />}
        <SelectItem value={CUSTOM_DENOM_VALUE}>Custom (enter denom below)</SelectItem>
      </SelectContent>
    </Select>
  );
}
