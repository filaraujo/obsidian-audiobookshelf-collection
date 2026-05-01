export interface Library {
	id: string;
	name: string;
	mediaType?: string;
}

export interface SeriesBookMetadata {
	title?: string;
	authorName?: string;
	publishedYear?: string;
	series?: {
		id?: string;
		name?: string;
		sequence?: string | null;
	};
}

export interface SeriesBook {
	id: string;
	media?: {
		metadata?: SeriesBookMetadata;
	};
}

export interface Series {
	id: string;
	name: string;
	books: SeriesBook[];
	totalDuration?: number;
	addedAt?: number;
}

export interface SeriesResponse {
	results: Series[];
	total: number;
	limit: number;
	page: number;
}

export interface LibrariesResponse {
	libraries: Library[];
}
