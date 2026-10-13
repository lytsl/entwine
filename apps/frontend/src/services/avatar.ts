/** Throws the server's refusal. */
async function send(init: RequestInit): Promise<void> {
  const response = await fetch("/api/avatar", { ...init, credentials: "same-origin" });
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? "The picture could not be saved");
}

export const uploadAvatar = (picture: Blob) =>
  send({ method: "PUT", body: picture, headers: { "Content-Type": picture.type } });

export const removeAvatar = () => send({ method: "DELETE" });
