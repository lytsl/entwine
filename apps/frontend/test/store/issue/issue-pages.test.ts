import { expect, test } from "bun:test";
import type { Row } from "@entwine/shared";
import { IssueIndex } from "../../../src/store/issue/issue-index";
import { IssuePages, PAGE } from "../../../src/store/issue/issue-pages";
import type { ChangeSource } from "../../../src/store/row-store";
import { issue } from "../../helpers/issue";

type Issue = Row<"Issue">;
type Query = { model: string; where?: Record<string, string[]>; limit?: number; offset?: number; count?: string[] };

/** A server of `count` issues, in number order, and a tab that holds what it was sent. */
function open(count: number) {
  const server = Array.from({ length: count }, (_, n) => issue(`i${n + 1}`));
  let deliver: Parameters<ChangeSource<Issue>["subscribeChanges"]>[0] = () => {};
  const none = { subscribeChanges: () => ({ unsubscribe() {} }) };
  const index = new IssueIndex({
    Issue: {
      subscribeChanges(to) {
        deliver = to;
        return { unsubscribe() {} };
      },
    },
    IssueLabel: none,
    IssueModule: none,
    IssueLink: none,
  });
  const requests: Query[][] = [];
  const ws = {
    rebuilds: 0,
    isLoaded: () => false,
    async find(queries: Query[]) {
      requests.push(queries);
      const rows: Issue[] = [];
      const counts: Record<number, { values: never[]; count: number }[]> = {};
      for (const [at, query] of queries.entries()) {
        if (query.model !== "Issue") continue;
        if (query.count) counts[at] = [{ values: [], count: server.length }];
        else if (query.limit) rows.push(...server.slice(query.offset ?? 0, (query.offset ?? 0) + query.limit));
        else if (Array.isArray(query.where?.id)) rows.push(...server.filter((i) => query.where?.id.includes(i.id)));
        else if (query.where?.parentId)
          rows.push(...server.filter((i) => query.where?.parentId.includes(i.parentId ?? "")));
      }
      deliver(rows.map((value) => ({ type: "update", value })));
      return { rows: { Issue: rows }, counts };
    },
  };
  const pages = new IssuePages(ws as never, index);
  index.listen(() => pages.settle());
  const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { server, index, ws, pages, requests, settled, put: (value: Issue) => deliver([{ type: "update", value }]) };
}

test("asks the server for the first issues, and for the next after those shown", async () => {
  const { pages, requests, settled } = open(PAGE + 20);
  const unwatch = pages.watch("all", { model: "Issue" });
  expect(pages.get("all")).toMatchObject({ loading: true });
  await settled();
  expect(requests[0]).toEqual([
    { model: "Issue", limit: PAGE, offset: 0 },
    { model: "Issue", where: undefined, any: undefined, count: [] } as never,
  ]);
  expect(pages.get("all")).toMatchObject({ total: PAGE + 20, loading: false, edge: { id: `i${PAGE}` } });
  expect(pages.whole("i1") && pages.whole(`i${PAGE}`)).toBe(true);
  expect(pages.whole(`i${PAGE + 1}`)).toBe(false);

  pages.more("all", PAGE);
  await settled();
  expect(requests.at(-2)?.[0]).toMatchObject({ limit: PAGE, offset: PAGE });
  // Everything is loaded: the list has no end to stop at.
  expect(pages.get("all")).toMatchObject({ total: PAGE + 20, edge: null });
  expect(pages.whole(`i${PAGE + 20}`)).toBe(true);
  unwatch();
});

test("makes whole an issue the stream brings alone, and takes one made here as it is", async () => {
  const { pages, server, requests, put, settled } = open(PAGE + 20);
  pages.watch("all", { model: "Issue" });
  await settled();
  const asked = requests.length;
  server[PAGE + 6].parentId = server[PAGE + 5].id;
  put({ ...server[PAGE + 5], priority: "urgent" });
  expect(pages.whole(`i${PAGE + 6}`)).toBe(false);
  await settled();
  expect(requests[asked][0]).toEqual({ model: "Issue", where: { id: [`i${PAGE + 6}`] } });
  expect(pages.whole(`i${PAGE + 6}`)).toBe(true);
  // Its sub-issue came with it, to be counted: nothing more is asked for that one.
  expect(pages.whole(`i${PAGE + 7}`)).toBe(false);
  // An issue already whole is not asked for again.
  put({ ...server[0], priority: "low" });
  await settled();
  expect(requests).toHaveLength(asked + 1);
  pages.made("new");
  expect(pages.whole("new")).toBe(true);
});

test("asks again when it stopped following, and after the tab loaded the workspace anew", async () => {
  const { pages, ws, index, requests, settled } = open(PAGE * 3);
  const unwatch = pages.watch("all", { model: "Issue" });
  await settled();
  pages.more("all", PAGE);
  await settled();
  unwatch();
  const asked = requests.length;
  pages.watch("all", { model: "Issue" });
  await settled();
  // As many as were loaded before.
  expect(requests[asked][0]).toMatchObject({ limit: PAGE * 2, offset: 0 });
  ws.rebuilds++;
  index.retouch(["i1"]);
  expect(pages.whole("i1")).toBe(false);
  await settled();
  expect(pages.whole("i1")).toBe(true);
});
