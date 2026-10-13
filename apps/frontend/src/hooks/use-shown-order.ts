import { useLayoutEffect } from "react";
import type { LayoutProps } from "../types/issue-view";

/** Tells the issue view which issues a layout shows, in on-screen order, and that none are once it is gone. */
export function useShownOrder(order: LayoutProps["order"], ids: readonly string[]) {
  useLayoutEffect(() => {
    order.current = ids;
    return () => {
      order.current = [];
    };
  });
}
