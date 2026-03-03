# MsgWithdrawValidatorCommission Fix
Issue: Signature fail despite simulation pass.

Root: SIGN_MODE_DIRECT required (vs Amino).

Fix: lib/multisigDirect.ts, auto-detect.

Status: ✅ Verified tx success.