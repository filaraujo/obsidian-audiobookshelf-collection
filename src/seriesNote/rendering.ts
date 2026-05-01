import type { Series, UserMediaProgress } from "../api/types";
import type { RenderedBook, RenderedSeries } from "./types";
import { cappedProgressSecondsForSeries, compareSequences, formatHours, getSeriesDurationSeconds, hasBookStarted } from "./progressMath";

function buildBookImageUrl(serverUrl: string, bookId: string): string {
	if (!serverUrl || !bookId) {
		return "";
	}
	return `${serverUrl}/api/items/${encodeURIComponent(bookId)}/cover`;
}

function getSeriesDescription(series: Series): string {
	if (typeof series.description === "string" && series.description.trim().length > 0) {
		return series.description.trim();
	}
	for (const book of series.books ?? []) {
		const metaDescription = book.media?.metadata?.description;
		if (typeof metaDescription === "string" && metaDescription.trim().length > 0) {
			return metaDescription.trim();
		}
	}
	return "";
}

export function toRenderedSeries(
	series: Series,
	progressByLibraryItemId: Map<string, UserMediaProgress>,
	serverUrl: string,
): RenderedSeries {
	const normalizedServerUrl = serverUrl.replace(/\/+$/, "");
	const books: RenderedBook[] = (series.books ?? []).map((book) => {
		const meta = book.media?.metadata ?? {};
		const itemProgress = progressByLibraryItemId.get(book.id);
		const isFinished =
			itemProgress?.isFinished === true ||
			book.isFinished === true ||
			book.progress?.isFinished === true ||
			book.mediaProgress?.isFinished === true ||
			book.userMediaProgress?.isFinished === true ||
			book.media?.progress?.isFinished === true ||
			book.media?.userMediaProgress?.isFinished === true;
		const hasStarted = hasBookStarted(book, itemProgress);
		const imageUrl = buildBookImageUrl(normalizedServerUrl, book.id);
		return {
			id: book.id,
			title: meta.title ?? "",
			description: typeof meta.description === "string" ? meta.description.trim() : "",
			imageUrl,
			coverUrl: imageUrl,
			authorName: meta.authorName ?? "",
			publishedYear: meta.publishedYear ?? "",
			sequence: meta.series?.sequence ?? "",
			isFinished,
			statusIcon: isFinished ? "luc_bookmark_plus" : hasStarted ? "luc_book_open" : "luc_bookmark",
			statusLabel: isFinished ? "Finished" : hasStarted ? "In progress" : "Not started",
		};
	});

	books.sort((a, b) => compareSequences(a.sequence, b.sequence));

	const finishedBookCount = books.filter((book) => book.isFinished).length;
	const totalSeconds = getSeriesDurationSeconds(series);
	const progressSeconds = cappedProgressSecondsForSeries(series, progressByLibraryItemId);

	return {
		id: series.id,
		name: series.name,
		description: getSeriesDescription(series),
		bookCount: books.length,
		finishedBookCount,
		totalDurationHours: formatHours(totalSeconds),
		progressDurationHours: formatHours(progressSeconds),
		books,
	};
}
