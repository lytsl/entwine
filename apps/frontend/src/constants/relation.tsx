import type { RelationSide } from "@entwine/shared";
import { ArrowLeftRightIcon, BanIcon, CopyIcon, ShieldAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

export const SIDE_LABELS: Record<RelationSide, string> = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  relates_to: "Relates to",
  duplicate: "Duplicate of",
};

export const SIDE_ICONS: Record<RelationSide, ReactNode> = {
  blocks: <BanIcon />,
  blocked_by: <ShieldAlertIcon />,
  relates_to: <ArrowLeftRightIcon />,
  duplicate: <CopyIcon />,
};
