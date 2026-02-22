# Manual Browser Test: Transaction Creation Navigation

## Purpose
Manually verify that creating a transaction successfully navigates to the transaction detail page.

## Prerequisites
- Development server running: `npm run dev` (accessible at http://localhost:3003)
- A multisig account exists in the database
- The multisig has an account on-chain with some balance

## Test URL
http://localhost:3003/coreum/core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf/transaction/new

(Or use any valid multisig address from your database)

## Test Steps

### 1. Navigate to Create Transaction Page
1. Open browser
2. Go to: `http://localhost:3003/coreum/core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf/transaction/new`
3. **Expected:** Page loads with "New Transaction" heading and transaction type selector

### 2. Fill Out Transaction Form
1. Click on a transaction type (e.g., "Send" under "Bank & Transfers")
2. Fill in the form fields:
   - **To Address:** Any valid address (e.g., `core1test123456789abcdefghijklmnopqrstuvwxyz`)
   - **Amount:** Any valid amount (e.g., `1`)
   - **Denom:** Should be pre-filled (e.g., `ucore`)
3. **Expected:** Form fields are populated and no validation errors show

### 3. Verify Form Validation
1. Check that the "Create Transaction" button becomes enabled when form is valid
2. **Expected:** Button is clickable (not disabled)

### 4. Create Transaction
1. Click "Create Transaction" button
2. **Expected:** 
   - Loading spinner appears briefly
   - Toast notification shows "Transaction created with ID [txId]"

### 5. Verify Navigation
1. **Expected URL Change:**
   - OLD: `/coreum/core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf/transaction/new`
   - NEW: `/coreum/core14rmczf6t6qldyrqrv4jd0zzypkuymrhvsxazxf/transaction/[TRANSACTION_ID]`
   
2. **Expected Page Content:**
   - Page title changes to show transaction details
   - Transaction information is displayed (account number, sequence, chain ID)
   - Messages section shows the transaction details you filled in
   - Signature section is visible (with 0 signatures initially)

### 6. Verify Transaction ID
1. Copy the transaction ID from the URL
2. **Expected Format:** `[timestamp]-[randomstring]`
   - Example: `1771182637864-fce6ylz7c`
   - Timestamp: 13 digits
   - Random string: ~9 lowercase alphanumeric characters
   - Separator: single hyphen

### 7. Check Browser Console
1. Open browser developer tools (F12)
2. Check Console tab
3. **Expected:** 
   - No errors (red messages)
   - May see some debug logs starting with "DEBUG:"
   - May see warnings about nested `<a>` tags (known non-critical issue)

### 8. Check Network Tab
1. In developer tools, go to Network tab
2. Look for these requests:
   - `POST /api/transaction` - Status 200
   - `GET /_next/data/development/coreum/[address]/transaction/[txId].json` - Status 200
3. **Expected:** Both requests successful with 200 status codes

## Test Results Template

```
Date: ___________
Tester: ___________

Step 1 - Navigate to Page: [ ] Pass [ ] Fail
Step 2 - Fill Form: [ ] Pass [ ] Fail
Step 3 - Validate Form: [ ] Pass [ ] Fail
Step 4 - Create Transaction: [ ] Pass [ ] Fail
Step 5 - Verify Navigation: [ ] Pass [ ] Fail
Step 6 - Verify Transaction ID: [ ] Pass [ ] Fail
Step 7 - Check Console: [ ] Pass [ ] Fail
Step 8 - Check Network: [ ] Pass [ ] Fail

Overall Result: [ ] Pass [ ] Fail

Notes:
_____________________________________________
_____________________________________________
_____________________________________________
```

## Troubleshooting

### Issue: Page doesn't load
- **Check:** Is the dev server running? (`npm run dev`)
- **Check:** Is the URL correct? (port 3003, not 3000)
- **Check:** Does the multisig exist in your database?

### Issue: "Account Not Found" error
- **Solution:** Send some tokens to the multisig address first
- **Alternative:** Use a different multisig that already has tokens

### Issue: "Create Transaction" button is disabled
- **Check:** All form fields are filled correctly
- **Check:** Gas limit is a positive integer
- **Check:** Browser console for validation errors

### Issue: Navigation doesn't happen
- **Check:** Browser console for JavaScript errors
- **Check:** Network tab to see if API call succeeded
- **Check:** Server terminal logs for error messages

### Issue: Page navigation succeeds but shows error
- **Check:** Transaction ID format in URL
- **Check:** Server logs for database errors
- **Check:** Network response for error details

## Success Criteria

The test is successful when:
1. ✅ Page loads without errors
2. ✅ Form can be filled and submitted
3. ✅ Transaction is created (confirmed by toast message)
4. ✅ URL changes to transaction detail page
5. ✅ Transaction detail page displays correct information
6. ✅ No critical errors in browser console

## Additional Verification

### Check Server Logs
Look for these log entries in your terminal:
```
POST /api/transaction 200 in [XX]ms
Create transaction success { "txId": "[transaction-id]" }
✓ Compiled /[chainName]/[address]/transaction/[transactionID] in [XX]ms
```

### Check Database
Transaction should be stored in the database:
```bash
# If using JSON file database
cat data/local-db.json | jq '.transactions[] | select(.id=="[transaction-id]")'
```

## Related Test Files
- `__tests__/integration/transaction-creation-flow.test.tsx` - Automated integration tests
- `__tests__/pages/create-transaction.test.tsx` - Page render tests

## Notes
- This test focuses specifically on the navigation flow
- Transaction signing and broadcasting are separate flows and not tested here
- Multiple transaction types can be tested (Send, Delegate, Vote, etc.)

---

**Last Updated:** 2026-02-15
