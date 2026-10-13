import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "../constants";
import { name } from "./fields";

/** Copied into every workspace the person belongs to and sent to all its members, so the server bounds it. */
export const personName = name(255);

export const email = z.email("Enter an email address");

const newPassword = z.string().min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`);

export const signUpInput = z.object({ name: personName, email, password: newPassword });
/** A password chosen under other rules still signs in: only its presence is checked. */
const password = z.string().min(1, "Required");
export const signInInput = z.object({ email, password });

export const profileInput = signUpInput.pick({ name: true });
/** A new password is typed twice: a mistyped one would lock its holder out. */
const typedTwice = (input: { newPassword: string; confirmPassword: string }) =>
  input.newPassword === input.confirmPassword;
const mistyped = { path: ["confirmPassword"], message: "The passwords do not match" };

export const passwordInput = z
  .object({ currentPassword: password, newPassword, confirmPassword: password })
  .refine((input) => input.newPassword !== input.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password other than the current one",
  })
  .refine(typedTwice, mistyped);

export const forgotPasswordInput = z.object({ email });
export const resetPasswordInput = z.object({ newPassword, confirmPassword: password }).refine(typedTwice, mistyped);
export const changeEmailInput = z.object({ email });

/** What `GET /api/config` says of the server. */
export interface AppConfig {
  /** Whether mail reaches people: password reset and verification are offered only then. */
  mail: boolean;
  /** The server's VAPID key, which a browser subscribes to push with. */
  pushKey: string;
}
