import { requestUrl, RequestUrlParam } from "obsidian";
import { LibrariesResponse, Library, Series, SeriesResponse } from "./types";

export class AudiobookshelfApiError extends Error {
	constructor(message: string, public readonly status?: number) {
		super(message);
		this.name = "AudiobookshelfApiError";
	}
}

export interface AudiobookshelfClientOptions {
	serverUrl: string;
	apiToken: string;
}

export class AudiobookshelfClient {
	private readonly baseUrl: string;
	private readonly token: string;

	constructor(opts: AudiobookshelfClientOptions) {
		this.baseUrl = opts.serverUrl.replace(/\/+$/, "");
		this.token = opts.apiToken;
	}

	async getLibraries(): Promise<Library[]> {
		const data = await this.request<LibrariesResponse>("/api/libraries");
		return data.libraries ?? [];
	}

	async getSeries(libraryId: string): Promise<Series[]> {
		const all: Series[] = [];
		const pageSize = 200;
		let page = 0;
		// Paginate defensively in case the server caps responses.
		// Audiobookshelf accepts limit=0 to return all in one call, but some
		// deployments still chunk results, so we walk pages until exhausted.
		while (true) {
			const path = `/api/libraries/${encodeURIComponent(libraryId)}/series?limit=${pageSize}&page=${page}`;
			const data = await this.request<SeriesResponse>(path);
			const results = data.results ?? [];
			all.push(...results);
			if (results.length < pageSize) break;
			if (typeof data.total === "number" && all.length >= data.total) break;
			page += 1;
			if (page > 1000) break;
		}
		return all;
	}

	private async request<T>(path: string): Promise<T> {
		if (!this.baseUrl) {
			throw new AudiobookshelfApiError("Server URL is not configured.");
		}
		if (!this.token) {
			throw new AudiobookshelfApiError("API token is not configured.");
		}

		const url = `${this.baseUrl}${path}`;
		const params: RequestUrlParam = {
			url,
			method: "GET",
			headers: {
				Authorization: `Bearer ${this.token}`,
				Accept: "application/json",
			},
			throw: false,
		};

		let response;
		try {
			response = await requestUrl(params);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			throw new AudiobookshelfApiError(`Network error contacting Audiobookshelf: ${msg}`);
		}

		if (response.status === 401 || response.status === 403) {
			throw new AudiobookshelfApiError(
				"Audiobookshelf rejected the API token (check the token in settings).",
				response.status,
			);
		}
		if (response.status === 404) {
			throw new AudiobookshelfApiError(
				`Audiobookshelf endpoint not found: ${path}`,
				response.status,
			);
		}
		if (response.status < 200 || response.status >= 300) {
			throw new AudiobookshelfApiError(
				`Audiobookshelf returned HTTP ${response.status} for ${path}.`,
				response.status,
			);
		}

		try {
			return response.json as T;
		} catch {
			throw new AudiobookshelfApiError("Audiobookshelf returned a non-JSON response.");
		}
	}
}
