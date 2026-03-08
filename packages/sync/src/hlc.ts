export class HLC {
	constructor(
		public timestamp: number = Date.now(),
		public counter = 0,
	) {}

	/**
	 * Ticks the clock forward for a local event based on the current physical time.
	 */
	public send(now: number = Date.now()) {
		const timestampNew = Math.max(this.timestamp, now);
		this.counter = this.timestamp === timestampNew ? this.counter + 1 : 0;
		this.timestamp = timestampNew;
		return this;
	}

	/**
	 * Synchronizes the local clock with a remote HLC.
	 */
	public receive(remoteHLC: HLC, now: number = Date.now()) {
		const timestampNew = Math.max(this.timestamp, remoteHLC.timestamp, now);

		if (
			timestampNew === this.timestamp &&
			timestampNew === remoteHLC.timestamp
		) {
			this.counter = Math.max(this.counter, remoteHLC.counter) + 1;
		} else if (timestampNew === this.timestamp) {
			this.counter++;
		} else if (timestampNew === remoteHLC.timestamp) {
			this.counter = remoteHLC.counter + 1;
		} else {
			this.counter = 0;
		}

		this.timestamp = timestampNew;
		return this;
	}

	/**
	 * Checks the current HLC for high clock drift compared to physical time.
	 */
	public isValid(
		now: number = Date.now(),
		maxDrift: number = 60 * 1000,
	): boolean {
		return Math.abs(this.timestamp - now) <= maxDrift;
	}

	/**
	 * Serializes the HLC state into a string for database storage.
	 */
	public pack(node: string): string {
		return `${this.timestamp}-${this.counter}${node ? "-" : ""}${node}`;
	}
}
