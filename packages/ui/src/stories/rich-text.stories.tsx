import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RichText } from "../components/editor/rich-text";

const meta = {
  title: "Tracker/RichText",
  component: RichText,
} satisfies Meta<typeof RichText>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE = `# Checkout fails on Safari

Paying with a saved card **throws** after the *second* step, and ~~only~~ on \`v2.3\`. See [the report](https://example.com/report).

## Steps

1. Open the cart
2. Pay with a saved card

- [x] Reproduced
- [ ] Fixed
  - [ ] Nested check

> The console says the token expired.

\`\`\`ts
export function pay(card: Card): Promise<Receipt> {
  // Retry once: tokens expire after 60 s.
  return gateway.charge(card.token, { retries: 1 });
}
\`\`\`

| Browser | Fails |
| --- | --- |
| Safari 18 | yes |
| Chrome 130 | no |

---

Line one
line two`;

function Playground({ initial, editable = true }: { initial: string; editable?: boolean }) {
  const [markdown, setMarkdown] = useState(initial);
  return (
    <div className="grid max-w-5xl grid-cols-2 gap-6">
      <RichText
        aria-label="Description"
        value={markdown}
        editable={editable}
        placeholder={editable ? "Add a description…" : "No description"}
        onChange={setMarkdown}
      />
      <pre className="overflow-auto rounded-md bg-muted p-3 text-caption whitespace-pre-wrap">{markdown}</pre>
    </div>
  );
}

export const Editable: Story = {
  args: { value: SAMPLE },
  render: () => <Playground initial={SAMPLE} />,
};

export const Empty: Story = {
  args: { value: "" },
  render: () => <Playground initial="" />,
};

export const ReadOnly: Story = {
  args: { value: SAMPLE },
  render: () => <Playground initial={SAMPLE} editable={false} />,
};
