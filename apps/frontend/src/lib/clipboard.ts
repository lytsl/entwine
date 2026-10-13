import { toast } from "@entwine/ui/components/ui/toast";

/** The clipboard is missing outside a secure context, where nothing is copied. */
export function copyText(text: string, message = "Link copied"): void {
  void navigator.clipboard?.writeText(text);
  toast.success(message);
}
