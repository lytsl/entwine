import { Kbd, KbdGroup } from "@entwine/ui/components/ui/kbd";
import { Fragment } from "react";
import { type Keys } from "../../../../constants/shortcuts";
import { keyLabels } from "../../../../lib/shortcuts";

export function KeyCombination({ keys }: { keys: Keys }) {
  return (
    <KbdGroup>
      {keyLabels(keys).map((labels, i) => (
        <Fragment key={labels.join()}>
          {i > 0 && <span className="text-caption text-muted-foreground">then</span>}
          {labels.map((label) => (
            <Kbd key={label}>{label}</Kbd>
          ))}
        </Fragment>
      ))}
    </KbdGroup>
  );
}
