import { faultController, type Fault } from "./faults";

export type ScheduledEvent = {
  atMs: number;
  name: string;
  run: () => void | Promise<void>;
};

export class ChaosHarness {
  private nowMs = 1_700_000_000_000;
  private events: ScheduledEvent[] = [];

  setNow(ms: number) {
    this.nowMs = ms;
  }

  now() {
    return this.nowMs;
  }

  schedule(atMs: number, name: string, run: () => void | Promise<void>) {
    this.events.push({ atMs, name, run });
    this.events.sort((a, b) => a.atMs - b.atMs);
  }

  async runAll() {
    for (const ev of this.events) {
      this.nowMs = ev.atMs;
      await ev.run();
    }
  }

  async runScenario(opts: {
    name: string;
    faults?: Fault[];
    scenario: (h: ChaosHarness) => Promise<void>;
  }) {
    faultController.reset();
    if (opts.faults) faultController.addFaults(opts.faults);

    await opts.scenario(this);
    await this.runAll();
  }
}
