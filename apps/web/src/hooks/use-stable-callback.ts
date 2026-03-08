import { useCallback, useLayoutEffect, useRef } from "react";

export function useCallbackStable<T extends any[], U>(
	callback: (...args: T) => U,
): (...args: T) => U {
	const callbackRef = useRef(callback);

	useLayoutEffect(() => {
		callbackRef.current = callback;
	});

	return useCallback((...args: T) => callbackRef.current(...args), []);
}
