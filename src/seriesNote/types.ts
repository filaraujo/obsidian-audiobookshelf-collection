export interface RenderedBook {
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

export interface RenderedSeries {
	id: string;
	name: string;
	description: string;
	bookCount: number;
	finishedBookCount: number;
	totalDurationHours: string;
	progressDurationHours: string;
	books: RenderedBook[];
}

export interface RenderedSeriesWithNoteLink extends RenderedSeries {
	/** Wikilink target: vault-relative path without `.md`. */
	seriesNotePath: string;
}

export interface TemplateContext {
	libraryTitle: string;
	generatedAt: string;
	serverUrl: string;
	libraryCount: number;
	seriesCount: number;
	/** All books in this library rollup (sum of each series' books; a title in multiple series is counted multiple times). */
	bookCount: number;
	finishedBookCount: number;
	/** Sum of each series' total duration (same double-count caveat as `bookCount` if a book appears in multiple series). */
	totalDurationHours: string;
	/** Sum of each series' capped listening progress, in hours (1 decimal). */
	progressDurationHours: string;
	series: RenderedSeriesWithNoteLink[];
}

export interface IndividualSeriesTemplateContext {
	libraryTitle: string;
	/** Vault folder segment derived from library name (path-forbidden chars only replaced). */
	libraryFolderName: string;
	generatedAt: string;
	serverUrl: string;
	series: RenderedSeries;
}
