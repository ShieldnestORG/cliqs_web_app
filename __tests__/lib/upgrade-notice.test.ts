/**
 * Upgrade notice data
 *
 * File: __tests__/lib/upgrade-notice.test.ts
 *
 * findProposedUpgrade and estimateTimeAtHeight (lib/validatorHelpers.ts) feed the validator page's
 * upgrade notice. Facts they rest on, measured on TX mainnet 2026-10-11:
 *   - proposal 47 ("TX Chain Mainnet Upgrade v8.0.0") arrives through the v1beta1 query with
 *     content /cosmos.upgrade.v1beta1.MsgSoftwareUpgrade, plan "v8" at height 90,850,000;
 *   - current_plan is null while the vote runs (so the notice says "proposed");
 *   - blocks averaged 0.7202 s over the last 10,000 (height 89,800,667 at 18:29:27Z), which puts
 *     90,850,000 at about 2026-10-20 12:25Z.
 * A proposal that came through the gov v1 REST fallback has its content replaced, so the raw gov
 * v1 messages are read for those.
 *
 * Priority: P1
 */

import { MsgSoftwareUpgrade } from "cosmjs-types/cosmos/upgrade/v1beta1/tx";
import type { Proposal } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { estimateTimeAtHeight, findProposedUpgrade } from "@/lib/validatorHelpers";

const VOTING_END = new Date("2026-10-14T14:57:00Z");

function upgradeProposal(id: number, name: string, height: number): Proposal {
  return {
    proposalId: BigInt(id),
    content: {
      typeUrl: "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade",
      value: MsgSoftwareUpgrade.encode(
        MsgSoftwareUpgrade.fromPartial({
          authority: "core10d07y265gmmuvt4z0w9aw880jnsr700jrdya3k",
          plan: { name, height: BigInt(height), info: "" },
        }),
      ).finish(),
    },
    votingEndTime: { seconds: BigInt(VOTING_END.getTime() / 1000), nanos: 0 },
  } as unknown as Proposal;
}

const textProposal = (id: number) =>
  ({
    proposalId: BigInt(id),
    content: { typeUrl: "/cosmos.gov.v1.MsgExecLegacyContent", value: new Uint8Array() },
  }) as unknown as Proposal;

describe("findProposedUpgrade: P1", () => {
  it("reads the plan out of a v1beta1 MsgSoftwareUpgrade proposal", () => {
    expect(findProposedUpgrade([upgradeProposal(47, "v8", 90_850_000)])).toEqual({
      name: "v8",
      height: 90_850_000,
      proposalId: 47,
      votingEndTime: VOTING_END,
    });
  });

  it("ignores proposals that are not upgrades", () => {
    expect(findProposedUpgrade([textProposal(46)])).toBeNull();
    expect(findProposedUpgrade([])).toBeNull();
  });

  it("reads the raw gov v1 messages of a proposal from the REST fallback", () => {
    const raw = [
      {
        id: "47",
        status: "PROPOSAL_STATUS_VOTING_PERIOD",
        voting_end_time: "2026-10-14T14:57:00.392492330Z",
        messages: [
          {
            "@type": "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade",
            plan: { name: "v8", height: "90850000", info: "" },
          },
        ],
      },
    ];

    expect(findProposedUpgrade([textProposal(47)], raw)).toEqual({
      name: "v8",
      height: 90_850_000,
      proposalId: 47,
      votingEndTime: new Date("2026-10-14T14:57:00.392Z"),
    });
  });

  it("skips a raw gov v1 proposal that is no longer in its voting period", () => {
    const raw = [
      {
        id: "40",
        status: "PROPOSAL_STATUS_PASSED",
        messages: [
          {
            "@type": "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade",
            plan: { name: "v7", height: "72362000" },
          },
        ],
      },
    ];

    expect(findProposedUpgrade([], raw)).toBeNull();
  });

  it("picks the upgrade with the lowest height when two are in voting", () => {
    const found = findProposedUpgrade([
      upgradeProposal(49, "v9", 95_000_000),
      upgradeProposal(47, "v8", 90_850_000),
    ]);

    expect(found?.name).toBe("v8");
  });
});

describe("estimateTimeAtHeight: P1", () => {
  const latest = { height: 89_800_667, time: new Date("2026-10-11T18:29:27.174Z") };
  // 10,000 blocks earlier at the measured 0.7202 s a block
  const earlier = { height: 89_790_667, time: new Date(latest.time.getTime() - 7_202_000) };

  it("projects the measured block rate to the target height", () => {
    const eta = estimateTimeAtHeight(latest, earlier, 90_850_000);

    // 1,049,333 blocks x 0.7202 s = 755,729.6 s after 18:29:27.174Z
    expect(eta?.toISOString()).toBe("2026-10-20T12:24:56.800Z");
  });

  it("is null once the height is reached or passed", () => {
    expect(estimateTimeAtHeight(latest, earlier, latest.height)).toBeNull();
    expect(estimateTimeAtHeight(latest, earlier, 1)).toBeNull();
  });

  it("is null when the two blocks give no rate", () => {
    expect(estimateTimeAtHeight(latest, latest, 90_850_000)).toBeNull();
    expect(estimateTimeAtHeight(latest, { ...earlier, time: latest.time }, 90_850_000)).toBeNull();
  });
});
