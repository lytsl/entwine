/** The list holds the switch for single-key shortcuts: with them off it is reached from the palette. */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@entwine/ui/components/ui/dialog";
import { Input } from "@entwine/ui/components/ui/input";
import { Switch } from "@entwine/ui/components/ui/switch";
import { Fragment, useState } from "react";
import { SHORTCUT_GROUPS, SHORTCUTS, type ShortcutId } from "../../../../constants/shortcuts";
import { useSingleKeys } from "../../../../hooks/use-single-keys";
import { matches } from "../../../../lib/search";
import { keyLabels, keysOf } from "../../../../lib/shortcuts";
import { setSingleKeys } from "../../../../preferences/single-keys";
import { KeyCombination } from "./key-combination";

export function ShortcutHelp({ onClose }: { onClose(): void }) {
  const [search, setSearch] = useState("");
  const singleKeys = useSingleKeys();
  const shown = (Object.keys(SHORTCUTS) as ShortcutId[])
    .map((id) => ({ ...SHORTCUTS[id], keys: keysOf(id, true), on: keysOf(id, singleKeys) }))
    .filter((b) => matches(search, [b.label, b.group, ...b.keys.flatMap((k) => keyLabels(k).flat())]));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Single keys work outside text fields.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          aria-label="Filter shortcuts"
          placeholder="Filter shortcuts…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex items-center gap-3 rounded-md border px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span id="single-keys" className="text-body font-medium">
              Single-key shortcuts
            </span>
            <span id="single-keys-hint" className="text-caption text-muted-foreground">
              Turn off if speech input or a stray key sets them off. Shortcuts with Ctrl or ⌘, the arrows, Enter and
              Escape stay.
            </span>
          </div>
          <Switch
            aria-labelledby="single-keys"
            aria-describedby="single-keys-hint"
            checked={singleKeys}
            onCheckedChange={setSingleKeys}
          />
        </div>
        {/* Focusable, so that the keyboard can scroll a list that holds nothing else to focus. */}
        <div
          role="group"
          aria-label="Shortcuts"
          tabIndex={0}
          className="-mx-1 min-h-0 flex-1 overflow-y-auto rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SHORTCUT_GROUPS.map((group) => {
            const rows = shown.filter((b) => b.group === group);
            if (rows.length === 0) return null;
            return (
              <section key={group} aria-label={group} className="py-2">
                <h3 className="pb-1 text-caption font-medium text-muted-foreground">{group}</h3>
                {rows.map((b) => (
                  <div key={b.label} className="flex min-h-8 items-center gap-3 text-body">
                    <span className="flex-1">{b.label}</span>
                    {b.on.map((keys, i) => (
                      <Fragment key={String(keys)}>
                        {i > 0 && <span className="text-caption text-muted-foreground">or</span>}
                        <KeyCombination keys={keys} />
                      </Fragment>
                    ))}
                    {b.on.length === 0 && <span className="text-caption text-muted-foreground">Off</span>}
                  </div>
                ))}
              </section>
            );
          })}
          {shown.length === 0 && <p className="py-6 text-center text-body text-muted-foreground">No shortcuts match</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
