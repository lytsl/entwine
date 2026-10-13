/** The issue view holds the selection for the list, board and spreadsheet; calendar and timeline provide none. */
import { createContext } from "react";
import type { Selection } from "../types/issue-view";

export const SelectionContext = createContext<Selection | null>(null);
