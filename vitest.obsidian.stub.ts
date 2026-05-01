/** Minimal stubs so Vitest can import modules that reference `obsidian`. */
export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

export class TFile {}

export class TFolder {}

export class Vault {}

export class Notice {
	constructor(public message: string) {}
}
