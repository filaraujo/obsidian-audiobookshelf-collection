import { Notice, TFile, TFolder, Vault, normalizePath } from "obsidian";
import type AudiobookshelfPlugin from "../main";
import { AudiobookshelfApiError, AudiobookshelfClient } from "../api/client";
import { Library, Series, UserMediaProgress } from "../api/types";
import { renderTemplate } from "../template/render";
import libraryNoteTemplate from "../templates/library-note.md";
import seriesNoteTemplate from "../templates/series-note.md";

interface RenderedBook {
	id: string;
	title: string;
	description: string;
	/** Absolute Audiobookshelf URL for this book's cover (`/api/items/:id/cover`; matches `coverUrl`). */
	imageUrl: string;
	/** Same as `imageUrl`; kept so existing custom templates using `coverUrl` still work. */
	coverUrl: string;
	authorName: string;
	publishedYear: string;
	sequence: string;
	isFinished: boolean;
	statusIcon: string;
	statusLabel: string;
}

interface RenderedSeries {
	id: string;
	name: string;
	description: string;
	bookCount: number;
	finishedBookCount: number;
	totalDurationHours: string;
	progressDurationHours: string;
	books: RenderedBook[];
}

interface RenderedSeriesWithNoteLink extends RenderedSeries {
	/** Wikilink target: vault-relative path without `.md`. */
	seriesNotePath: string;
}

interface TemplateContext {
	libraryTitle: string;
	generatedAt: string;
	serverUrl: string;
	libraryCount: number;
	seriesCount: number;
	/** All books in this library rollup (sum of each series’ books; a title in multiple series is counted multiple times). */
	bookCount: number;
	finishedBookCount: number;
	/** Sum of each series’ total duration (same double-count caveat as `bookCount` if a book appears in multiple series). */
	totalDurationHours: string;
	/** Sum of each series’ capped listening progress, in hours (1 decimal). */
	progressDurationHours: string;
	series: RenderedSeriesWithNoteLink[];
}

interface IndividualSeriesTemplateContext {
	libraryTitle: string;
	/** Vault folder segment derived from library name (path-forbidden chars only replaced). */
	libraryFolderName: string;
	generatedAt: string;
	serverUrl: string;
	series: RenderedSeries;
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

	let libraryTemplate: string;
	let seriesTemplate: string;
	try {
		[libraryTemplate, seriesTemplate] = await Promise.all([
			resolveLibraryTemplate(plugin),
			resolveSeriesTemplate(plugin),
		]);
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
	let libraryFilesWritten = 0;
	let seriesFilesWritten = 0;
	const generatedAt = new Date().toLocaleString();

	for (const [index, libraryId] of settings.libraryIds.entries()) {
		try {
			const librarySeries = [...(perLibrary[index] ?? [])];
			librarySeries.sort((a, b) => a.name.localeCompare(b.name));
			const libraryTitle = libraryNameById.get(libraryId) ?? libraryId;
			const libraryFolderName = filesystemSegmentFromLibraryName(libraryTitle);
			const librarySeriesDir = folderPath
				? normalizePath(`${folderPath}/${libraryFolderName}`)
				: libraryFolderName;

			await ensureFolderPath(app.vault, librarySeriesDir);

			const usedSeriesStems = new Set<string>();
			const seriesForRollup: RenderedSeriesWithNoteLink[] = [];

			for (const series of librarySeries) {
				const rendered = toRenderedSeries(series, progressByLibraryItemId, settings.serverUrl);
				const stem = uniqueSeriesNoteStem(series, usedSeriesStems);
				const seriesNotePathMd = normalizePath(`${librarySeriesDir}/${stem}.md`);
				const seriesNotePath = vaultPathWithoutExtension(seriesNotePathMd);

				const individualContext: IndividualSeriesTemplateContext = {
					libraryTitle,
					libraryFolderName,
					generatedAt,
					serverUrl: settings.serverUrl,
					series: rendered,
				};
				const individualRendered = renderTemplate(seriesTemplate, individualContext);

				const existingSeries = app.vault.getAbstractFileByPath(seriesNotePathMd);
				if (existingSeries instanceof TFile) {
					await app.vault.modify(existingSeries, individualRendered);
				} else {
					await app.vault.create(seriesNotePathMd, individualRendered);
				}
				seriesFilesWritten += 1;

				seriesForRollup.push({ ...rendered, seriesNotePath });
			}

			const bookCount = seriesForRollup.reduce((sum, s) => sum + s.bookCount, 0);
			const finishedBookCount = seriesForRollup.reduce((sum, s) => sum + s.finishedBookCount, 0);
			const libraryTotalSeconds = librarySeries.reduce(
				(sum, series) => sum + getSeriesDurationSeconds(series),
				0,
			);
			const libraryProgressSeconds = librarySeries.reduce((sum, series) => {
				const totalSeconds = getSeriesDurationSeconds(series);
				const totalProgressSeconds = (series.books ?? []).reduce((s, book) => {
					const itemProgress = progressByLibraryItemId.get(book.id);
					const bookDurationSeconds = normalizeDurationToSeconds(book.media?.duration);
					return s + getBookProgressSeconds(itemProgress, bookDurationSeconds);
				}, 0);
				const capped =
					totalSeconds > 0 ? Math.min(totalProgressSeconds, totalSeconds) : totalProgressSeconds;
				return sum + capped;
			}, 0);
			const context: TemplateContext = {
				libraryTitle,
				generatedAt,
				serverUrl: settings.serverUrl,
				libraryCount: settings.libraryIds.length,
				seriesCount: seriesForRollup.length,
				bookCount,
				finishedBookCount,
				totalDurationHours: formatHours(libraryTotalSeconds),
				progressDurationHours: formatHours(libraryProgressSeconds),
				series: seriesForRollup,
			};

			const renderedRollup = renderTemplate(libraryTemplate, context);
			const rollupRelative = buildLibraryRollupRelativePath(settings.outputFileName, libraryTitle);
			const rollupPath = normalizePath(folderPath ? `${folderPath}/${rollupRelative}` : rollupRelative);
			const rollupDir = vaultDirectoryForFile(rollupPath);
			if (rollupDir) {
				await ensureFolderPath(app.vault, rollupDir);
			}

			await overwriteLibraryRollupFile(app.vault, rollupPath, renderedRollup);
			libraryFilesWritten += 1;
		} catch (err) {
			const libraryTitle = libraryNameById.get(libraryId) ?? libraryId;
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Audiobookshelf: stopped on library "${libraryTitle}" — ${msg}`);
			return;
		}
	}

	new Notice(
		`Audiobookshelf: wrote ${libraryFilesWritten} library overview(s) and ${seriesFilesWritten} series note(s).`,
	);
}

/** Vault-relative markdown path under folder location (may include `/`). */
function buildLibraryRollupRelativePath(pattern: string, libraryTitle: string): string {
	const template = pattern.trim() || "{{libraryName}}/All Series";
	const safeLibrarySegment = filesystemSegmentFromLibraryName(libraryTitle);
	const resolved = template.split("{{libraryName}}").join(safeLibrarySegment).trim();
	return resolved.toLowerCase().endsWith(".md") ? resolved : `${resolved}.md`;
}

/** Parent folder path inside the vault, or null if file would live directly in a root folder. */
function vaultDirectoryForFile(filePath: string): string | null {
	const normalized = normalizePath(filePath);
	const slash = normalized.lastIndexOf("/");
	return slash <= 0 ? null : normalized.slice(0, slash);
}

/** Obsidian resolves paths case-sensitively; disks are often case-insensitive, so lookups can miss existing notes. */
function findMarkdownAtPathIgnoringCase(vault: Vault, normalizedPath: string): TFile | null {
	const direct = vault.getAbstractFileByPath(normalizedPath);
	if (direct instanceof TFile) {
		return direct;
	}
	const lastSlash = normalizedPath.lastIndexOf("/");
	const parentPath = lastSlash <= 0 ? "" : normalizedPath.slice(0, lastSlash);
	const targetName = (lastSlash <= 0 ? normalizedPath : normalizedPath.slice(lastSlash + 1)).toLowerCase();
	const parent = parentPath ? vault.getAbstractFileByPath(parentPath) : vault.getRoot();
	if (!(parent instanceof TFolder)) {
		return null;
	}
	for (const child of parent.children) {
		if (child instanceof TFile && child.name.toLowerCase() === targetName) {
			return child;
		}
	}
	return null;
}

async function overwriteLibraryRollupFile(vault: Vault, rollupPath: string, content: string): Promise<void> {
	const normalized = normalizePath(rollupPath);
	const atPath = vault.getAbstractFileByPath(normalized);
	if (atPath instanceof TFolder) {
		throw new Error(`Cannot write library overview: "${normalized}" is a folder.`);
	}
	let file = findMarkdownAtPathIgnoringCase(vault, normalized);
	if (file) {
		await vault.modify(file, content);
		return;
	}
	try {
		await vault.create(normalized, content);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (!/already exists/i.test(msg)) {
			throw err;
		}
		const retryAbstract = vault.getAbstractFileByPath(normalized);
		file =
			findMarkdownAtPathIgnoringCase(vault, normalized) ??
			(retryAbstract instanceof TFile ? retryAbstract : null);
		if (!file) {
			throw err;
		}
		await vault.modify(file, content);
	}
}

/** Path segment matching the Audiobookshelf library name aside from forbidden path characters. */
function filesystemSegmentFromLibraryName(libraryTitle: string): string {
	const trimmed = libraryTitle.trim();
	if (!trimmed) {
		return "Library";
	}
	return trimmed.replace(/[\\/:"*?<>|]/g, "-");
}

function vaultPathWithoutExtension(pathToFile: string): string {
	const normalized = normalizePath(pathToFile);
	return normalized.toLowerCase().endsWith(".md") ? normalized.slice(0, -".md".length) : normalized;
}

async function ensureFolderPath(vault: Vault, folderPath: string): Promise<void> {
	const parts = normalizePath(folderPath)
		.split("/")
		.filter((p) => p.length > 0);
	let acc = "";
	for (const part of parts) {
		acc = acc ? normalizePath(`${acc}/${part}`) : part;
		const existing = vault.getAbstractFileByPath(acc);
		if (existing instanceof TFolder) {
			continue;
		}
		if (existing instanceof TFile) {
			throw new Error(`"${acc}" exists as a file; cannot create folder.`);
		}
		await vault.createFolder(acc);
	}
}

function uniqueSeriesNoteStem(series: Series, usedStems: Set<string>): string {
	const base =
		filesystemSegmentFromLibraryName(series.name) ||
		filesystemSegmentFromLibraryName(series.id) ||
		"Series";
	let stem = base;
	if (!usedStems.has(stem)) {
		usedStems.add(stem);
		return stem;
	}
	const suffix = series.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "dup";
	stem = `${base}-${suffix}`;
	if (!usedStems.has(stem)) {
		usedStems.add(stem);
		return stem;
	}
	let n = 2;
	while (usedStems.has(`${stem}-${n}`)) {
		n += 1;
	}
	const finalStem = `${stem}-${n}`;
	usedStems.add(finalStem);
	return finalStem;
}

function normalizeFolderPath(folderLocation: string): string {
	const value = folderLocation.trim();
	if (!value || value === "/") {
		return "";
	}
	return normalizePath(value.replace(/^\/+/, ""));
}

async function resolveLibraryTemplate(plugin: AudiobookshelfPlugin): Promise<string> {
	const templatePath = plugin.settings.libraryTemplateFilePath?.trim() ?? "";
	if (!templatePath) {
		return libraryNoteTemplate;
	}

	const file = plugin.app.vault.getAbstractFileByPath(templatePath);
	if (!(file instanceof TFile)) {
		return libraryNoteTemplate;
	}

	return await plugin.app.vault.cachedRead(file);
}

async function resolveSeriesTemplate(plugin: AudiobookshelfPlugin): Promise<string> {
	const templatePath = plugin.settings.seriesTemplateFilePath?.trim() ?? "";
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
			statusIcon: isFinished
				? "luc_bookmark_plus"
				: hasStarted
					? "luc_book_open"
					: "luc_bookmark",
			statusLabel: isFinished
				? "Finished"
				: hasStarted
					? "In progress"
					: "Not started",
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
		description: getSeriesDescription(series),
		bookCount: books.length,
		finishedBookCount,
		totalDurationHours: formatHours(totalSeconds),
		progressDurationHours: formatHours(progressSeconds),
		books,
	};
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

function buildBookImageUrl(serverUrl: string, bookId: string): string {
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

function hasBookStarted(book: Series["books"][number], progressEntry: UserMediaProgress | undefined): boolean {
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
