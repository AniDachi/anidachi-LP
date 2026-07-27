export interface LocalAudioLevelMeter {
	readonly track: MediaStreamTrack;
	close(): void;
	sample(): number | undefined;
}

export function createLocalAudioLevelMeter(
	stream: MediaStream,
	track: MediaStreamTrack,
): LocalAudioLevelMeter | null {
	if (typeof window.AudioContext !== "function") {
		return null;
	}

	let context: AudioContext;
	let source: MediaStreamAudioSourceNode;
	let analyser: AnalyserNode;
	try {
		context = new window.AudioContext();
		source = context.createMediaStreamSource(stream);
		analyser = context.createAnalyser();
		analyser.fftSize = 256;
		analyser.smoothingTimeConstant = 0.25;
		source.connect(analyser);
	} catch {
		return null;
	}

	const samples = new Float32Array(analyser.fftSize);
	let closed = false;

	const resume = () => {
		if (context.state === "suspended") {
			void context.resume().catch(() => undefined);
		}
	};
	resume();

	return {
		track,
		close() {
			if (closed) {
				return;
			}
			closed = true;
			source.disconnect();
			analyser.disconnect();
			void context.close().catch(() => undefined);
		},
		sample() {
			if (
				closed ||
				context.state === "closed" ||
				track.readyState !== "live" ||
				!track.enabled
			) {
				return undefined;
			}
			if (context.state === "suspended") {
				resume();
				return undefined;
			}

			analyser.getFloatTimeDomainData(samples);
			let squareSum = 0;
			for (const value of samples) {
				squareSum += value * value;
			}
			return Math.sqrt(squareSum / samples.length);
		},
	};
}
