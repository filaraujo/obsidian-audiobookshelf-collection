import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type AudiobookshelfPlugin from "../main";
import { AudiobookshelfApiError, AudiobookshelfClient } from "../api/client";
import type { Library, Series, UserMediaProgress } from "../api/types";
import { renderTemplate } from "../template/render";
import { cappedProgressSecondsForSeries, formatHours, getSeriesDurationSeconds } from "../seriesNote/progressMath";
import { resolveLibraryTemplate, resolveSeriesTemplate } from "../seriesNote/templates";
import { toRenderedSeries } from "../seriesNote/rendering";
import type {
	IndividualSeriesTemplateContext,
	RenderedSeriesWithNoteLink,
	TemplateContext,
} from "../seriesNote/types";
import {
	buildLibraryRollupRelativePath,
	ensureFolderPath,
	normalizeFolderPath,
	overwriteLibraryRollupFile,
	safePathSegment,
	uniqueSeriesNoteStem,
	vaultDirectoryForFile,
	vaultPathWithoutExtension,
} from "../seriesNote/vaultOutput";

/** Fetches Audiobookshelf series and writes per-series markdown notes plus a library rollup for each configured library. */
export async function syncLibrarySeriesNotes(plugin: AudiobookshelfPlugin): Promise<void> {
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
		const [libTemplateResult, seriesTemplateResult] = await Promise.all([
			resolveLibraryTemplate(plugin),
			resolveSeriesTemplate(plugin),
		]);
		if (libTemplateResult.usedFallbackDueToMissingFile) {
			new Notice(
				"Audiobookshelf: library overview template file not found at the configured path; using built-in template.",
			);
		}
		if (seriesTemplateResult.usedFallbackDueToMissingFile) {
			new Notice(
				"Audiobookshelf: series note template file not found at the configured path; using built-in template.",
			);
		}
		libraryTemplate = libTemplateResult.content;
		seriesTemplate = seriesTemplateResult.content;
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
	const failures: string[] = [];
	const generatedAt = new Date().toLocaleString();

	for (const [index, libraryId] of settings.libraryIds.entries()) {
		try {
			const librarySeries = [...(perLibrary[index] ?? [])];
			librarySeries.sort((a, b) => a.name.localeCompare(b.name));
			const libraryTitle = libraryNameById.get(libraryId) ?? libraryId;
			const libraryFolderName = safePathSegment(libraryTitle);
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
			const libraryProgressSeconds = librarySeries.reduce(
				(sum, series) => sum + cappedProgressSecondsForSeries(series, progressByLibraryItemId),
				0,
			);

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
			failures.push(`${libraryTitle} — ${msg}`);
		}
	}

	let summary = `Audiobookshelf: wrote ${libraryFilesWritten} library overview(s) and ${seriesFilesWritten} series note(s).`;
	if (failures.length > 0) {
		const preview = failures.slice(0, 2).join("; ");
		summary += ` ${failures.length} library/libraries failed: ${preview}`;
		if (failures.length > 2) {
			summary += " …";
		}
	}
	new Notice(summary);
}
