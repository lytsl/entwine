export function bigIntToBuffer(bigInt: bigint) {
	let hex = bigInt.toString(16);
	if (hex.length % 2 === 1) {
		hex = `0${hex}`;
	}
	return Buffer.from(hex, "hex");
}

export function bufferToBigInt(buffer: Buffer) {
	const hex = buffer.toString("hex");
	return hex.length === 0 ? 0n : BigInt(`0x${hex}`);
}
