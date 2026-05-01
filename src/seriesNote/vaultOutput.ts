import { TFile, TFolder, Vault, normalizePath } from "obsidian";
import type { Series } from "../api/types";

/** Path segment safe for vault paths: trims and replaces forbidden characters. */
export function safePathSegment(title: string): string {
	const trimmed = title.trim();
	if (!trimmed) {
		return "Library";
	}
	return trimmed.replace(/[\\/:"*?<>|]/g, "-");
}

export function vaultPathWithoutExtension(pathToFile: string): string {
	const normalized = normalizePath(pathToFile);
	return normalized.toLowerCase().endsWith(".md") ? normalized.slice(0, -".md".length) : normalized;
}

export function normalizeFolderPath(folderLocation: string): string {
	const value = folderLocation.trim();
	if (!value || value === "/") {
		return "";
	}
	return normalizePath(value.replace(/^\/+/, ""));
}

/** Vault-relative markdown path under folder location (may include `/`). */
export function buildLibraryRollupRelativePath(pattern: string, libraryTitle: string): string {
	const template = pattern.trim() || "{{libraryName}}/All Series";
	const safeLibrarySegment = safePathSegment(libraryTitle);
	const resolved = template.split("{{libraryName}}").join(safeLibrarySegment).trim();
	return resolved.toLowerCase().endsWith(".md") ? resolved : `${resolved}.md`;
}

/** Parent folder path inside the vault, or null if file would live directly in a root folder. */
export function vaultDirectoryForFile(filePath: string): string | null {
	const normalized = normalizePath(filePath);
	const slash = normalized.lastIndexOf("/");
	return slash <= 0 ? null : normalized.slice(0, slash);
}

/** Obsidian resolves paths case-sensitively; disks are often case-insensitive, so lookups can miss existing notes. */
export function findMarkdownAtPathIgnoringCase(vault: Vault, normalizedPath: string): TFile | null {
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

export async function overwriteLibraryRollupFile(vault: Vault, rollupPath: string, content: string): Promise<void> {
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

export async function ensureFolderPath(vault: Vault, folderPath: string): Promise<void> {
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

export function uniqueSeriesNoteStem(series: Series, usedStems: Set<string>): string {
	const base = safePathSegment(series.name) || safePathSegment(series.id) || "Series";
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
