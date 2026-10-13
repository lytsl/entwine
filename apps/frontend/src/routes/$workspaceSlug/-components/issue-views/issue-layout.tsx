import type { LayoutProps } from "../../../../types/issue-view";
import { IssueBoard } from "./board/issue-board";
import { IssueCalendar } from "./calendar/issue-calendar";
import { IssueList } from "./list/issue-list";
import { IssueSpreadsheet } from "./spreadsheet/issue-spreadsheet";
import { IssueTimeline } from "./timeline/issue-timeline";

export function IssueLayout(props: LayoutProps) {
  switch (props.query.layout) {
    case "spreadsheet":
      return <IssueSpreadsheet {...props} />;
    case "calendar":
      return <IssueCalendar {...props} />;
    case "timeline":
      return <IssueTimeline {...props} />;
    case "board":
      return <IssueBoard {...props} />;
    default:
      return <IssueList {...props} />;
  }
}
