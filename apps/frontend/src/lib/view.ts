import { type IssueQuery, readQuery } from "@entwine/shared";

/** A saved query that cannot be read is the default query. */
export function savedQuery(json: string): IssueQuery {
  try {
    return readQuery(JSON.parse(json));
  } catch {
    return readQuery({});
  }
}
