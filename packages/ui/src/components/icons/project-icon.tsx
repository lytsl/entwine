import { avatarColor } from "@entwine/ui/components/ui/user-avatar";
import { cn, textColor } from "@entwine/ui/lib/utils";

/** The colour comes from the id, so a project needs no stored colour or emoji and looks the same in every tab. */
function ProjectIcon({
  project,
  size = 20,
  className,
}: {
  project: { id: string; identifier: string };
  size?: number;
  className?: string;
}) {
  const color = avatarColor(project.id);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[5px] font-semibold", className)}
      style={{
        width: size,
        height: size,
        color: textColor(color),
        background: `color-mix(in oklch, ${color} 18%, transparent)`,
        fontSize: Math.max(8, size * (project.identifier.length > 2 ? 0.34 : 0.44)),
      }}
    >
      {project.identifier.slice(0, 3)}
    </span>
  );
}

export { ProjectIcon };
