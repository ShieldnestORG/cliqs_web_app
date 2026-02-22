# MsgWithdrawValidatorCommission Debugging Summary

## Problem Statement
`MsgWithdrawValidatorCommission` transactions fail with "signature verification failed" error despite:
- All local signature verifications passing ✅
- Transaction simulation succeeding ✅
- `MsgWithdrawDelegatorReward` working correctly ✅

## Key Facts Established

### Working Transaction Types
- `MsgSend` - ✅ Works (tx hash: 2F046CC713981932602D00C397985D125CEB8E29839FD4954F17D681069C1547)
- `MsgCreateValidator` - ✅ Works (tx hash: 3B87BCD7FC76E9F3B52FB5170200C17CA9A531E446A53F962802F37E7BCD81FB)
- `MsgDelegate` - ✅ Works (tx hash: 616C14E196E002D04BF6D760F86674E41B9B39B9D5E0D9C71221FFF3B4EE8D3F)
- `MsgWithdrawDelegatorReward` - ✅ Works (tx hash: C5966A3545834667D3C97087600E83BA4C37537643B8F5909E250B5C51B62ED0)

### Failing Transaction Type
- `MsgWithdrawValidatorCommission` (standalone) - ❌ Fails
- `MsgWithdrawValidatorCommission` (bundled with MsgWithdrawDelegatorReward) - ❌ Also fails

### Multisig Details
- Address: `core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf`
- Validator Operator: `corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh` (same underlying key)
- Threshold: 3-of-3
- Account Number: 31625
- Current On-Chain Sequence: 5

---

## Debugging Attempts

### 1. Chain ID Fix ✅ (Partial Fix)
**Problem:** `TransactionSigning.tsx` was using `chain.chainId` from context instead of `props.tx.chainId`
**Fix:** Changed to use `props.tx.chainId` for `signerData`
**Result:** Fixed a bug, but `MsgWithdrawValidatorCommission` still fails

### 2. Re-rendering Fix ✅
**Problem:** Infinite re-render loop in `TransactionPage`
**Fix:** Memoized `txInfo` using `useMemo`
**Result:** Fixed performance issue

### 3. Address Prefix Investigation ✅
**Finding:** `@cosmjs/stargate` v0.35.0 handles address prefixes automatically
**Result:** No code change needed; prefixes are handled correctly

### 4. Protobuf Encoding Verification ✅
**Finding:** The bodyBytes encoding is identical between our app and direct protobuf encoding
```
Our bodyBytes:      CnMKOy9jb3Ntb3MuZGlzdHJpYnV0aW9uLnYxYmV0YTEuTXNnV2l0aGRyYXdWYWxpZGF0b3JDb21taXNzaW9uEjQKMmNvcmV2YWxvcGVyMTRybWN6ZjZ0NnFsZHlycXJ2NGpkMHp6eXBrdXltcmh2MmNyOHho
Expected bodyBytes: CnMKOy9jb3Ntb3MuZGlzdHJpYnV0aW9uLnYxYmV0YTEuTXNnV2l0aGRyYXdWYWxpZGF0b3JDb21taXNzaW9uEjQKMmNvcmV2YWxvcGVyMTRybWN6ZjZ0NnFsZHlycXJ2NGpkMHp6eXBrdXltcmh2MmNyOHho
Match: ✅ YES
```

### 5. Amino Type Verification ✅
**Finding:** Correct Amino types are being used:
- `MsgWithdrawDelegatorReward` → `cosmos-sdk/MsgWithdrawDelegationReward` (note: "Delegation" not "Delegator")
- `MsgWithdrawValidatorCommission` → `cosmos-sdk/MsgWithdrawValidatorCommission`

### 6. Signature Verification (Local) ❌ **CRITICAL FINDING**
**UPDATED Finding (Dec 12, 2025):** Signatures are **INVALID** against the broadcast-time computed SignDoc hash!
```
📜 BROADCAST SignDoc Analysis
SignDoc Hash: mA0lpbuRyd7orcYKuP/L6Rm67JlXum2fben+i/6MYYY=

🔍 BROADCAST DEBUG: Verifying signatures against expected hash:
  - sig[0] (core1mgvlgvh2hfw5pgdqc79up3du69v2z3t8qz4kwg): ❌ INVALID
  - sig[1] (core1ltltw0jya4hq39myd9798qqvu6jzy6zxalxhqu): ❌ INVALID
  - sig[2] (core1jcas459gnu857ylephjdjlea3rkr38m0asj6gw): ❌ INVALID
```

**ROOT CAUSE IDENTIFIED:** The SignDoc used during signing is DIFFERENT from the SignDoc being verified at broadcast time!

This means there's a mismatch in how messages are constructed between:
1. When the transaction is CREATED (and stored in DB)
2. When the transaction is SIGNED
3. When the transaction is BROADCAST (and verified)

### 7. Simulation vs Broadcast ✅
**Critical Finding:**
- Simulation: ✅ PASSES (returns gas_used, events, msg_responses)
- Broadcast: ❌ FAILS with "signature verification failed"

This proves simulation does NOT verify signatures!

### 8. Bundled Transaction Attempt ❌
**Attempt:** Created transaction with both messages like CLI does:
1. `MsgWithdrawDelegatorReward`
2. `MsgWithdrawValidatorCommission`

**Result:** Still fails with same error

### 9. CLI Command Discovery
**Finding:** Coreum CLI has `withdraw-commission` as a separate command:
```sh
cored tx distribution withdraw-commission [validator-operator-address] --from [account]
```

**NOT YET TESTED:** This CLI command might construct the message differently!

---

## 🎯 ROOT CAUSE CONFIRMED & FIXED (Dec 12, 2025)

### **The Issue: SIGN_MODE_DIRECT vs SIGN_MODE_LEGACY_AMINO_JSON**

Analysis of successful Coreum validator transactions revealed:

```json
"mode_info": {
  "single": { "mode": "SIGN_MODE_DIRECT" }
}
```

**Coreum validators use `SIGN_MODE_DIRECT`**, but our app was using `SIGN_MODE_LEGACY_AMINO_JSON`!

### Key Finding:
Even when local Amino signature verification passes, the chain rejects because:
1. We send the transaction with `SIGN_MODE_LEGACY_AMINO_JSON` in the AuthInfo
2. The chain verifies signatures using its own Amino SignDoc reconstruction
3. Coreum's reconstruction differs from @cosmjs (possibly different canonical encoding)

### Solution Implemented:

#### New Files:
- `lib/multisigDirect.ts` - Direct mode multisig support:
  - `makeDirectModeAuthInfo()` - Pre-constructs AuthInfo with SIGN_MODE_DIRECT
  - `makeDirectSignDoc()` - Creates Direct SignDoc for multisig
  - `makeMultisignedTxBytesDirect()` - Assembles transaction with Direct mode
  - `shouldUseDirectMode()` - Auto-detects when Direct mode is needed

#### Modified Files:
- `TransactionSigning.tsx`:
  - Added proper Direct mode signing for multisig
  - Each signer signs the MULTISIG's Direct SignDoc (not their own)
  - Uses Keplr's `signDirect()` API directly

- `[transactionID].tsx`:
  - Auto-detects MsgWithdrawValidatorCommission transactions
  - Uses `makeMultisignedTxBytesDirect()` for assembly

### How It Works:
1. **Signing**: Each signer signs the multisig's Direct SignDoc:
   - SignDoc = { bodyBytes, authInfoBytes, chainId, accountNumber }
   - authInfoBytes contains the MULTISIG pubkey (not individual signer's)
   
2. **Broadcast**: Transaction is assembled with SIGN_MODE_DIRECT:
   - All mode_infos use `SignMode.SIGN_MODE_DIRECT`
   - Chain verifies Direct signatures correctly

### Usage:
1. Create a MsgWithdrawValidatorCommission transaction
2. Select "Direct Mode" for signing (shown automatically for this message type)
3. **ALL signers must use Direct mode** (don't mix with Amino)
4. Broadcast - transaction should succeed!

---

## ✅ VERIFIED WORKING (Dec 12, 2025)

**Transaction Hash:** `60EF50BBACC0402DEA38C30AA111549AC947D99CAB26360D0632EDC56C37FCBF`

The fix has been verified! MsgWithdrawValidatorCommission now works correctly with:
- SIGN_MODE_DIRECT for all signers
- Direct SignDoc: bodyBytes + authInfoBytes (with multisig pubkey) + chainId + accountNumber
- Transaction code: 0 (SUCCESS)

View on explorer: https://explorer.coreum.com/coreum/transactions/60EF50BBACC0402DEA38C30AA111549AC947D99CAB26360D0632EDC56C37FCBF

---

## Old Key Discrepancy (Superseded)

**The chain is reconstructing a different SignDoc during broadcast than what we signed.**

Despite:
- Matching bodyBytes ✅
- Matching Amino types ✅  
- Matching fee, gas, memo, sequence, account_number, chain_id ✅
- Valid local signature verification ✅ **← This was WRONG! Signatures are INVALID at broadcast time**
- Successful simulation ✅

The broadcast still fails. This suggests the chain has a different canonical Amino encoding for `MsgWithdrawValidatorCommission`.

---

## What Hasn't Been Tried

### 1. CLI-Generated Transaction Comparison
Use the CLI to generate an unsigned transaction and compare its exact structure:
```sh
cored tx distribution withdraw-commission corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh \
  --from core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf \
  --generate-only \
  --offline \
  --account-number 31625 \
  --sequence 5 \
  --fees 37500ucore \
  --gas 600000 \
  -o json
```

**Issue:** CLI doesn't have standalone `withdraw-commission` command. Only `withdraw-rewards --commission`.

### 2. Check Coreum's Custom Amino Registration
Coreum might have custom Amino type registration that differs from standard Cosmos SDK.

### 3. Compare SignDoc Byte-by-Byte
Capture the exact bytes being signed by Keplr vs what the chain expects.

### 4. Check Coreum Source Code
Look at Coreum's distribution module to see if they have custom GetSignBytes or signer logic.

---

## Transactions in Database

| ID | Type | Sequence | Status | Result |
|----|------|----------|--------|--------|
| 1763980134472-u6hqirgon | MsgSend | 0 | broadcast | ✅ Success |
| 1763990755547-2qn9ktei3 | MsgCreateValidator | 1 | broadcast | ✅ Success |
| 1764741970805-hjz539ozp | MsgDelegate | 2 | broadcast | ✅ Success |
| 1765064950937-jo6e31ofj | MsgWithdrawValidatorCommission | 3 | cancelled | ❌ Failed |
| 1765280538519-cjaoyyqiz | MsgWithdrawValidatorCommission | 3 | cancelled | ❌ Failed |
| 1765529975621-wwbty1m1n | MsgWithdrawDelegatorReward | 3 | broadcast | ✅ Success |
| 1765530993910-8xsbma9es | MsgWithdrawValidatorCommission | 4 | cancelled | ❌ Failed |
| 1765532799008-wf0o6ju9i | MsgWithdrawValidatorCommission | 4 | cancelled | ❌ Failed |
| 1765533796444-ptdt8whj6 | MsgWithdrawValidatorCommission | 4 | cancelled | ❌ Failed |
| 1765538835806-zsfiwmron | MsgWithdrawDelegatorReward | 4 | broadcast | ✅ Success |
| 1765539445115-a69m2vj25 | MsgWithdrawValidatorCommission | 5 | cancelled | ❌ Failed |
| 1765539976773-b42giugxf | Bundled (both msgs) | 5 | pending | ❌ Failed |

---

## Current Hypothesis

The Coreum chain might have a custom implementation or different canonical encoding for `MsgWithdrawValidatorCommission` that differs from the standard `@cosmjs` library encoding.

The fact that:
1. Simulation passes (no sig check)
2. Local sig verification passes (using @cosmjs)
3. Broadcast fails (chain's sig check)

Strongly suggests the chain reconstructs a different SignDoc than what we sign.

---

## Additional Verification (All Passed)

### AccountNumber/Sequence Type Variations
All produce the same SignDoc hash - no type issues:
```
Variant 0: accNum=string, seq=string -> Hash: mA0lpbuRyd7orcYKuP/L6Rm67JlXum2fben+i/6MYYY=
Variant 1: accNum=number, seq=number -> Hash: mA0lpbuRyd7orcYKuP/L6Rm67JlXum2fben+i/6MYYY=
```

### SignDoc Serialization
Correctly serialized with alphabetical key ordering:
```json
{"account_number":"31625","chain_id":"coreum-mainnet-1","fee":{"amount":[{"amount":"68750","denom":"ucore"}],"gas":"1100000"},"memo":"","msgs":[{"type":"cosmos-sdk/MsgWithdrawDelegationReward","value":{"delegator_address":"core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf","validator_address":"corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh"}},{"type":"cosmos-sdk/MsgWithdrawValidatorCommission","value":{"validator_address":"corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh"}}],"sequence":"5"}
```

### TxBody Verification
- memo: "" ✅
- timeoutHeight: 0 ✅
- extensionOptions: 0 ✅
- messages: 2 ✅

### Multisig Signature Structure
- bitarray: 0xe0 (all 3 signers) ✅
- modeInfos: 3x SIGN_MODE_LEGACY_AMINO_JSON (127) ✅
- 3 signatures, each 64 bytes ✅

### CLI Commands Available
```
cored tx distribution --help
Available Commands:
  fund-community-pool  
  set-withdraw-addr    
  withdraw-all-rewards 
  withdraw-rewards     (with optional --commission flag)
```

**NOTE:** There is NO standalone `withdraw-commission` command! The only way is `withdraw-rewards --commission` which bundles both messages.

---

## Attempted Broadcast via REST API

Direct broadcast of bundled tx bytes via REST API also fails:
```json
{
  "tx_response": {
    "txhash": "907F0E9B1FBFC69EF6CD412293E26F472DDCB0E7EE41F5DA344D97F4E252C559",
    "codespace": "sdk",
    "code": 4,
    "raw_log": "signature verification failed; please verify account number (31625), sequence (5) and chain-id (coreum-mainnet-1): unauthorized"
  }
}
```

But simulation of the SAME tx bytes succeeds:
```json
{
  "gas_info": { "gas_wanted": "18446744073709551615", "gas_used": "166000" },
  "result": {
    "msg_responses": [
      { "@type": "...MsgWithdrawDelegatorRewardResponse", "amount": [{ "denom": "ucore", "amount": "501351" }] },
      { "@type": "...MsgWithdrawValidatorCommissionResponse", "amount": [{ "denom": "ucore", "amount": "21611092278" }] }
    ]
  }
}
```

---

## Root Cause Hypothesis

The chain is reconstructing a different SignDoc for signature verification than what we're signing. Despite:
1. Identical protobuf encoding ✅
2. Identical Amino type strings ✅
3. Correct alphabetical key ordering ✅
4. Valid local signature verification ✅
5. Successful simulation ✅

Something about how Coreum's chain verifies `MsgWithdrawValidatorCommission` signatures differs from `@cosmjs` library behavior.

---

## CLI Comparison (Verified Identical)

Generated unsigned tx via CLI:
```bash
cored tx distribution withdraw-rewards corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh \
  --commission \
  --from core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf \
  --fees 68750ucore \
  --gas 1100000 \
  --generate-only
```

**Result:** CLI body is IDENTICAL to our body:
- Same message count: ✅
- Same msg 0 type: ✅ (`/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward`)
- Same msg 1 type: ✅ (`/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission`)
- Same memo: ✅
- Same timeout: ✅

---

## Summary

**Everything we've verified is CORRECT:**
1. Transaction structure matches CLI ✅
2. Protobuf encoding is correct ✅
3. Amino type names are correct ✅
4. Signatures verify locally ✅
5. Simulation passes ✅
6. Account number, sequence, chain-id all match ✅

**But broadcast still fails.** The only unexplained difference is between how our local signature verification works vs. how the chain verifies signatures.

---

## Possible Root Causes

1. **@cosmjs version difference** - Maybe there's a subtle encoding difference in newer/older versions
2. **Coreum-specific signature verification** - Coreum might have custom verification logic
3. **WASM module interference** - The `createWasmAminoConverters()` might be adding something unexpected
4. **Timing issue** - Sequence might have changed between signing and broadcast

---

## FIX APPLIED

Modified the `MsgWithdrawValidatorCommissionForm` to bundle BOTH messages like the CLI does:

**Files Changed:**
1. `components/forms/OldCreateTxForm/index.tsx`
   - Updated `MsgGetter` interface to support `msg: EncodeObject | EncodeObject[]`
   - Updated message collection to flatten arrays with `flatMap`

2. `components/forms/OldCreateTxForm/MsgForm/MsgWithdrawValidatorCommissionForm.tsx`
   - Now creates TWO messages: `MsgWithdrawDelegatorReward` + `MsgWithdrawValidatorCommission`
   - Matches CLI behavior with `--commission` flag

3. `lib/txMsgHelpers.ts`
   - Updated gas for `WithdrawValidatorCommission` to 1,000,000 (accounts for both messages)

**Testing Required:**
1. Create a new "Withdraw Validator Commission" transaction
2. Sign with all 3 signers
3. Broadcast and verify success

---

## NEW DIAGNOSTIC TOOLS ADDED

### 1. Enhanced SignDoc Debug Utilities (`lib/signDocDebug.ts`)

New utility functions for comprehensive SignDoc analysis:

```typescript
import { 
  generateSignDocDebugInfo, 
  logSignDocDebug, 
  verifySignatureAgainstSignDoc,
  compareSignDocs 
} from "@/lib/signDocDebug";

// Generate debug info for a transaction
const debugInfo = generateSignDocDebugInfo(
  msgs,
  fee,
  chainId,
  memo,
  accountNumber,
  sequence
);

// Log comprehensive debug output
logSignDocDebug(debugInfo, "My Transaction");

// Verify a signature
const isValid = await verifySignatureAgainstSignDoc(
  signatureBytes,
  debugInfo.signDocHash,
  pubkeyBytes
);
```

### 2. CLI Comparison Script (`scripts/compare-signdoc.ts`)

Script to compare CLI-generated transactions with app-generated ones:

```bash
# Step 1: Generate unsigned tx from CLI
cored tx distribution withdraw-rewards corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh \
  --commission \
  --from core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf \
  --generate-only \
  --offline \
  --account-number 31625 \
  --sequence 5 \
  --fees 68750ucore \
  --gas 1100000 \
  -o json > cli-tx.json

# Step 2: Use the comparison utilities in your code
```

### 3. Debug API Endpoint (`/api/debug/compare-signdoc`)

POST endpoint for comparing SignDoc structures:

```bash
curl -X POST http://localhost:3003/api/debug/compare-signdoc \
  -H "Content-Type: application/json" \
  -d '{
    "cliTxJson": "<paste CLI --generate-only output>",
    "appTx": {
      "accountNumber": 31625,
      "sequence": 5,
      "chainId": "coreum-mainnet-1",
      "msgs": [...],
      "fee": {"amount": [{"denom": "ucore", "amount": "68750"}], "gas": "1100000"},
      "memo": ""
    }
  }'
```

### 4. Enhanced Broadcast Debugging

The broadcast function in `[transactionID].tsx` now includes:
- Full SignDoc debug logging with `logSignDocDebug()`
- Consistent amino converters (both default + WASM)
- Canonical JSON output for comparison with CLI

---

## NEXT DIAGNOSTIC STEPS

Based on the analysis, the following steps should be performed:

### Step 1: Generate CLI Transaction for Comparison

```sh
cored tx distribution withdraw-rewards corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh \
  --commission \
  --from core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf \
  --generate-only \
  --offline \
  --account-number 31625 \
  --sequence <CURRENT_SEQUENCE> \
  --fees 68750ucore \
  --gas 1100000 \
  -o json > coreum-withdraw.json
```

### Step 2: Sign with CLI as Control Test

Have each signer run:
```sh
cored tx sign coreum-withdraw.json \
  --multisig core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf \
  --from <signer-key> \
  --account-number 31625 \
  --sequence <CURRENT_SEQUENCE> \
  --offline \
  --output-document signer-X.json
```

Assemble signatures:
```sh
cored tx multisign coreum-withdraw.json multisig-name signer-1.json signer-2.json signer-3.json \
  --output-document signed-tx.json
```

Broadcast:
```sh
cored tx broadcast signed-tx.json
```

**If CLI succeeds but app fails:** The issue is in our signing logic.
**If CLI also fails:** The issue may be with the multisig setup or chain-specific behavior.

### Step 3: Byte-Level Comparison

Compare the exact SignDoc bytes:
1. Open browser console on transaction page
2. Attempt broadcast
3. Check console for "BROADCAST SignDoc Analysis" output
4. Compare the canonical JSON with CLI's expectation

### Step 4: Check Coreum's Custom Modules

Coreum may have modified the distribution module. Check:
- https://github.com/CoreumFoundation/coreum
- Look for custom amino registration
- Check if they have custom GetSignBytes for commission messages

---

## LIBRARY VERSION INFO

Current `@cosmjs` versions (from `package.json`):
- `@cosmjs/amino`: `^0.35.0-rc.0`
- `@cosmjs/stargate`: `^0.35.0-rc.0`
- `@cosmjs/crypto`: `^0.35.0-rc.0`
- `@cosmjs/proto-signing`: `^0.35.0-rc.0`
- `cosmjs-types`: `^0.9.0`

These are recent versions and should support Cosmos SDK v0.47 properly.

---

## DIAGNOSTIC WORKFLOW RESULTS (Dec 12, 2025)

### CLI Transaction Generation (Docker)

Used cored Docker image to generate unsigned transaction:

```bash
docker run --rm --entrypoint cored cored:d859134 tx distribution withdraw-rewards \
  corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh \
  --commission \
  --from core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf \
  --generate-only \
  --account-number 31625 \
  --sequence 5 \
  --fees 68750ucore \
  --gas 1100000 \
  --chain-id coreum-mainnet-1 \
  --node https://full-node.mainnet-1.coreum.dev:26657 \
  -o json
```

**Result:** CLI generates identical structure to our app:
- 2 messages: `MsgWithdrawDelegatorReward` + `MsgWithdrawValidatorCommission`
- Same fee, gas, memo

### SignDoc Comparison

**App-Generated SignDoc:**
```json
{"account_number":"31625","chain_id":"coreum-mainnet-1","fee":{"amount":[{"amount":"68750","denom":"ucore"}],"gas":"1100000"},"memo":"","msgs":[{"type":"cosmos-sdk/MsgWithdrawDelegationReward","value":{"delegator_address":"core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf","validator_address":"corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh"}},{"type":"cosmos-sdk/MsgWithdrawValidatorCommission","value":{"validator_address":"corevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhv2cr8xh"}}],"sequence":"5"}
```

**SignDoc Hash:** `mA0lpbuRyd7orcYKuP/L6Rm67JlXum2fben+i/6MYYY=`

### Local Signature Verification

All 3 signatures verify correctly against the SignDoc hash:
- `core1jcas459gnu857ylephjdjlea3rkr38m0asj6gw` ✅ VALID (pubkey index 0)
- `core1mgvlgvh2hfw5pgdqc79up3du69v2z3t8qz4kwg` ✅ VALID (pubkey index 1)
- `core1ltltw0jya4hq39myd9798qqvu6jzy6zxalxhqu` ✅ VALID (pubkey index 2)

### MultiSignature Structure Verification

The assembled multisig transaction has correct structure:
- Bitarray: `0xE0` (all 3 signers, bits 0,1,2 set)
- ModeInfos: 3x `SIGN_MODE_LEGACY_AMINO_JSON` (mode 127)
- Signatures: 3x 64-byte signatures in correct pubkey order

### Comparison with Successful Transaction

Compared failing tx with successful `MsgWithdrawDelegatorReward` tx (C6498315DDF2C46673CEA3656971C7825D1C337501AF6FDD5BC626E26F441078):
- Identical protobuf structure ✅
- Identical bitarray encoding ✅
- Identical signature assembly ✅
- Same pubkey order ✅

### Broadcast Attempt Results

**Direct REST API Broadcast:**
```bash
curl -X POST "https://full-node.mainnet-1.coreum.dev:1317/cosmos/tx/v1beta1/txs" \
  -d '{"tx_bytes": "...", "mode": "BROADCAST_MODE_SYNC"}'
```

**Result:**
```json
{
  "tx_response": {
    "txhash": "907F0E9B1FBFC69EF6CD412293E26F472DDCB0E7EE41F5DA344D97F4E252C559",
    "codespace": "sdk",
    "code": 4,
    "raw_log": "signature verification failed; please verify account number (31625), sequence (5) and chain-id (coreum-mainnet-1): unauthorized"
  }
}
```

---

## KEY FINDINGS

### What We've Verified Is Correct:

1. ✅ Transaction structure matches CLI exactly
2. ✅ Protobuf encoding is correct
3. ✅ Amino type names are correct:
   - `cosmos-sdk/MsgWithdrawDelegationReward`
   - `cosmos-sdk/MsgWithdrawValidatorCommission`
4. ✅ SignDoc JSON is canonical (alphabetical keys)
5. ✅ All 3 signatures verify locally
6. ✅ Signature order matches pubkey order
7. ✅ MultiSignature structure is identical to successful tx
8. ✅ Account number (31625) and sequence (5) match on-chain state
9. ✅ Chain ID is correct (coreum-mainnet-1)

### The Mystery

Despite EVERYTHING being correct, the chain still rejects the signature verification. The only difference between failing and successful transactions:
- **Successful:** Single `MsgWithdrawDelegatorReward` ✅
- **Failing:** Contains `MsgWithdrawValidatorCommission` ❌

This strongly suggests Coreum has custom signature verification logic for `MsgWithdrawValidatorCommission` that differs from standard Cosmos SDK behavior.

---

## NEXT STEPS TO INVESTIGATE

1. **Contact Coreum Team:** Ask if they have custom signature verification for distribution messages
2. **Review Coreum Source:** Check https://github.com/CoreumFoundation/coreum for custom ante handlers or modified distribution module
3. **Try Direct Signing Mode:** Test with SIGN_MODE_DIRECT instead of SIGN_MODE_LEGACY_AMINO_JSON
4. **Compare with Another Validator:** See if any other validator has successfully withdrawn commission via multisig on Coreum

---

## IMPLEMENTATION: SIGN_MODE_DIRECT SUPPORT (Dec 12, 2025)

Added support for SIGN_MODE_DIRECT as an alternative to SIGN_MODE_LEGACY_AMINO_JSON.

### Files Changed

1. **`lib/keplr.ts`**
   - Added `getKeplrDirectSigner()` - Gets a Direct signer from Keplr
   - Added `getKeplrAutoSigner()` - Gets an auto signer that chooses the best mode

2. **`context/WalletContext/index.tsx`**
   - Added `getDirectSigner` to the WalletContext
   - Exposed function to get Direct signer from Keplr

3. **`components/forms/TransactionSigning.tsx`**
   - Added sign mode selector (Amino vs Direct) for transactions containing `MsgWithdrawValidatorCommission`
   - Shows experimental warning with toggle buttons to switch modes
   - Logs which signing mode is being used

### How to Test

1. Create a new "Withdraw Validator Commission" transaction
2. On the transaction page, when signing:
   - You'll see an "Experimental: Sign Mode" section with Amino/Direct toggle
   - Try signing with **Amino** first (default)
   - If broadcast fails, cancel signatures and try **Direct** mode
3. All signers must use the SAME signing mode for the multisig to work

### Important Notes

- **All signers must use the same sign mode** - You can't mix Amino and Direct signatures
- Direct mode may produce different bodyBytes than Amino mode
- Ledger does NOT support Direct signing mode - only Keplr works
- If Direct mode works, we should make it the default for this message type

