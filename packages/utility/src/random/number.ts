export function getRandomInt(min: number, max: number): number {
	const minInt = Math.ceil(min);
	const maxInt = Math.floor(max);
	return Math.floor(Math.random() * (maxInt - minInt + 1)) + minInt;
}

export function getRandomFloat(min: number, max: number, decimals = 2): number {
	const str = (Math.random() * (max - min) + min).toFixed(decimals);
	return Number.parseFloat(str);
}
