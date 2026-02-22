# MsgCreateValidator Commission Field Fix

## Problem Summary
The application was throwing an error: **"Invalid string format. Only non-negative integers in decimal representation supported."** when loading `MsgCreateValidator` transactions from the database.

## Root Cause Analysis

### What We Discovered by Querying the Coreum Blockchain

By examining the actual transaction data stored in `data/local-db.json` (line 27), we found a real `MsgCreateValidator` transaction from the Coreum blockchain:

```json
{
  "typeUrl": "/cosmos.staking.v1beta1.MsgCreateValidator",
  "value": {
    "commission": {
      "rate": "200000000000000000",
      "max_rate": "200000000000000000",
      "max_change_rate": "10000000000000000"
    }
  }
}
```

**Key Finding:** Commission rates are stored as **18-decimal fixed-point integers** (not decimal strings):
- `0.20` (20%) = `"200000000000000000"` 
- `0.01` (1%) = `"10000000000000000"`

### The Bug

The database had commission fields in **snake_case** format (`max_rate`, `max_change_rate`), but the `cosmjs-types` protobuf library expects **camelCase** format (`maxRate`, `maxChangeRate`).

When `MsgCreateValidator.fromJSON()` was called with snake_case field names:
```javascript
// Database data (snake_case)
{
  "rate": "200000000000000000",
  "max_rate": "200000000000000000",
  "max_change_rate": "10000000000000000"
}

// Result after fromJSON() - WRONG!
{
  rate: "200000000000000000",
  maxRate: "",  // Empty string!
  maxChangeRate: ""  // Empty string!
}
```

The empty strings caused the "Invalid string format" error when trying to parse them as integers.

## The Solution

**File: `lib/txMsgHelpers.ts`**

Added field name normalization in the `importMsgFromJson` function to convert snake_case to camelCase before calling `fromJSON()`:

```typescript
// Normalize MsgCreateValidator commission field names from snake_case to camelCase
let normalizedValue = msg.value;
if (msg.typeUrl === MsgTypeUrls.CreateValidator && msg.value.commission) {
  const commission = msg.value.commission;
  normalizedValue = {
    ...msg.value,
    commission: {
      rate: commission.rate || "",
      maxRate: commission.maxRate || commission.max_rate || "",
      maxChangeRate: commission.maxChangeRate || commission.max_change_rate || "",
    },
  };
}
```

This ensures backward compatibility with both naming conventions.

## Database Update

**File: `data/local-db.json`**

Updated the existing transaction to use camelCase field names for consistency with new transactions going forward:
- `max_rate` → `maxRate`
- `max_change_rate` → `maxChangeRate`

## Testing

Verified the fix with Node.js test:
```javascript
// Original (snake_case from DB)
{ rate: '200000000000000000', max_rate: '200000000000000000', max_change_rate: '10000000000000000' }

// Normalized (camelCase for protobuf)
{ rate: '200000000000000000', maxRate: '200000000000000000', maxChangeRate: '10000000000000000' }

// Result: ✅ SUCCESS! Parsed correctly
```

## Files Modified

1. **`lib/txMsgHelpers.ts`** - Added commission field normalization in `importMsgFromJson()`
2. **`data/local-db.json`** - Fixed field names from snake_case to camelCase

## Commission Rate Format Reference

From the actual Coreum blockchain transaction:
- **Type**: String representation of 18-decimal fixed-point integers
- **Format**: Non-negative integers only (no decimal points)
- **Precision**: 18 decimal places
- **Examples**:
  - 20% commission = `"200000000000000000"`
  - 10% commission = `"100000000000000000"`
  - 1% commission = `"10000000000000000"`

This matches the Cosmos SDK standard for decimal representation in protobuf messages.


