import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type AudiobookshelfPlugin from "../main";
import { AudiobookshelfApiError, AudiobookshelfClient } from "../api/client";
import { Library, Series, UserMediaProgress } from "../api/types";
import { renderTemplate } from "../template/render";
import seriesNoteTemplate from "../templates/series-note.md";

interface RenderedBook {
	id: string;
	title: string;
	coverUrl: string;
	authorName: string;
	publishedYear: string;
	sequence: string;
	isFinished: boolean;
	statusIcon: string;
}

interface RenderedSeries {
	id: string;
	name: string;
	bookCount: number;
	finishedBookCount: number;
	totalDurationHours: string;
	progressDurationHours: string;
	books: RenderedBook[];
}

interface TemplateContext {
	libraryTitle: string;
	generatedAt: string;
	serverUrl: string;
	libraryCount: number;
	seriesCount: number;
	series: RenderedSeries[];
}

export async function generateSeriesNote(plugin: AudiobookshelfPlugin): Promise<void> {
	const { settings, app } = plugin;

	if (!settings.serverUrl) {
		new Notice("Audiobookshelf: set the server URL in settings.");
		return;
	}
	if (!settings.apiToken) {
		new Notice("Audiobookshelf: set the API token in settings.");
		return;
	}
	if (settings.libraryIds.length === 0) {
		new Notice("Audiobookshelf: select at least one library in settings.");
		return;
	}
	if (!settings.outputFileName) {
		new Notice("Audiobookshelf: set the output file name in settings.");
		return;
	}

	new Notice("Audiobookshelf: fetching series...");

	const client = new AudiobookshelfClient({
		serverUrl: settings.serverUrl,
		apiToken: settings.apiToken,
	});

	let perLibrary: Series[][];
	let progressByLibraryItemId: Map<string, UserMediaProgress>;
	let libraries: Library[];
	try {
		[perLibrary, libraries, progressByLibraryItemId] = await Promise.all([
			Promise.all(settings.libraryIds.map((id) => client.getSeries(id))),
			client.getLibraries(),
			client.getMyMediaProgress().then(
				(progress) =>
					new Map(
						progress
							.filter((entry) => typeof entry.libraryItemId === "string" && entry.libraryItemId.length > 0)
							.map((entry) => [entry.libraryItemId, entry] as const),
					),
			),
		]);
	} catch (err) {
		const msg = err instanceof AudiobookshelfApiError ? err.message : String(err);
		new Notice(`Audiobookshelf: failed to fetch series — ${msg}`);
		return;
	}

	const libraryNameById = new Map(libraries.map((library) => [library.id, library.name]));

	let template: string;
	try {
		template = await resolveTemplate(plugin);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Audiobookshelf: template render failed — ${msg}`);
		return;
	}

	const folderPath = normalizeFolderPath(settings.folderLocation);
	if (folderPath) {
		const folder = app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) {
			new Notice(`Audiobookshelf: folder "${folderPath}" does not exist.`);
			return;
		}
	}
	let filesWritten = 0;
	let totalSeriesWritten = 0;
	for (const [index, libraryId] of settings.libraryIds.entries()) {
		const librarySeries = [...(perLibrary[index] ?? [])];
		librarySeries.sort((a, b) => a.name.localeCompare(b.name));
		const libraryTitle = libraryNameById.get(libraryId) ?? libraryId;

		const context: TemplateContext = {
			libraryTitle,
			generatedAt: new Date().toLocaleString(),
			serverUrl: settings.serverUrl,
			libraryCount: settings.libraryIds.length,
			seriesCount: librarySeries.length,
			series: librarySeries.map((series) =>
				toRenderedSeries(series, progressByLibraryItemId, settings.serverUrl),
			),
		};

		const rendered = renderTemplate(template, context);
		const outputFileName = buildLibraryFileName(settings.outputFileName, libraryTitle);
		const filePath = normalizePath(folderPath ? `${folderPath}/${outputFileName}` : outputFileName);

		const existing = app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			await app.vault.modify(existing, rendered);
		} else {
			await app.vault.create(filePath, rendered);
		}
		filesWritten += 1;
		totalSeriesWritten += librarySeries.length;
	}

	new Notice(`Audiobookshelf: wrote ${totalSeriesWritten} series across ${filesWritten} files.`);
}

function buildLibraryFileName(baseFileName: string, libraryTitle: string): string {
	const template = baseFileName.trim() || "{{libraryName}} Series";
	const safeLibraryName = libraryTitle.replace(/[\\/:"*?<>|]/g, "-").trim() || "Library";
	const resolved = template.split("{{libraryName}}").join(safeLibraryName).trim();
	return resolved.toLowerCase().endsWith(".md") ? resolved : `${resolved}.md`;
}

function normalizeFolderPath(folderLocation: string): string {
	const value = folderLocation.trim();
	if (!value || value === "/") {
		return "";
	}
	return normalizePath(value.replace(/^\/+/, ""));
}

async function resolveTemplate(plugin: AudiobookshelfPlugin): Promise<string> {
	const templatePath = plugin.settings.templateFilePath?.trim() ?? "";
	if (!templatePath) {
		return seriesNoteTemplate;
	}

	const file = plugin.app.vault.getAbstractFileByPath(templatePath);
	if (!(file instanceof TFile)) {
		return seriesNoteTemplate;
	}

	return await plugin.app.vault.cachedRead(file);
}

function toRenderedSeries(
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
		return {
			id: book.id,
			title: meta.title ?? "",
			coverUrl: buildBookCoverUrl(normalizedServerUrl, book.id),
			authorName: meta.authorName ?? "",
			publishedYear: meta.publishedYear ?? "",
			sequence: meta.series?.sequence ?? "",
			isFinished,
			statusIcon: isFinished ? "luc_bookmark_plus" : "luc_bookmark",
		};
	});

	books.sort((a, b) => compareSequences(a.sequence, b.sequence));

	const finishedBookCount = books.filter((book) => book.isFinished).length;
	const totalSeconds = getSeriesDurationSeconds(series);
	const totalProgressSeconds = (series.books ?? []).reduce((sum, book) => {
		const itemProgress = progressByLibraryItemId.get(book.id);
		const bookDurationSeconds = normalizeDurationToSeconds(book.media?.duration);
		const progressSeconds = getBookProgressSeconds(itemProgress, bookDurationSeconds);
		return sum + progressSeconds;
	}, 0);
	const progressSeconds =
		totalSeconds > 0 ? Math.min(totalProgressSeconds, totalSeconds) : totalProgressSeconds;

	return {
		id: series.id,
		name: series.name,
		bookCount: books.length,
		finishedBookCount,
		totalDurationHours: formatHours(totalSeconds),
		progressDurationHours: formatHours(progressSeconds),
		books,
	};
}

function buildBookCoverUrl(serverUrl: string, bookId: string): string {
	if (!serverUrl || !bookId) {
		return "";
	}
	return `${serverUrl}/api/items/${encodeURIComponent(bookId)}/cover`;
}

function getBookProgressSeconds(
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

function normalizeProgressRatio(value: unknown): number {
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

function formatHours(seconds: number): string {
	return (Math.max(0, seconds) / 3600).toFixed(1);
}

function getSeriesDurationSeconds(series: Series): number {
	const directDuration = normalizeDurationToSeconds(series.totalDuration);
	if (directDuration > 0) {
		return directDuration;
	}

	const summedBookDurations = (series.books ?? []).reduce((sum, book) => {
		return sum + normalizeDurationToSeconds(book.media?.duration);
	}, 0);

	return summedBookDurations;
}

function normalizeDurationToSeconds(value: unknown): number {
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

function parseNumericValue(value: unknown): number {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		return Number(value.trim());
	}
	return Number.NaN;
}

function compareSequences(a: string, b: string): number {
	const na = parseFloat(a);
	const nb = parseFloat(b);
	const aNum = Number.isFinite(na);
	const bNum = Number.isFinite(nb);
	if (aNum && bNum) return na - nb;
	if (aNum) return -1;
	if (bNum) return 1;
	return a.localeCompare(b);
}
