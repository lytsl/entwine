import type { Row } from "../../schemas";

/** `WEB-12`. */
export const issueKey = (project: Pick<Row<"Project">, "identifier">, issue: Pick<Row<"Issue">, "number">): string =>
  `${project.identifier}-${issue.number}`;
