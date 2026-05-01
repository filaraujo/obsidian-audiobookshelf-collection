export interface Library {
	id: string;
	name: string;
	mediaType?: string;
}

export interface SeriesBookMetadata {
	title?: string;
	authorName?: string;
	publishedYear?: string;
	description?: string;
	series?: {
		id?: string;
		name?: string;
		sequence?: string | null;
	};
}

export interface SeriesBook {
	id: string;
	isFinished?: boolean;
	progress?: {
		isFinished?: boolean;
		progress?: number;
		currentTime?: number;
		duration?: number;
	};
	mediaProgress?: {
		isFinished?: boolean;
		progress?: number;
		currentTime?: number;
		duration?: number;
	};
	userMediaProgress?: {
		isFinished?: boolean;
		progress?: number;
		currentTime?: number;
		duration?: number;
	};
	media?: {
		duration?: number | string;
		metadata?: SeriesBookMetadata;
		progress?: {
			isFinished?: boolean;
			progress?: number;
			currentTime?: number;
			duration?: number;
		};
		userMediaProgress?: {
			isFinished?: boolean;
			progress?: number;
			currentTime?: number;
			duration?: number;
		};
	};
}

export interface UserMediaProgress {
	id: string;
	libraryItemId: string;
	isFinished?: boolean;
	progress?: number;
	currentTime?: number;
	duration?: number;
}

export interface MeResponse {
	id: string;
	mediaProgress?: UserMediaProgress[];
}

export interface Series {
	id: string;
	name: string;
	books: SeriesBook[];
	totalDuration?: number | string;
	addedAt?: number;
	description?: string;
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
