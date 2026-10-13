import { type Priority, PriorityIcon } from "@entwine/ui/components/icons/priority-icon";
import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { CheckOption } from "@entwine/ui/components/ui/check-option";
import { CircularProgress } from "@entwine/ui/components/ui/circular-progress";
import { ColorPicker } from "@entwine/ui/components/ui/color-picker";
import { CountPill } from "@entwine/ui/components/ui/count-pill";
import { DatePicker } from "@entwine/ui/components/ui/date-picker";
import { type PropertyFace, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { SearchField } from "@entwine/ui/components/ui/search-field";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkIcon } from "lucide-react";
import { useState } from "react";

const meta = { title: "Base/Property controls" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function PriorityControl({ face }: { face: PropertyFace }) {
  const [value, setValue] = useState<Priority>("high");
  return (
    <PropertySelect<Priority>
      label={`Priority: ${value}`}
      face={face}
      options={(["urgent", "high", "medium", "low", "none"] as const).map((priority) => ({
        value: priority,
        label: priority,
        icon: <PriorityIcon priority={priority} />,
      }))}
      isSelected={(option) => option === value}
      onSelect={setValue}
    >
      <PriorityIcon priority={value} />
      {face !== "icon" && value}
    </PropertySelect>
  );
}

export const TriggerFaces: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-4">
      {(["pill", "field", "cell", "icon"] as const).map((face) => (
        <div key={face} className="flex h-10 items-center gap-4">
          <span className="w-12 shrink-0">{face}</span>
          <PriorityControl face={face} />
        </div>
      ))}
    </div>
  ),
};

export const MultipleSelection: Story = {
  render: function MultipleSelectionStory() {
    const [selected, setSelected] = useState(["Bug"]);
    return (
      <PropertySelect
        label="Labels"
        multiple
        options={["Bug", "Feature", "Documentation"].map((value) => ({ value, label: value }))}
        isSelected={(value) => selected.includes(value)}
        onSelect={(value) =>
          setSelected((current) =>
            current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
          )
        }
      >
        {selected.join(", ") || "No labels"}
      </PropertySelect>
    );
  },
};

export const ProjectsAndProgress: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {["WEB", "API", "UI"].map((identifier) => (
          <span key={identifier} className="flex items-center gap-2">
            <ProjectIcon project={{ id: identifier, identifier }} size={32} />
            {identifier}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {[0, 25, 50, 75, 100].map((value) => (
          <span key={value} className="flex items-center gap-2">
            <CircularProgress value={value} size={24} />
            {value}%
          </span>
        ))}
      </div>
    </div>
  ),
};

const COLORS = ["#eb5757", "#f2994a", "#4cb782", "#5e6ad2"];

export const DatesAndColors: Story = {
  render: function DatesAndColorsStory() {
    const [date, setDate] = useState<string | null>("2026-09-26");
    const [color, setColor] = useState(COLORS[0]!);
    return (
      <div className="flex items-center gap-4">
        <DatePicker label="Due date" icon="due" tone="soon" value={date} onChange={setDate} />
        <DatePicker label="Start date" face="field" value={null} onChange={() => {}} />
        <ColorPicker label="Label color" colors={COLORS} value={color} onChange={setColor} />
        <CountPill icon={<LinkIcon />} count={3} tooltip="3 links" />
      </div>
    );
  },
};

export const SearchAndOptions: Story = {
  render: function SearchAndOptionsStory() {
    const [search, setSearch] = useState("");
    const [checked, setChecked] = useState(["Bug"]);
    return (
      <div className="flex w-60 flex-col gap-2">
        <SearchField
          aria-label="Search labels"
          placeholder="Search labels…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {["Bug", "Feature", "Documentation"]
          .filter((label) => label.toLowerCase().includes(search.toLowerCase()))
          .map((label) => (
            <CheckOption
              key={label}
              label={label}
              checked={checked.includes(label)}
              onToggle={() =>
                setChecked((current) =>
                  current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
                )
              }
            />
          ))}
      </div>
    );
  },
};
