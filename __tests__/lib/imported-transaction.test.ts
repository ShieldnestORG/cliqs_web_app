import { parseImportedTransactionInput } from "@/lib/importedTransaction";
import { aminoConverters, makeAppRegistry } from "@/lib/msg";
import { msgsFromJson } from "@/lib/txMsgHelpers";
import { AminoTypes } from "@cosmjs/stargate";

describe("parseImportedTransactionInput", () => {
  it("converts a raw Cosmos tx envelope into the canonical app format", () => {
    const rawTx = {
      body: {
        messages: [
          {
            "@type": "/cosmos.staking.v1beta1.MsgCreateValidator",
            description: {
              moniker: "Shieldnest",
              identity: "F189A898C4D54565",
              website: "https://shieldnest.org",
              security_contact: "info@shieldnest.org",
              details: "validator details",
            },
            commission: {
              rate: "0.150000000000000000",
              max_rate: "0.200000000000000000",
              max_change_rate: "0.010000000000000000",
            },
            min_self_delegation: "20000000000",
            delegator_address: "testcore1delegator",
            validator_address: "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk",
            pubkey: {
              "@type": "/cosmos.crypto.ed25519.PubKey",
              key: "CXo9FPrHSQAn4RAhIRw04ry52nyOIBlvPiNH84qWasA=",
            },
            value: {
              denom: "utestcore",
              amount: "20000000000",
            },
          },
        ],
        memo: "",
        timeout_height: "0",
      },
      auth_info: {
        signer_infos: [],
        fee: {
          amount: [{ denom: "utestcore", amount: "12500" }],
          gas_limit: "200000",
        },
      },
      signatures: [],
    };

    const result = parseImportedTransactionInput(
      rawTx,
      {
        chainId: "coreum-testnet-1",
        accountNumber: "123",
        sequence: "0",
      },
      { expectedChainId: "coreum-testnet-1", requireNonEmptyMsgs: true },
    );

    expect(result.error).toBeUndefined();
    expect(result.source).toBe("raw");
    if (result.error || !result.tx) {
      throw new Error(result.error ?? "Expected parsed transaction");
    }

    expect(result.tx).toMatchObject({
      chainId: "coreum-testnet-1",
      accountNumber: 123,
      sequence: 0,
      fee: {
        amount: [{ denom: "utestcore", amount: "12500" }],
        gas: "200000",
      },
      memo: "",
    });
    expect(result.tx.msgs[0]).toMatchObject({
      typeUrl: "/cosmos.staking.v1beta1.MsgCreateValidator",
      value: {
        description: {
          securityContact: "info@shieldnest.org",
        },
        commission: {
          maxRate: "0.200000000000000000",
          maxChangeRate: "0.010000000000000000",
        },
        minSelfDelegation: "20000000000",
        validatorAddress: "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk",
        pubkey: {
          type: "/cosmos.crypto.ed25519.PubKey",
          key: "CXo9FPrHSQAn4RAhIRw04ry52nyOIBlvPiNH84qWasA=",
        },
      },
    });
    expect(result.importedSignatures).toEqual([]);
  });

  it("accepts MsgUnjail imports and keeps them signable", () => {
    const rawTx = {
      body: {
        messages: [
          {
            "@type": "/cosmos.slashing.v1beta1.MsgUnjail",
            validator_addr: "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk",
          },
        ],
        memo: "",
        timeout_height: "0",
      },
      auth_info: {
        signer_infos: [],
        fee: {
          amount: [{ denom: "utestcore", amount: "9000" }],
          gas_limit: "180000",
        },
      },
      signatures: [],
    };

    const result = parseImportedTransactionInput(
      rawTx,
      {
        chainId: "coreum-testnet-1",
        accountNumber: "456",
        sequence: "7",
      },
      { expectedChainId: "coreum-testnet-1", requireNonEmptyMsgs: true },
    );

    expect(result.error).toBeUndefined();
    if (result.error || !result.tx) {
      throw new Error(result.error ?? "Expected parsed transaction");
    }

    expect(result.tx.msgs[0]).toEqual({
      typeUrl: "/cosmos.slashing.v1beta1.MsgUnjail",
      value: {
        validatorAddr: "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk",
      },
    });

    expect(msgsFromJson(result.tx.msgs)).toEqual([
      {
        typeUrl: "/cosmos.slashing.v1beta1.MsgUnjail",
        value: {
          validatorAddr: "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk",
        },
      },
    ]);
    const aminoTypes = new AminoTypes(aminoConverters);
    expect(
      aminoTypes.toAmino({
        typeUrl: "/cosmos.slashing.v1beta1.MsgUnjail",
        value: {
          validatorAddr: "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk",
        },
      }),
    ).toEqual({
      type: "cosmos-sdk/MsgUnjail",
      value: {
        address: "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk",
      },
    });
    const registry = makeAppRegistry();
    expect(registry.lookupType("/cosmos.slashing.v1beta1.MsgUnjail")).toBeDefined();
  });
});
