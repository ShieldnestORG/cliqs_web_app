export type HookName =
  | "beforePolicyEval"
  | "beforeVote"
  | "afterVote"
  | "beforeExecute"
  | "afterBuildTx"
  | "afterSignTx"
  | "duringBroadcast"
  | "afterBroadcast"
  | "onWebsocketEvent"
  | "onReconcile";

export type Fault = {
  name: string;
  hook: HookName;
  once?: boolean;
  run: (ctx: { meta?: any }) => void | Promise<void>;
};

export class FaultController {
  private faults: Fault[] = [];
  private fired = new Set<string>();

  // shared "mutable reality" knobs (used by tests + patches)
  public state = {
    emergencyPaused: false,
    safeMode: false,
    policyVersion: 1,
    expectedPolicyVersion: 1,

    // credential "truth" at evaluation time
    credentialValid: true,

    // websocket reliability
    websocketDropRate: 0, // 0..1
  };

  reset() {
    this.faults = [];
    this.fired.clear();
    this.state = {
      emergencyPaused: false,
      safeMode: false,
      policyVersion: 1,
      expectedPolicyVersion: 1,
      credentialValid: true,
      websocketDropRate: 0,
    };
  }

  addFault(f: Fault) {
    this.faults.push(f);
  }

  addFaults(fs: Fault[]) {
    fs.forEach((f) => this.addFault(f));
  }

  async fire(hook: HookName, meta?: any) {
    const matches = this.faults.filter((f) => f.hook === hook);
    for (const f of matches) {
      if (f.once && this.fired.has(f.name)) continue;
      await f.run({ meta });
      if (f.once) this.fired.add(f.name);
    }
  }
}

// singleton used by patches + tests
export const faultController = new FaultController();
