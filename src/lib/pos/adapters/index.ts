import type { PosAdapter, PosVendor } from "../types";
import { cashpadAdapter } from "./cashpad";
import {
  csvAdapter,
  customAdapter,
  otherAdapter,
} from "./custom";
import { ladditionAdapter } from "./laddition";
import { lightspeedAdapter } from "./lightspeed";
import { squareAdapter } from "./square";
import { tillerAdapter } from "./tiller";
import { zeltyAdapter } from "./zelty";

const ADAPTERS: Record<PosVendor, PosAdapter> = {
  zelty: zeltyAdapter,
  cashpad: cashpadAdapter,
  tiller: tillerAdapter,
  laddition: ladditionAdapter,
  lightspeed: lightspeedAdapter,
  square: squareAdapter,
  csv: csvAdapter,
  custom: customAdapter,
  other: otherAdapter,
};

export function getPosAdapter(vendor: string): PosAdapter {
  const key = vendor as PosVendor;
  return ADAPTERS[key] ?? customAdapter;
}

export function listPosAdapters(): PosAdapter[] {
  return [
    zeltyAdapter,
    cashpadAdapter,
    tillerAdapter,
    ladditionAdapter,
    lightspeedAdapter,
    squareAdapter,
    csvAdapter,
    customAdapter,
    otherAdapter,
  ];
}

export { ADAPTERS };
