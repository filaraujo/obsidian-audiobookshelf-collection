export interface AudiobookshelfSettings {
	/** Base URL of the Audiobookshelf server (no trailing slash), e.g. https://abs.example.com */
	serverUrl: string;
	/** Bearer token from the Audiobookshelf user profile. */
	apiToken: string;
	/** IDs of the libraries the user wants to include. */
	libraryIds: string[];
	/** Vault-relative folder path where the note should be written. Empty means vault root. */
	folderLocation: string;
	/** Vault-relative template for the library rollup note. Empty means built-in. */
	libraryTemplateFilePath: string;
	/** Vault-relative template for individual series notes. Empty means built-in. */
	seriesTemplateFilePath: string;
	/**
	 * Vault-relative path (from folder location) for the library rollup note.
	 * Supports `{{libraryName}}` (filesystem-safe segment matching the Audiobookshelf library name).
	 */
	outputFileName: string;
}

export const DEFAULT_SETTINGS: AudiobookshelfSettings = {
	serverUrl: "",
	apiToken: "",
	libraryIds: [],
	folderLocation: "",
	libraryTemplateFilePath: "",
	seriesTemplateFilePath: "",
	outputFileName: "{{libraryName}}/All Series",
};
