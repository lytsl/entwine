import { DEFAULT_QUERY, type IssueQuery, issueQuery } from "../../schemas";

/** For untrusted input, such as a URL: each field that parses is kept, the others take `defaults`. */
export function readQuery(input: unknown, defaults: IssueQuery = DEFAULT_QUERY): IssueQuery {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const query = { ...defaults };
  for (const [key, schema] of Object.entries(issueQuery.shape)) {
    if (source[key] === undefined) continue;
    const result = schema.safeParse(source[key]);
    if (result.success) Object.assign(query, { [key]: result.data });
  }
  return query;
}

/** Whether `json` is a stored query: valid JSON of a query with no unknown keys. */
export function isIssueQuery(json: string): boolean {
  try {
    return issueQuery.strict().safeParse(JSON.parse(json)).success;
  } catch {
    return false;
  }
}
