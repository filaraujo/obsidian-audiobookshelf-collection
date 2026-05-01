import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type AudiobookshelfPlugin from "../main";
import { AudiobookshelfApiError, AudiobookshelfClient } from "../api/client";
import { Series } from "../api/types";
import { renderTemplate } from "../template/render";
import seriesNoteTemplate from "../templates/series-note.md";

interface RenderedBook {
	title: string;
	authorName: string;
	publishedYear: string;
	sequence: string;
}

interface RenderedSeries {
	id: string;
	name: string;
	bookCount: number;
	totalDurationHours: string;
	books: RenderedBook[];
}

interface TemplateContext {
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
	try {
		perLibrary = await Promise.all(
			settings.libraryIds.map((id) => client.getSeries(id)),
		);
	} catch (err) {
		const msg = err instanceof AudiobookshelfApiError ? err.message : String(err);
		new Notice(`Audiobookshelf: failed to fetch series — ${msg}`);
		return;
	}

	const allSeries: Series[] = perLibrary.flat();
	allSeries.sort((a, b) => a.name.localeCompare(b.name));

	const context: TemplateContext = {
		generatedAt: new Date().toLocaleString(),
		serverUrl: settings.serverUrl,
		libraryCount: settings.libraryIds.length,
		seriesCount: allSeries.length,
		series: allSeries.map(toRenderedSeries),
	};

	let rendered: string;
	try {
		rendered = renderTemplate(seriesNoteTemplate, context);
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
	const filePath = normalizePath(
		folderPath ? `${folderPath}/${settings.outputFileName}` : settings.outputFileName,
	);

	const existing = app.vault.getAbstractFileByPath(filePath);
	let target: TFile;
	if (existing instanceof TFile) {
		await app.vault.modify(existing, rendered);
		target = existing;
	} else {
		target = await app.vault.create(filePath, rendered);
	}

	new Notice(`Audiobookshelf: wrote ${allSeries.length} series to ${target.path}`);
}

function normalizeFolderPath(folderLocation: string): string {
	const value = folderLocation.trim();
	if (!value || value === "/") {
		return "";
	}
	return normalizePath(value.replace(/^\/+/, ""));
}

function toRenderedSeries(series: Series): RenderedSeries {
	const books: RenderedBook[] = (series.books ?? []).map((book) => {
		const meta = book.media?.metadata ?? {};
		return {
			title: meta.title ?? "",
			authorName: meta.authorName ?? "",
			publishedYear: meta.publishedYear ?? "",
			sequence: meta.series?.sequence ?? "",
		};
	});

	books.sort((a, b) => compareSequences(a.sequence, b.sequence));

	const totalSeconds = typeof series.totalDuration === "number" ? series.totalDuration : 0;
	const totalDurationHours = (totalSeconds / 3600).toFixed(1);

	return {
		id: series.id,
		name: series.name,
		bookCount: books.length,
		totalDurationHours,
		books,
	};
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
