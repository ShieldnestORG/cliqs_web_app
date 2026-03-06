/**
 * usePendingTransactions
 *
 * Thin re-export so all existing callers keep working unchanged.
 * The actual logic and state live in PendingTransactionsContext so that
 * Header, Sidebar, and ListUserCliqs share one fetch cycle instead of
 * running three independent polling loops.
 */

export {
  usePendingTransactionsContext as usePendingTransactions,
  dispatchTransactionStatusChanged,
  TRANSACTION_STATUS_CHANGED_EVENT,
} from "@/context/PendingTransactionsContext";

export type { PendingTransactionsData } from "@/context/PendingTransactionsContext";
