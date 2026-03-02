/**
 * Transaction Flow Integration Tests
 *
 * File: __tests__/integration/tx-flow.test.ts
 *
 * Tests the complete build → sign → broadcast flow using mocks
 * for autonomous correctness validation.
 */

import { getWalletFlow } from "../adapters/walletFlow.adapter";
import { MockWalletSigner } from "../mocks/MockWalletSigner";
import { MockBroadcaster } from "../mocks/MockBroadcaster";
import { MsgTypeUrls } from "@/types/txMsg";

describe("Integration: tx flow (build -> sign -> broadcast) without real wallets", () => {
  const flow = getWalletFlow();

  test("happy path", async () => {
    const wallet = new MockWalletSigner({ address: "cosmos1signer" });
    const bc = new MockBroadcaster();
    bc.enqueueSuccess({ code: 0, txhash: "TX_OK" });

    const txBytes = await flow.buildTxBytes({
      msgs: [
        {
          typeUrl: MsgTypeUrls.Send,
          value: { toAddress: "cosmos1recipient", amount: [{ denom: "uatom", amount: "1000" }] },
        },
      ],
      memo: "test transaction",
    });
    expect(txBytes).toBeDefined();
    expect(txBytes.length).toBeGreaterThan(0);
    expect(txBytes.constructor.name).toBe("Uint8Array");

    const signed = await flow.signTxBytes(txBytes, wallet);
    expect(signed.length).toBeGreaterThan(txBytes.length);

    const res = await flow.broadcastSignedTx(signed, bc);
    expect(res.code).toBe(0);
    expect(res.txhash).toBe("TX_OK");
  });

  test("user rejects signing", async () => {
    const wallet = new MockWalletSigner({ rejectSign: true });

    const txBytes = await flow.buildTxBytes({
      msgs: [{ typeUrl: MsgTypeUrls.Send, value: {} }],
    });

    await expect(flow.signTxBytes(txBytes, wallet)).rejects.toThrow(/REJECTED/i);
  });

  test("broadcast failure surfaces cleanly", async () => {
    const wallet = new MockWalletSigner();
    const bc = new MockBroadcaster();
    bc.enqueueFailure(new Error("RPC_DOWN"));

    const txBytes = await flow.buildTxBytes({
      msgs: [{ typeUrl: MsgTypeUrls.Send, value: {} }],
    });

    const signed = await flow.signTxBytes(txBytes, wallet);

    await expect(flow.broadcastSignedTx(signed, bc)).rejects.toThrow(/RPC_DOWN/);
  });

  test("multiple broadcast attempts work", async () => {
    const wallet = new MockWalletSigner();
    const bc = new MockBroadcaster();
    bc.enqueueSuccess({ code: 0, txhash: "TX_1" });
    bc.enqueueSuccess({ code: 0, txhash: "TX_2" });

    const txBytes1 = await flow.buildTxBytes({
      msgs: [{ typeUrl: MsgTypeUrls.Send, value: { amount: "100" } }],
    });
    const signed1 = await flow.signTxBytes(txBytes1, wallet);
    const res1 = await flow.broadcastSignedTx(signed1, bc);
    expect(res1.txhash).toBe("TX_1");

    const txBytes2 = await flow.buildTxBytes({
      msgs: [{ typeUrl: MsgTypeUrls.Send, value: { amount: "200" } }],
    });
    const signed2 = await flow.signTxBytes(txBytes2, wallet);
    const res2 = await flow.broadcastSignedTx(signed2, bc);
    expect(res2.txhash).toBe("TX_2");
  });

  test("empty message list produces valid tx", async () => {
    const wallet = new MockWalletSigner();
    const bc = new MockBroadcaster();
    bc.enqueueSuccess({ code: 0, txhash: "EMPTY_TX" });

    const txBytes = await flow.buildTxBytes({
      msgs: [],
      memo: "empty tx test",
    });
    expect(txBytes).toBeDefined();
    expect(txBytes.constructor.name).toBe("Uint8Array");

    const signed = await flow.signTxBytes(txBytes, wallet);
    const res = await flow.broadcastSignedTx(signed, bc);
    expect(res.code).toBe(0);
  });
});
