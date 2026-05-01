import { describe, expect, it } from "vitest";
import type { Series, UserMediaProgress } from "../api/types";
import {
	cappedProgressSecondsForSeries,
	compareSequences,
	getBookProgressSeconds,
	normalizeDurationToSeconds,
	normalizeProgressRatio,
	parseNumericValue,
} from "./progressMath";

describe("compareSequences", () => {
	it("sorts finite numeric sequences", () => {
		expect(compareSequences("2", "10")).toBeLessThan(0);
		expect(compareSequences("10", "2")).toBeGreaterThan(0);
	});

	it("places numeric before non-numeric", () => {
		expect(compareSequences("1", "a")).toBeLessThan(0);
		expect(compareSequences("b", "2")).toBeGreaterThan(0);
	});

	it("falls back to localeCompare for non-numeric", () => {
		expect(compareSequences("b", "a")).toBeGreaterThan(0);
	});
});

describe("normalizeDurationToSeconds", () => {
	it("treats large values as milliseconds", () => {
		expect(normalizeDurationToSeconds(12_000_000)).toBe(12_000);
	});

	it("keeps seconds when below threshold", () => {
		expect(normalizeDurationToSeconds(3600)).toBe(3600);
	});

	it("handles numeric strings", () => {
		expect(normalizeDurationToSeconds(" 90 ")).toBe(90);
	});
});

describe("normalizeProgressRatio", () => {
	it("maps percent-style values", () => {
		expect(normalizeProgressRatio(50)).toBe(0.5);
	});

	it("clamps above 100 to 1", () => {
		expect(normalizeProgressRatio(150)).toBe(1);
	});

	it("returns 0 for empty", () => {
		expect(normalizeProgressRatio(null)).toBe(0);
	});
});

describe("getBookProgressSeconds", () => {
	it("uses full book duration when finished", () => {
		const p: UserMediaProgress = {
			id: "p1",
			libraryItemId: "b1",
			isFinished: true,
		};
		expect(getBookProgressSeconds(p, 120)).toBe(120);
	});

	it("caps current time to book duration", () => {
		const p: UserMediaProgress = {
			id: "p1",
			libraryItemId: "b1",
			currentTime: 999,
		};
		expect(getBookProgressSeconds(p, 100)).toBe(100);
	});
});

describe("cappedProgressSecondsForSeries", () => {
	it("caps uncapped book sum to series duration", () => {
		const series: Series = {
			id: "s1",
			name: "S",
			books: [
				{ id: "b1", media: { duration: 60 } },
				{ id: "b2", media: { duration: 60 } },
			],
			totalDuration: 100,
		};
		const map = new Map<string, UserMediaProgress>([
			["b1", { id: "p1", libraryItemId: "b1", isFinished: true }],
			["b2", { id: "p2", libraryItemId: "b2", isFinished: true }],
		]);
		expect(cappedProgressSecondsForSeries(series, map)).toBe(100);
	});
});

describe("parseNumericValue", () => {
	it("parses strings and numbers", () => {
		expect(parseNumericValue(3)).toBe(3);
		expect(parseNumericValue(" 2.5 ")).toBe(2.5);
		expect(Number.isNaN(parseNumericValue("x"))).toBe(true);
	});
});
