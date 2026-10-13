import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

/** An identity rather than a domain row, so this package need not know what a user is. */
export interface AvatarIdentity {
  id: string;
  name: string;
  /** A picture's address; its initials stand in until it loads, or if it does not. */
  image?: string | null;
}

const AVATAR_COLORS = ["#5e6ad2", "#26b5ce", "#f2994a", "#27ae60", "#bb6bd9", "#eb5757", "#2d9cdb", "#d65db1"];

/** The same hues, each darkened until its white initials have a contrast of 4.5:1 (WCAG 1.4.3). */
const AVATAR_FILLS = ["#5e6ad2", "#1b7f90", "#a26732", "#1e864a", "#9b59b4", "#c84a4a", "#247bad", "#b64f96"];

/** Picked from the id, so it is the same in every tab. */
function paletteIndex(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % AVATAR_COLORS.length;
}

/** For a tint: under white text the colour is `AVATAR_FILLS`. */
const avatarColor = (id: string): string => AVATAR_COLORS[paletteIndex(id)]!;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function UserAvatar({ user, size = 20 }: { user: AvatarIdentity | null | undefined; size?: number }) {
  if (!user) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground"
        style={{ width: size, height: size }}
        role="img"
        aria-label="Unassigned"
      >
        <svg viewBox="0 0 16 16" width={size * 0.6} height={size * 0.6}>
          <circle cx="8" cy="5.5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M2.8 13.5a5.2 5.2 0 0 1 10.4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }
  const style = {
    width: size,
    height: size,
    background: AVATAR_FILLS[paletteIndex(user.id)],
    fontSize: Math.max(9, size * 0.42),
  };
  const fill = "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white";
  if (!user.image)
    return (
      <span className={fill} style={style} title={user.name}>
        {initials(user.name)}
      </span>
    );
  return (
    <AvatarPrimitive.Root className="inline-flex shrink-0 overflow-hidden rounded-full" style={style} title={user.name}>
      <AvatarPrimitive.Image src={user.image} alt="" className="size-full object-cover" />
      <AvatarPrimitive.Fallback className={fill} style={style}>
        {initials(user.name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export { AVATAR_FILLS, avatarColor, UserAvatar };
