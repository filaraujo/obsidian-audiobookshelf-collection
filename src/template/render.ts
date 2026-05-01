/**
 * Tiny mustache/handlebars-flavored template renderer.
 *
 * Supported syntax:
 *   - `{{path}}` — interpolates a value resolved against the current
 *     scope and any parent scope (ancestor lookup), e.g. `{{name}}` or
 *     `{{user.email}}`. `{{this}}` refers to the current scope value.
 *   - `{{#each list}}...{{/each}}` — iterates over an array. Inside the
 *     block, the current item becomes the scope. Parent lookups still
 *     work, so outer fields remain accessible.
 *   - `{{#if path}}...{{/if}}` — renders the body only if the resolved
 *     value is truthy (non-empty string, non-zero number, non-empty array,
 *     non-null object).
 *
 * Output is treated as plain text/markdown; no HTML escaping is performed.
 * Missing values render as the empty string.
 *
 * A trailing newline immediately after a block-opening or block-closing
 * tag (e.g. `{{#each x}}\n` and `{{/each}}\n`) is consumed so block
 * directives can occupy their own line without producing blank lines.
 */

type Scope = unknown;

interface RenderContext {
	stack: Scope[];
}

export function renderTemplate(template: string, data: unknown): string {
	const ctx: RenderContext = { stack: [data] };
	return renderString(template, ctx);
}

function renderString(input: string, ctx: RenderContext): string {
	let out = "";
	let i = 0;
	while (i < input.length) {
		const open = input.indexOf("{{", i);
		if (open === -1) {
			out += input.slice(i);
			break;
		}
		out += input.slice(i, open);
		const close = input.indexOf("}}", open + 2);
		if (close === -1) {
			out += input.slice(open);
			break;
		}
		const tag = input.slice(open + 2, close).trim();
		let cursor = close + 2;

		if (tag.startsWith("#each ")) {
			const path = tag.slice(6).trim();
			const { body, end } = readBlock(input, cursor, "each");
			cursor = end;
			const list = resolve(path, ctx);
			if (Array.isArray(list)) {
				for (const item of list) {
					ctx.stack.push(item);
					out += renderString(body, ctx);
					ctx.stack.pop();
				}
			}
		} else if (tag.startsWith("#if ")) {
			const path = tag.slice(4).trim();
			const { body, end } = readBlock(input, cursor, "if");
			cursor = end;
			if (isTruthy(resolve(path, ctx))) {
				out += renderString(body, ctx);
			}
		} else if (tag.startsWith("/")) {
			throw new Error(`Unexpected closing tag {{${tag}}}`);
		} else {
			const value = resolve(tag, ctx);
			out += stringify(value);
		}

		i = cursor;
	}
	return out;
}

/**
 * Read a block body up to the matching `{{/name}}` tag, supporting nested
 * blocks of the same name. Returns the body and the new cursor position
 * (after the closing tag and an optional trailing newline).
 */
function readBlock(input: string, start: number, name: string): { body: string; end: number } {
	let depth = 1;
	let i = start;
	let bodyStart = start;
	if (input[i] === "\n") {
		bodyStart = i + 1;
		i = bodyStart;
	}
	while (i < input.length) {
		const open = input.indexOf("{{", i);
		if (open === -1) {
			throw new Error(`Unclosed {{#${name}}} block`);
		}
		const close = input.indexOf("}}", open + 2);
		if (close === -1) {
			throw new Error(`Unclosed tag starting at ${open}`);
		}
		const tag = input.slice(open + 2, close).trim();
		if (tag.startsWith(`#${name} `) || tag === `#${name}`) {
			depth += 1;
		} else if (tag === `/${name}`) {
			depth -= 1;
			if (depth === 0) {
				const body = input.slice(bodyStart, open);
				let end = close + 2;
				if (input[end] === "\n") end += 1;
				return { body, end };
			}
		}
		i = close + 2;
	}
	throw new Error(`Unclosed {{#${name}}} block`);
}

function resolve(path: string, ctx: RenderContext): unknown {
	if (path === "this" || path === ".") {
		return ctx.stack[ctx.stack.length - 1];
	}
	const parts = path.split(".");
	for (let i = ctx.stack.length - 1; i >= 0; i--) {
		const value = walk(ctx.stack[i], parts);
		if (value !== undefined) return value;
	}
	return undefined;
}

function walk(root: unknown, parts: string[]): unknown {
	let cur: unknown = root;
	for (const part of parts) {
		if (cur == null || typeof cur !== "object") return undefined;
		cur = (cur as Record<string, unknown>)[part];
		if (cur === undefined) return undefined;
	}
	return cur;
}

function isTruthy(value: unknown): boolean {
	if (value == null || value === false) return false;
	if (typeof value === "string") return value.length > 0;
	if (typeof value === "number") return value !== 0;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

function stringify(value: unknown): string {
	if (value == null) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	try {
		return JSON.stringify(value) ?? "";
	} catch {
		return "";
	}
}
