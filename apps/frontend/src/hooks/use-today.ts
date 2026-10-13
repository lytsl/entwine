import { localToday } from "@entwine/shared";
import { useEffect, useState } from "react";

const untilMidnight = (now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();

/** Moves on at local midnight, and when the tab regains focus, since a sleeping machine can miss the timer. */
export function useToday(): string {
  const [today, setToday] = useState(localToday);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setToday(localToday());
      clearTimeout(timer);
      timer = setTimeout(refresh, untilMidnight() + 1000);
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
