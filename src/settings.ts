export interface AudiobookshelfSettings {
	/** Base URL of the Audiobookshelf server (no trailing slash), e.g. https://abs.example.com */
	serverUrl: string;
	/** Bearer token from the Audiobookshelf user profile. */
	apiToken: string;
	/** IDs of the libraries the user wants to include. */
	libraryIds: string[];
	/** Vault-relative folder path where the note should be written. Empty means vault root. */
	folderLocation: string;
	/** Vault-relative template file path. Empty means use the built-in template. */
	templateFilePath: string;
	/** File name template for generated notes. Supports {{libraryName}}. */
	outputFileName: string;
}

export const DEFAULT_SETTINGS: AudiobookshelfSettings = {
	serverUrl: "",
	apiToken: "",
	libraryIds: [],
	folderLocation: "",
	templateFilePath: "",
	outputFileName: "{{libraryName}} Series",
};
