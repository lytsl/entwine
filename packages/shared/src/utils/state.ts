import { DEFAULT_STATES } from "../constants";
import type { Row } from "../schemas";
import { pairId } from "./id";

export const defaultStates = (projectId: string): Row<"State">[] =>
  DEFAULT_STATES.map((state, position) => ({
    id: pairId(projectId, state.group),
    projectId,
    position,
    ...state,
  }));
