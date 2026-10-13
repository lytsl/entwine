import { useSyncExternalStore } from "react";
import { followSingleKeys, singleKeys } from "../preferences/single-keys";

/** Decides which keys are bound, and which key hints are shown. */
export const useSingleKeys = (): boolean => useSyncExternalStore(followSingleKeys, singleKeys, () => true);
