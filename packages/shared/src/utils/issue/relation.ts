import type { RelationSide } from "../../constants";
import type { Row } from "../../schemas";

export function relationSide(
  relation: Pick<Row<"IssueRelation">, "issueId" | "relatedId" | "type">,
  issueId: string,
): { side: RelationSide; otherId: string } {
  const from = relation.issueId === issueId;
  const otherId = from ? relation.relatedId : relation.issueId;
  if (relation.type === "blocks") return { side: from ? "blocks" : "blocked_by", otherId };
  return { side: relation.type as RelationSide, otherId };
}
