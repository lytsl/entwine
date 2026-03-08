import { getRandomFloat, getRandomInt } from "./number";

export function getRandomSafeColor() {
	return `oklch(0.618 ${getRandomFloat(0.09, 0.14, 2)} ${getRandomInt(1, 360)})`;
}
