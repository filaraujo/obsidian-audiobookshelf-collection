import { TFile } from "obsidian";
import type AudiobookshelfPlugin from "../main";
import libraryNoteTemplate from "../templates/library-note.md";
import seriesNoteTemplate from "../templates/series-note.md";

async function resolveTemplateFromSettings(
	plugin: AudiobookshelfPlugin,
	pathSetting: string | undefined,
	bundled: string,
): Promise<{ content: string; usedFallbackDueToMissingFile: boolean }> {
	const templatePath = pathSetting?.trim() ?? "";
	if (!templatePath) {
		return { content: bundled, usedFallbackDueToMissingFile: false };
	}

	const file = plugin.app.vault.getAbstractFileByPath(templatePath);
	if (!(file instanceof TFile)) {
		return { content: bundled, usedFallbackDueToMissingFile: true };
	}

	return { content: await plugin.app.vault.cachedRead(file), usedFallbackDueToMissingFile: false };
}

export async function resolveLibraryTemplate(
	plugin: AudiobookshelfPlugin,
): Promise<{ content: string; usedFallbackDueToMissingFile: boolean }> {
	return resolveTemplateFromSettings(plugin, plugin.settings.libraryTemplateFilePath, libraryNoteTemplate);
}

export async function resolveSeriesTemplate(
	plugin: AudiobookshelfPlugin,
): Promise<{ content: string; usedFallbackDueToMissingFile: boolean }> {
	return resolveTemplateFromSettings(plugin, plugin.settings.seriesTemplateFilePath, seriesNoteTemplate);
}
