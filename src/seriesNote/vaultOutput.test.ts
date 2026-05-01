import { describe, expect, it } from "vitest";
import type { Series } from "../api/types";
import { buildLibraryRollupRelativePath, uniqueSeriesNoteStem, vaultPathWithoutExtension } from "./vaultOutput";

function series(id: string, name: string): Series {
	return { id, name, books: [] };
}

describe("buildLibraryRollupRelativePath", () => {
	it("substitutes library segment and adds .md", () => {
		expect(buildLibraryRollupRelativePath("{{libraryName}}/Rollup", "My Lib")).toBe("My Lib/Rollup.md");
	});

	it("preserves existing .md suffix case-insensitively", () => {
		expect(buildLibraryRollupRelativePath("{{libraryName}}/x.MD", "A")).toBe("A/x.MD");
	});

	it("uses default pattern when empty", () => {
		expect(buildLibraryRollupRelativePath("   ", "Audio")).toBe("Audio/All Series.md");
	});
});

describe("vaultPathWithoutExtension", () => {
	it("strips trailing .md", () => {
		expect(vaultPathWithoutExtension("folder/Note.md")).toBe("folder/Note");
	});
});

describe("uniqueSeriesNoteStem", () => {
	it("deduplicates stems with id suffix then counter", () => {
		const used = new Set<string>();
		const a = series("id-aaa", "Dup");
		const b = series("id-bbb", "Dup");
		const stem1 = uniqueSeriesNoteStem(a, used);
		const stem2 = uniqueSeriesNoteStem(b, used);
		expect(stem1).toBe("Dup");
		expect(stem2).toBe("Dup-id-bbb");
	});
});
