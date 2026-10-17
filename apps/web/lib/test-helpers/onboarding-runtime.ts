/** Minimal external-port test double; no extension or network is involved. */
export function onboardingRuntime(
	onRequest: (
		id: string,
		message: unknown,
		reply: (value: unknown) => void,
	) => void,
) {
	let disconnected = 0;
	return {
		get disconnected() {
			return disconnected;
		},
		connect(id: string) {
			let listener: (value: unknown) => void = () => {};
			return {
				postMessage(message: unknown) {
					onRequest(id, message, (value) => listener(value));
				},
				disconnect() {
					disconnected++;
				},
				onMessage: {
					addListener(value: typeof listener) {
						listener = value;
					},
				},
				onDisconnect: { addListener() {} },
			};
		},
	};
}
