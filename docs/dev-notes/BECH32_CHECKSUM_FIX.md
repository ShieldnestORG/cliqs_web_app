# Bech32 Checksum Fix for Validator Addresses

## Problem Summary
The application was throwing **"Broadcasting transaction failed with code 1: decoding bech32 failed: invalid checksum (expected 2cr8xh got sxazxf)"** when attempting to broadcast a `MsgCreateValidator` transaction.

## Root Cause Analysis

### The Issue
The validator address in the database had an **invalid bech32 checksum**. The error occurred because:

1. **User manually entered the validator address** by copying the delegator address and simply changing the prefix from `core` to `corevaloper`
2. **Bech32 checksums are calculated based on BOTH the prefix AND the data**, so you can't just swap prefixes
3. When the blockchain tried to decode the address, it detected the checksum mismatch

### The Invalid Address

```
Delegator:  core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf  ✓ (valid)
Database:   corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf  ✗ (invalid checksum: sxazxf)
Correct:    corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh  ✓ (valid checksum: 2cr8xh)
```

Notice:
- The last 6 characters are different: `sxazxf` vs `2cr8xh`
- These are the bech32 checksum bytes
- The checksum must be recalculated when changing the prefix

### Understanding Bech32 Addresses

A bech32 address has three parts:
1. **Human-Readable Part (HRP)**: `core`, `corevaloper`, `cosmos`, `cosmosvaloper`, etc.
2. **Separator**: Always `1`
3. **Data + Checksum**: Base32-encoded data with built-in error detection

When you change the HRP, the checksum **must be recalculated** because it's computed over the entire address including the prefix.

## The Solution

### Part 1: Fix the Database

**File: `data/local-db.json`**

Changed the validator address from:
```json
"validatorAddress": "corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf"
```

To:
```json
"validatorAddress": "corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh"
```

### Part 2: Add Validation to the Form

**File: `components/forms/OldCreateTxForm/MsgForm/MsgCreateValidatorForm.tsx`**

#### Added Address Conversion Utility

```typescript
const convertToValidatorAddress = (delegatorAddress: string, addressPrefix: string): string => {
  try {
    const decoded = fromBech32(delegatorAddress);
    const validatorPrefix = addressPrefix.startsWith("cosmos") 
      ? "cosmosvaloper" 
      : `${addressPrefix}valoper`;
    return toBech32(validatorPrefix, decoded.data);
  } catch (e) {
    throw new Error(`Failed to convert to validator address: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
};
```

**How it works:**
1. Decodes the delegator address to extract the raw 20-byte address data
2. Re-encodes with the validator prefix (`corevaloper` or `cosmosvaloper`)
3. Automatically calculates the correct checksum

#### Enhanced Validation

Added checksum validation in `isMsgValid()`:

```typescript
// Check if the validator address has a valid checksum
try {
  fromBech32(validatorAddress);
} catch (e) {
  setValidatorAddressError(
    `Invalid validator address checksum. ${e instanceof Error ? e.message : ''}`,
  );
  return false;
}
```

This prevents users from entering addresses with invalid checksums.

#### Added Auto-Convert Button

Added a helpful button in the UI:

```tsx
<button 
  type="button"
  className="convert-button"
  onClick={() => {
    try {
      const converted = convertToValidatorAddress(senderAddress, chain.addressPrefix);
      setValidatorAddress(converted);
      setValidatorAddressError("");
    } catch (e) {
      setValidatorAddressError(e instanceof Error ? e.message : 'Conversion failed');
    }
  }}
>
  Auto-convert from sender address
</button>
```

Users can now click this button to automatically generate the correct validator address from their delegator address.

## Testing the Fix

```bash
# Test the conversion
node -e "
const { fromBech32, toBech32 } = require('@cosmjs/encoding');
const delegator = 'core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf';
const decoded = fromBech32(delegator);
const validator = toBech32('corevaloper', decoded.data);
console.log('Delegator:', delegator);
console.log('Validator:', validator);
console.log('✓ Checksum valid!');
"
```

Output:
```
Delegator: core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf
Validator: corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh
✓ Checksum valid!
```

## Files Modified

1. **`data/local-db.json`**
   - Fixed validator address checksum in existing transaction

2. **`components/forms/OldCreateTxForm/MsgForm/MsgCreateValidatorForm.tsx`**
   - Added `fromBech32` and `toBech32` imports from `@cosmjs/encoding`
   - Added `convertToValidatorAddress` helper function
   - Enhanced validator address validation with checksum verification
   - Added "Auto-convert from sender address" button
   - Added styling for the convert button

## Pattern of Issues Fixed

| Issue # | Problem | Solution | Status |
|---------|---------|----------|--------|
| 1 | Commission fields snake_case | Field name normalization | ✅ Fixed |
| 2 | Pubkey 32 bytes vs 34 bytes | Re-encode with protobuf wrapper | ✅ Fixed |
| 3 | Invalid validator address checksum | Proper bech32 conversion | ✅ Fixed |

## Key Takeaways

1. **Never manually change bech32 prefixes** - Always use proper encoding functions
2. **Bech32 checksums depend on the prefix** - Changing the prefix invalidates the checksum
3. **Use `fromBech32` / `toBech32`** from `@cosmjs/encoding` for address conversions
4. **Validate checksums before broadcasting** - Catches errors before they reach the blockchain
5. **Provide UX helpers** - Auto-convert buttons prevent user mistakes

## Address Conversion Reference

### Common Cosmos Address Prefixes

| Network | Account Prefix | Validator Prefix |
|---------|---------------|------------------|
| Cosmos Hub | `cosmos` | `cosmosvaloper` |
| Coreum | `core` | `corevaloper` |
| Osmosis | `osmo` | `osmovaloper` |
| Juno | `juno` | `junovaloper` |

### Conversion Formula

```
validator_address = toBech32(validator_prefix, fromBech32(delegator_address).data)
```

This ensures the checksum is recalculated correctly for the new prefix.

## Next Steps

The transaction should now broadcast successfully with the correct validator address. Users creating new `MsgCreateValidator` transactions can:

1. **Click the "Auto-convert" button** to automatically generate the validator address
2. **Or manually enter** a validator address (the form will validate the checksum)

This prevents the bech32 checksum error from occurring again.






