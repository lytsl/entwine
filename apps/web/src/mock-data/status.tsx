import type { Collections } from "@/routes/$orgSlug/layout";
import type React from "react";

export type IssueStatus = Collections["IssueStatus"];

export const BacklogIcon: React.FC = () => {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="#bec2c8"
        strokeWidth="2"
        strokeDasharray="1.4 1.74"
        strokeDashoffset="0.65"
      />
      <circle
        className="progress"
        cx="7"
        cy="7"
        r="2"
        fill="none"
        stroke="#bec2c8"
        strokeWidth="4"
        strokeDasharray="0 100"
        strokeDashoffset="0"
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
};

export const PausedIcon: React.FC = () => {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="2"
        strokeDasharray="3.14 0"
        strokeDashoffset="-0.7"
      />
      <circle
        className="progress"
        cx="7"
        cy="7"
        r="2"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="4"
        strokeDasharray="6.2517693806436885 100"
        strokeDashoffset="0"
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
};

export const ToDoIcon: React.FC = () => {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="#e2e2e2"
        strokeWidth="2"
        strokeDasharray="3.14 0"
        strokeDashoffset="-0.7"
      />
      <circle
        className="progress"
        cx="7"
        cy="7"
        r="2"
        fill="none"
        stroke="#e2e2e2"
        strokeWidth="4"
        strokeDasharray="0 100"
        strokeDashoffset="0"
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
};

export const InProgressIcon: React.FC = () => {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="#facc15"
        strokeWidth="2"
        strokeDasharray="3.14 0"
        strokeDashoffset="-0.7"
      />
      <circle
        className="progress"
        cx="7"
        cy="7"
        r="2"
        fill="none"
        stroke="#facc15"
        strokeWidth="4"
        strokeDasharray="2.0839231268812295 100"
        strokeDashoffset="0"
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
};

export const TechnicalReviewIcon: React.FC = () => {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeDasharray="3.14 0"
        strokeDashoffset="-0.7"
      />
      <circle
        className="progress"
        cx="7"
        cy="7"
        r="2"
        fill="none"
        stroke="#22c55e"
        strokeWidth="4"
        strokeDasharray="4.167846253762459 100"
        strokeDashoffset="0"
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
};

export const CompletedIcon: React.FC = () => {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="#8b5cf6"
        strokeWidth="2"
        strokeDasharray="3.14 0"
        strokeDashoffset="-0.7"
      />
      <path
        d="M4.5 7L6.5 9L9.5 5"
        stroke="#8b5cf6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const status: IssueStatus[] = [];

export const IssueStatusTypeMap: Record<
  string,
  {
    color: string;
    icon: React.FC<{}>;
  }
> = {
  Backlog: { color: "#ec4899", icon: BacklogIcon },
  Planned: { color: "#f97316", icon: ToDoIcon },
  "In Progress": { color: "#facc15", icon: InProgressIcon },
  Completed: { color: "#8b5cf6", icon: CompletedIcon },
  Canceled: { color: "#0ea5e9", icon: PausedIcon },
};

export const StatusIcon: React.FC<{ type: string }> = ({ type }) => {
  const Icon = IssueStatusTypeMap[type].icon;
  if (!Icon) return null;
  return <Icon />;
};
