import { useContext } from "react";
import { StoreContext } from "../contexts/store";
import type { Store } from "../store";

/** The shell's store, so that there is one however many ask. */
export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore needs the workspace shell");
  return store;
}
