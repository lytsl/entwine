import { useContext } from "react";
import { ShellContext } from "../contexts/shell";
import { type Shell } from "../types/shell";

export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell outside the workspace shell");
  return shell;
}
