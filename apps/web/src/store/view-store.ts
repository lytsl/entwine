import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ViewType = "list" | "grid";

interface ViewState {
	viewType: ViewType;
	setViewType: (viewType: ViewType) => void;
}

export const useViewStore = create<ViewState>()(
	persist(
		(set) => ({
			viewType: "list",
			setViewType: (viewType: ViewType) => set({ viewType }),
		}),
		{
			name: "view-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
