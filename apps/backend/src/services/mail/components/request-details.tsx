import { describeDevice, formatTime } from "../format";
import { Details } from "./details";

/** When and from which browser a security mail was asked for, for its holder to tell whether it was them. */
export function RequestDetails({ email, instance, request }: { email: string; instance: string; request?: Request }) {
  return (
    <Details
      title="Request details"
      rows={[
        ["Account", email],
        ["Instance", instance],
        ["Requested", formatTime(new Date())],
        ["Device", describeDevice(request?.headers.get("user-agent"))],
      ]}
    />
  );
}
