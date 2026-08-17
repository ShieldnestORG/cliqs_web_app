# How to Use this App

> **Cluster:** user-docs · **Tags:** user-guide, multisig, cliq, fees, data-privacy · **Related:** [PRD.md](PRD.md), [SETUP.md](../SETUP.md), [Manual test: transaction navigation](MANUAL_TEST_TRANSACTION_CREATION_NAVIGATION.md)

This app requires the [Keplr wallet extension](https://wallet.keplr.app/) to be enabled and setup on your browser. A Ledger device can be connected for signing, but the Data & Privacy controls described below need Keplr.

## Table of Contents

- [Getting Around the App](#getting-around-the-app)
- [Creating and Using Accounts](#accounts)
  - [Use Existing Multisig Account](#using-an-existing-multisig-account)
  - [Create a New Multisig Account](#creating-a-new-multisig-account)
- [Creating a Transaction](#creating-a-transaction)
- [Signing a Transaction](#signing-a-transaction)
- [Broadcasting a Transaction](#broadcasting-a-transaction)
- [Who Pays the Fees](#who-pays-the-fees)
- [Data & Privacy](#data--privacy)

## Getting Around the App

On a desktop screen the app's navigation is a narrow icon rail down the left edge. It stays collapsed to icons until you move the pointer over it (or tab into it with the keyboard), then it slides open over the page — the page content underneath does not shift while it is open.

If you would rather keep it open all the time, click the panel icon at the top of the rail. That **pins** the sidebar: it stays expanded, and the page content sits beside it instead of underneath it. Click the same icon again to unpin. The choice is remembered in your browser, so the sidebar comes back the way you left it. Pressing `Escape` while the rail is open collapses it again.

On phones and tablets there is no side rail at all — navigation lives in the header bar at the top of the screen.

## Accounts

### Using an existing multisig account

To use this app with an existing multisig account, simply enter the address in the field provided, and click "Open CLIQ" (the app calls a multisig a "CLIQ"). Note that this address must have sent transactions in the past for this app to be able to use it. If you have an existing multisig that has not sent any transactions, you can recreate it using this tool (be sure to enter the same public keys and threshold). 

![Screen Shot 2021-09-05 at 1 08 28 PM](https://user-images.githubusercontent.com/6718506/132136687-856a71bd-cd3b-465c-a2e8-8f4283161a11.png)

You may want to [Create a Transaction](#creating-a-transaction) next.

### Creating a new multisig account

To create a new multisig account, click "Create new CLIQ" (or "Create Multisig" in the sidebar). Then enter in the addresses of the accounts you would like to use, as well as the number of signatures required to sign a transaction. Click "Create CLIQ" and confirm. These addresses must have sent transactions in the past to be used, the app will show an error if there is no on chain account information for any of the addresses.

![Screen Shot 2021-10-04 at 10 10 21 PM](https://user-images.githubusercontent.com/6718506/135949511-b0d51820-7359-4707-a873-966e31b187c0.png)
![Screen Shot 2021-10-04 at 10 10 24 PM](https://user-images.githubusercontent.com/6718506/135949518-08e9e994-9695-4847-b152-5f28610dd221.png)


You may want to [Create a Transaction](#creating-a-transaction) next.

## Creating a Transaction

On the multisig account page, click "New Transaction". 

![Screen Shot 2021-09-05 at 1 16 56 PM](https://user-images.githubusercontent.com/6718506/132136739-c43eeaeb-15fd-48d3-afa2-8e630740cf82.png)
First pick what the transaction should do. The picker has two tabs — "Standard User Commands" (Send and IBC Transfer live under the "// Transfers" heading; Delegate, Redelegate, Undelegate, Withdraw Rewards and Vote under "// Staking & Governance") and "Validator Commands". Then enter in the to address, the amount and optionally a memo. The gas limit is adjustable, but you probably do not want to change it, as the gas fees are set automatically by the app; the gas price beside it is fixed by the network and cannot be edited. Once all the necessary fields are filled in, click "Create Transaction". 
![Screen Shot 2021-09-05 at 1 19 30 PM](https://user-images.githubusercontent.com/6718506/132136750-d2e91252-fa4d-4f56-9d80-8460c85deec4.png)

You may want to [Sign a Transaction](#signing-a-transaction) next.

## Signing a Transaction

To sign a transaction, make sure you have the Keplr wallet app installed and setup on your browser. Then navigate to the transaction page for the transaction you are trying to sign.  

![Screen Shot 2021-09-05 at 1 19 49 PM](https://user-images.githubusercontent.com/6718506/132136776-da6c0853-c55b-4bfb-9228-7615a2811cde.png)

Click "Connect Keplr" (or "Connect Ledger"), then step through the intent check: "Verify Transaction Intent" shows you exactly what you are about to sign — the messages, the fee, the chain, the account number and sequence — and the sign button only becomes "Sign transaction" once you have confirmed it. Approve the transaction in the Keplr window that pops up. That's it! Once you've successfully signed a transaction, you will see a confirmation message.

![Screen Shot 2021-09-05 at 1 23 24 PM](https://user-images.githubusercontent.com/6718506/132136783-c81c9a30-b5b2-487a-8d2d-83cde819fc55.png)


Once enough necessary signers have signed, anyone will be able to [broadcast the transaction](#broadcasting-a-transaction).

## Broadcasting a Transaction

Once enough signers have signed a transaction, the transaction will become broadcastable. To broadcast, click "Broadcast Transaction". 

![Screen Shot 2021-09-05 at 1 24 06 PM](https://user-images.githubusercontent.com/6718506/132136802-1365b50b-2398-4fef-80e8-37c34b5ea8a1.png)

Once initiated it will take several moments for it to go through. 
![Screen Shot 2021-09-05 at 1 24 30 PM](https://user-images.githubusercontent.com/6718506/132136822-9d3f32fd-577a-45af-aced-80a4e61f1537.png)

Once successfully broadcast, the app will show a success message and a "View in Explorer" link for the transaction. If the transaction could not be broadcast, the error appears as a notification.

![Screen Shot 2021-09-05 at 1 24 39 PM](https://user-images.githubusercontent.com/6718506/132136826-c4f7c46c-7cf8-4a12-880d-96f0abd400a3.png)

Before it sends anything, the app runs two checks and stops with an explanation if either fails:

- **Sequence check.** If another transaction was broadcast from this multisig since this one was created, the collected signatures are no longer valid. The page shows a "Sequence Mismatch Detected" card; cancel this transaction and create a new one.
- **Fee balance check.** The app looks up the multisig account's balance and refuses to broadcast if it cannot cover the fee, telling you exactly how much is short. See [Who Pays the Fees](#who-pays-the-fees).

After broadcasting, the app confirms the transaction against several independent RPC endpoints and shows a "Multi-Endpoint Verification" card listing them. If the primary endpoint proved the transaction landed but fewer of the other endpoints have caught up yet, the card says so — that is a warning, not a failure; the transaction is on chain.

Two failure modes are worth recognising:

- **"Multisig account cannot cover the fee"** — the transaction never entered a block, so nothing changed on chain and the signatures you already collected stay valid. Fund the multisig address and press Broadcast again.
- **"Transaction fee too low"** — the network's gas price rose after this transaction was created. The fee is fixed at signing time and cannot be raised now, so cancel the transaction and create a new one.

A transaction can also be included in a block and *still* fail to execute (for example, changing a validator's commission twice within 24 hours). When that happens the fee is consumed and the account sequence advances, so re-broadcasting the same transaction can never succeed — cancel it and create a new one. A notification explains what went wrong. Note the current limitation: the page still titles such a transaction "Completed Transaction", because a landed-but-failed transaction is not yet tracked as its own status. Always open the explorer link to confirm a transaction actually did what you intended.

## Who Pays the Fees

**The CLIQ (multisig) account itself always pays the transaction fee.** It is the only signer on the transaction as far as the chain is concerned, so the fee comes out of the CLIQ's balance — never out of a member's personal wallet, no matter who presses Broadcast.

This is the single most common surprise: if broadcasting fails with **insufficient funds**, the fix is to send tokens to the *CLIQ address*, not to your own wallet. Once the CLIQ can cover the fee, press Broadcast again — the existing signatures remain valid and nothing needs to be re-signed.

(The Validator Dashboard is the exception: when you are not acting through a CLIQ, it signs directly from your connected wallet, and that wallet pays.)

### What a transaction costs

The app sets the gas limit from a built-in table: **100,000 gas of overhead per transaction, plus a per-message amount**. The fee is then `gas x the chain's gas price`, and the gas price is read from the chain registry and shown, read-only, next to the gas limit when you create a transaction.

The table below assumes a gas price of **0.0625 ucore**, the value the Coreum configuration uses (1,000,000 ucore = 1 token). For a different chain or gas price, multiply the gas column by that chain's price instead.

| Operation | Gas for a 1-message transaction | Fee at 0.0625 ucore |
|---|---:|---:|
| Send | 200,000 | 12,500 ucore |
| IBC Transfer | 280,000 | 17,500 ucore |
| Vote | 200,000 | 12,500 ucore |
| Delegate | 500,000 | 31,250 ucore |
| Undelegate | 700,000 | 43,750 ucore |
| Redelegate | 700,000 | 43,750 ucore |
| Withdraw Rewards | 600,000 | 37,500 ucore |
| Withdraw Validator Commission | 700,000 | 43,750 ucore |
| Set Withdraw Address | 200,000 | 12,500 ucore |
| Fund Community Pool | 200,000 | 12,500 ucore |
| Create Validator | 600,000 | 37,500 ucore |
| Edit Validator | 600,000 | 37,500 ucore |
| Create Vesting Account | 200,000 | 12,500 ucore |
| Instantiate / Execute / Migrate contract, Update Admin | 250,000 | 15,625 ucore |

Adding more messages to one transaction adds their gas together over the single 100,000 overhead. Claiming validator commission *and* self-delegation rewards in one go, for instance, is 100,000 + 600,000 + 500,000 = **1,200,000 gas (75,000 ucore)**.

## Data & Privacy

Everything the CLIQ has ever done on chain is public and permanent. What the app stores off chain — the CLIQ's name and description, its transaction drafts, memos, and every member's signatures — lives in the app's database, and the **Data & Privacy** panel on the CLIQ's Transactions tab lets members manage it.

Two things to understand before using it:

- **This data is shared.** It belongs to the whole CLIQ, not to you. Anything you delete here disappears for every member.
- **You must prove membership.** Each button asks you to sign a message with Keplr first, and the app checks that signature against the CLIQ's list of member keys. Each click needs its own fresh signature.

| Button | What it does |
|---|---|
| **Export History** | Downloads the CLIQ's full history — pending transactions included, with every member's signatures — as a JSON file. Nothing is deleted. |
| **Wipe Completed** | Permanently deletes broadcast (completed) transactions and their signatures from the database. On-chain records are untouched, but memos stored here are gone. |
| **Delete Cliq Data** | Permanently deletes the CLIQ record itself along with its entire history and all signatures. |

**Delete Cliq Data** is refused with an error if any pending transaction still carries a signature from another member — those are other people's work, so cancel the pending transactions through the normal Cancel flow first, then retry. **Wipe Completed** is not subject to that guard, because it only ever touches transactions that already went out on chain.

Deleting the CLIQ makes it vanish from the app **for every member**, not just for you. It can be brought back by re-importing the multisig address (paste it into the find field and click "Open CLIQ"), and the on-chain funds are never affected — but the CLIQ's **name and description cannot be recovered**, and neither can its history. Export first if any of it matters.

If the app is running against a local JSON database rather than a hosted one, these buttons report that deletion is not supported and tell you to edit the local file directly. For self-hosting and retention details, see the "Data retention & deletion" section of [SETUP.md](../SETUP.md).

