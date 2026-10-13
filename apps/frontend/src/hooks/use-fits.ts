import { useCallback, useState } from "react";

/**
 * Whether the `ref` element is at least `width` pixels wide. A container query only restyles: parts it hides stay in
 * the page twice, and parts it moves keep their old place in the tab order.
 */
export function useFits(width: number): [(element: HTMLElement | null) => (() => void) | undefined, boolean] {
  const [fits, setFits] = useState(true);
  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      const observer = new ResizeObserver(() => setFits(element.clientWidth >= width));
      setFits(element.clientWidth >= width);
      observer.observe(element);
      return () => observer.disconnect();
    },
    [width],
  );
  return [ref, fits];
}
