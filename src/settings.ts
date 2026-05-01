export interface AudiobookshelfSettings {
	/** Base URL of the Audiobookshelf server (no trailing slash), e.g. https://abs.example.com */
	serverUrl: string;
	/** Bearer token from the Audiobookshelf user profile. */
	apiToken: string;
	/** IDs of the libraries the user wants to include. */
	libraryIds: string[];
	/** Vault-relative folder path where the note should be written. Empty means vault root. */
	folderLocation: string;
	/** File name (with .md extension) of the generated note. */
	outputFileName: string;
}

export const DEFAULT_SETTINGS: AudiobookshelfSettings = {
	serverUrl: "",
	apiToken: "",
	libraryIds: [],
	folderLocation: "",
	outputFileName: "audiobookshelf-series.md",
};
