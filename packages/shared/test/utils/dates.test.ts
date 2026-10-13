import { expect, test } from "bun:test";
import { addDays, dateIn, localToday, weekday } from "../../src";

test("dates are ISO calendar dates, across months and in the viewer's zone", () => {
  expect(addDays("2026-09-28", 6)).toBe("2026-10-04");
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  const local = new Date(2026, 0, 31, 23, 30);
  expect(localToday(local)).toBe("2026-01-31");
});

test("the date in a time zone is that zone's, whatever the machine's", () => {
  const evening = new Date("2026-10-18T20:00:00Z");
  expect(dateIn("UTC", evening)).toBe("2026-10-18");
  expect(dateIn("Asia/Kolkata", evening)).toBe("2026-10-19");
  expect(dateIn("America/New_York", evening)).toBe("2026-10-18");
  expect(dateIn("Pacific/Kiritimati", new Date("2026-12-31T10:00:00Z"))).toBe("2027-01-01");
});

test("weekdays count from Sunday", () => {
  expect(["2026-10-18", "2026-10-19", "2026-10-24"].map(weekday)).toEqual([0, 1, 6]);
});
