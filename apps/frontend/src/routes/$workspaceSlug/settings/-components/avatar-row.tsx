import { Button } from "@entwine/ui/components/ui/button";
import { toast } from "@entwine/ui/components/ui/toast";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { useRef, useState } from "react";
import { avatarImage } from "../../../../lib/avatar-image";
import { removeAvatar, uploadAvatar } from "../../../../services/avatar";
import type { Member } from "../../../../types/rows";

/** The member directory brings the new picture back, here and to every workspace's members. */
export function AvatarRow({ member }: { member: Member }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const run = async (state: "uploading" | "removing", work: () => Promise<void>, done: string) => {
    setBusy(state);
    try {
      await work();
      toast.success(done);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <UserAvatar user={member} size={40} />
      <div className="flex min-w-40 flex-1 flex-col gap-0.5">
        <span className="text-body font-medium">Profile picture</span>
        <span className="text-body text-muted-foreground">
          Square pictures look best: others are cut to their middle.
        </span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Profile picture"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void run("uploading", async () => uploadAvatar(await avatarImage(file)), "Profile picture updated");
        }}
      />
      <div className="flex items-center gap-2">
        {member.image && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => run("removing", removeAvatar, "Profile picture removed")}
          >
            {busy === "removing" ? "Removing…" : "Remove"}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => input.current?.click()}>
          {busy === "uploading" ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </div>
  );
}
