import type { MailUpdate } from "../mail/components/update-item";

/** One notification in a line, as a mail's title or a push's: "Bob moved WEB-12 to Done". */
export function headline({ actor, kind, to }: MailUpdate, key: string): string {
  if (kind === "assigned") return `${actor} assigned ${key} to you`;
  if (kind === "mentioned") return `${actor} mentioned you in ${key}`;
  if (kind === "commented") return `${actor} commented on ${key}`;
  return to ? `${actor} moved ${key} to ${to}` : `${actor} changed the state of ${key}`;
}
