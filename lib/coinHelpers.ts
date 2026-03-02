import { Decimal } from "@cosmjs/math";
import { Coin } from "@cosmjs/stargate";
import { assert } from "@cosmjs/utils";
import { RegistryAsset } from "../types/chainRegistry";

const displayCoinToBaseCoin = (displayCoin: Coin, assets: readonly RegistryAsset[]): Coin => {
  const lowerCaseDenom = displayCoin.denom.toLowerCase();

  const asset = assets.find(
    (currentAsset) =>
      lowerCaseDenom === currentAsset.symbol.toLowerCase() ||
      lowerCaseDenom === currentAsset.display.toLowerCase() ||
      lowerCaseDenom === currentAsset.name.toLowerCase() ||
      lowerCaseDenom === currentAsset.base.toLowerCase() ||
      currentAsset.denom_units.find(
        (unit) => unit.denom === lowerCaseDenom || unit.aliases?.includes(lowerCaseDenom),
      ),
  );

  // Leave IBC coins as is if not found on registry assets
  if (!asset && displayCoin.denom.toLowerCase().startsWith("ibc/")) {
    return displayCoin;
  }

  assert(asset, `An asset with the given symbol ${displayCoin.denom} was not found`);

  let macroUnit = asset.denom_units.find(
    (currentUnit) => lowerCaseDenom === currentUnit.denom.toLowerCase(),
  );

  // Fallback 1: Check aliases
  if (!macroUnit) {
    macroUnit = asset.denom_units.find((currentUnit) =>
      currentUnit.aliases?.some((alias) => alias.toLowerCase() === lowerCaseDenom),
    );
  }

  // Fallback 2: Check if lowerCaseDenom matches asset.display or asset.symbol,
  // and find the unit that matches asset.display
  if (
    !macroUnit &&
    (lowerCaseDenom === asset.display.toLowerCase() ||
      lowerCaseDenom === asset.symbol.toLowerCase())
  ) {
    macroUnit = asset.denom_units.find(
      (currentUnit) => currentUnit.denom.toLowerCase() === asset.display.toLowerCase(),
    );
  }

  // Fallback 3: If still not found and it matches symbol/display, try finding largest exponent unit
  if (
    !macroUnit &&
    (lowerCaseDenom === asset.display.toLowerCase() ||
      lowerCaseDenom === asset.symbol.toLowerCase())
  ) {
    macroUnit = asset.denom_units.reduce((prev, current) =>
      prev.exponent > current.exponent ? prev : current,
    );
  }

  assert(macroUnit, `A unit with the given symbol ${lowerCaseDenom} was not found`);

  const baseUnit = asset.denom_units.find((currentUnit) => currentUnit.exponent === 0);
  assert(baseUnit, `A base unit with exponent = 0 was not found`);

  const trimmedAmount = displayCoin.amount.trim() || "0";
  const decimalResult = Decimal.fromUserInput(trimmedAmount, macroUnit.exponent);

  const denom = baseUnit.denom;
  const amount = decimalResult.atomics;

  return { denom, amount };
};

export { displayCoinToBaseCoin };
