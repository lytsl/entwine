import { type Priority, PriorityIcon } from "@entwine/ui/components/icons/priority-icon";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { SelectMenu } from "@entwine/ui/components/ui/select-menu";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

const meta = { title: "Base/Issue primitives" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PRIORITIES: { value: Priority; label: string; short: string }[] = [
  { value: "none", label: "No priority", short: "—" },
  { value: "urgent", label: "Urgent", short: "P1" },
  { value: "high", label: "High", short: "P2" },
  { value: "medium", label: "Medium", short: "P3" },
  { value: "low", label: "Low", short: "P4" },
];

const STATES = [
  { id: "backlog", name: "Backlog", type: "backlog", color: "#95a2b3" },
  { id: "todo", name: "Todo", type: "unstarted", color: "#e2e2e2" },
  { id: "doing", name: "In progress", type: "started", color: "#f2c94c" },
  { id: "done", name: "Done", type: "completed", color: "#5e6ad2" },
  { id: "dropped", name: "Cancelled", type: "cancelled", color: "#95a2b3" },
];

const PEOPLE = [
  { id: "usr_ravi", name: "Ravi Krishnan" },
  { id: "usr_ama", name: "Ama Mensah" },
  { id: "usr_tomas", name: "Tomás Silva" },
];

export const Icons: Story = {
  render: () => (
    <div className="flex flex-col gap-6 text-foreground">
      <div className="flex items-center gap-4">
        {PRIORITIES.map((priority) => (
          <span key={priority.value} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <PriorityIcon priority={priority.value} />
            {priority.short}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {STATES.map((state) => (
          <span key={state.id} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <StateIcon type={state.type} color={state.color} />
            {state.name}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {PEOPLE.map((person) => (
          <UserAvatar key={person.id} user={person} size={24} />
        ))}
        <UserAvatar user={null} size={24} />
      </div>
    </div>
  ),
};

export const RowMenus: Story = {
  render: function RowMenusStory() {
    const [stateId, setStateId] = useState("doing");
    const [priority, setPriority] = useState<Priority>("high");
    const [assigneeId, setAssigneeId] = useState<string | null>("usr_ama");
    const state = STATES.find((candidate) => candidate.id === stateId);
    const assignee = PEOPLE.find((person) => person.id === assigneeId);

    return (
      <div className="flex items-center gap-2 text-foreground">
        <SelectMenu<string>
          value={stateId}
          onSelect={setStateId}
          title="Change status"
          items={STATES.map((candidate) => ({
            value: candidate.id,
            label: candidate.name,
            icon: <StateIcon type={candidate.type} color={candidate.color} />,
          }))}
          trigger={
            <span className="flex items-center gap-1.5">
              {state && <StateIcon type={state.type} color={state.color} />}
              {state?.name}
            </span>
          }
        />
        <SelectMenu<Priority>
          value={priority}
          onSelect={setPriority}
          title="Set priority"
          items={PRIORITIES.map((candidate) => ({
            value: candidate.value,
            label: candidate.label,
            icon: <PriorityIcon priority={candidate.value} />,
            hint: candidate.short,
          }))}
          trigger={<PriorityIcon priority={priority} />}
        />
        <SelectMenu<string | null>
          value={assigneeId}
          onSelect={setAssigneeId}
          align="right"
          title="Assign to"
          items={[
            { value: null, label: "Unassigned", icon: <UserAvatar user={null} size={16} /> },
            ...PEOPLE.map((person) => ({
              value: person.id,
              label: person.name,
              icon: <UserAvatar user={person} size={16} />,
            })),
          ]}
          trigger={<UserAvatar user={assignee} size={18} />}
        />
      </div>
    );
  },
};
