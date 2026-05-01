import type { Series, UserMediaProgress } from "../api/types";

export function parseNumericValue(value: unknown): number {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		return Number(value.trim());
	}
	return Number.NaN;
}

export function normalizeDurationToSeconds(value: unknown): number {
	if (value == null) {
		return 0;
	}

	const parsed = parseNumericValue(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return 0;
	}

	// Some API responses may provide milliseconds instead of seconds.
	return parsed > 10_000_000 ? parsed / 1000 : parsed;
}

export function normalizeProgressRatio(value: unknown): number {
	if (value == null) {
		return 0;
	}

	const parsed = parseNumericValue(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return 0;
	}

	if (parsed > 1 && parsed <= 100) {
		return parsed / 100;
	}
	return Math.min(parsed, 1);
}

export function getBookProgressSeconds(
	progressEntry: UserMediaProgress | undefined,
	bookDurationSeconds: number,
): number {
	if (!progressEntry) {
		return 0;
	}

	if (progressEntry.isFinished === true) {
		if (bookDurationSeconds > 0) {
			return bookDurationSeconds;
		}
	}

	const currentTimeSeconds = normalizeDurationToSeconds(progressEntry.currentTime);
	if (currentTimeSeconds > 0) {
		if (bookDurationSeconds > 0) {
			return Math.min(currentTimeSeconds, bookDurationSeconds);
		}
		return currentTimeSeconds;
	}

	const durationSeconds = normalizeDurationToSeconds(progressEntry.duration);
	const progressRatio = normalizeProgressRatio(progressEntry.progress);
	if (durationSeconds > 0 && progressRatio > 0) {
		const estimatedSeconds = durationSeconds * progressRatio;
		if (bookDurationSeconds > 0) {
			return Math.min(estimatedSeconds, bookDurationSeconds);
		}
		return estimatedSeconds;
	}

	return 0;
}

export function hasBookStarted(book: Series["books"][number], progressEntry: UserMediaProgress | undefined): boolean {
	const progressSignals = [
		progressEntry?.currentTime,
		progressEntry?.progress,
		progressEntry?.duration,
		book.progress?.currentTime,
		book.mediaProgress?.currentTime,
		book.userMediaProgress?.currentTime,
		book.media?.progress?.currentTime,
		book.media?.userMediaProgress?.currentTime,
	];
	for (const signal of progressSignals) {
		if (parseNumericValue(signal) > 0) {
			return true;
		}
	}

	const ratioSignals = [
		progressEntry?.progress,
		book.progress?.progress,
		book.mediaProgress?.progress,
		book.userMediaProgress?.progress,
		book.media?.progress?.progress,
		book.media?.userMediaProgress?.progress,
	];
	for (const ratio of ratioSignals) {
		if (normalizeProgressRatio(ratio) > 0) {
			return true;
		}
	}

	return false;
}

export function compareSequences(a: string, b: string): number {
	const na = parseFloat(a);
	const nb = parseFloat(b);
	const aNum = Number.isFinite(na);
	const bNum = Number.isFinite(nb);
	if (aNum && bNum) return na - nb;
	if (aNum) return -1;
	if (bNum) return 1;
	return a.localeCompare(b);
}

export function formatHours(seconds: number): string {
	return (Math.max(0, seconds) / 3600).toFixed(1);
}

export function getSeriesDurationSeconds(series: Series): number {
	const directDuration = normalizeDurationToSeconds(series.totalDuration);
	if (directDuration > 0) {
		return directDuration;
	}

	const summedBookDurations = (series.books ?? []).reduce((sum, book) => {
		return sum + normalizeDurationToSeconds(book.media?.duration);
	}, 0);

	return summedBookDurations;
}

/** Sum of per-book progress for the series, capped at the series total duration when known. */
export function cappedProgressSecondsForSeries(
	series: Series,
	progressByLibraryItemId: Map<string, UserMediaProgress>,
): number {
	const totalSeconds = getSeriesDurationSeconds(series);
	const totalProgressSeconds = (series.books ?? []).reduce((sum, book) => {
		const itemProgress = progressByLibraryItemId.get(book.id);
		const bookDurationSeconds = normalizeDurationToSeconds(book.media?.duration);
		return sum + getBookProgressSeconds(itemProgress, bookDurationSeconds);
	}, 0);
	return totalSeconds > 0 ? Math.min(totalProgressSeconds, totalSeconds) : totalProgressSeconds;
}
