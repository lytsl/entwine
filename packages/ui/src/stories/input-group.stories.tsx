import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@entwine/ui/components/ui/input-group";
import { Kbd } from "@entwine/ui/components/ui/kbd";
import { Label } from "@entwine/ui/components/ui/label";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchIcon, SendHorizonalIcon } from "lucide-react";

const meta = { title: "Base/InputGroup", component: InputGroup } satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Search: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-2">
      <Label htmlFor="filter">Filter issues</Label>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput id="filter" placeholder="Title, identifier or assignee…" />
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

export const Prefixed: Story = {
  render: () => (
    <InputGroup className="w-96">
      <InputGroupAddon>
        <InputGroupText>ENT-</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="128" inputMode="numeric" />
    </InputGroup>
  ),
};

export const Comment: Story = {
  render: () => (
    <InputGroup className="w-96">
      <InputGroupTextarea placeholder="Leave a comment…" rows={3} />
      <InputGroupAddon align="block-end">
        <InputGroupText className="text-xs">Syncs on the next drain</InputGroupText>
        <InputGroupButton className="ml-auto" variant="default">
          <SendHorizonalIcon />
          Send
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};
