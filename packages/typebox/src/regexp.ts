import { String, type TString, type TStringOptions } from "typebox";

export type TRegExp = TString;

export function RegExp(
	pattern: globalThis.RegExp,
	options: TStringOptions = {},
): TString {
	return String({ pattern, ...options });
}
