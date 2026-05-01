import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TFolder, normalizePath } from "obsidian";
import type AudiobookshelfPlugin from "../main";
import { AudiobookshelfClient, AudiobookshelfApiError } from "../api/client";
import { Library } from "../api/types";

class FolderSuggest extends AbstractInputSuggest<string> {
	private readonly folders: string[];
	private readonly inputElement: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputElement = inputEl;
		const folderPaths = app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder)
			.map((folder) => folder.path)
			.sort((a, b) => a.localeCompare(b));
		this.folders = ["/", ...folderPaths];
	}

	getSuggestions(inputStr: string): string[] {
		const input = inputStr.trim().toLowerCase();
		if (!input) {
			return this.folders;
		}
		return this.folders.filter((folder) => folder.toLowerCase().includes(input));
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.createEl("div", { text: folder });
	}

	selectSuggestion(folder: string): void {
		this.inputElement.value = folder;
		this.inputElement.dispatchEvent(new Event("input"));
		this.close();
	}
}

export class AudiobookshelfSettingTab extends PluginSettingTab {
	plugin: AudiobookshelfPlugin;
	private libraries: Library[] = [];
	private librariesEl: HTMLDivElement | null = null;
	private statusEl: HTMLDivElement | null = null;

	constructor(app: App, plugin: AudiobookshelfPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Server URL")
			.setDesc("Base URL of your Audiobookshelf server, e.g. https://abs.example.com")
			.addText((text) =>
				text
					.setPlaceholder("https://abs.example.com")
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("API token")
			.setDesc("Token from your user profile in audiobookshelf.")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("Paste API token")
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Folder location")
			.setDesc("Choose the folder where the note is created.")
			.addSearch((search) => {
				search
					.setPlaceholder("Example: Reading")
					.setValue(this.plugin.settings.folderLocation || "/")
					.onChange(async (value) => {
						const normalizedValue = value.trim();
						this.plugin.settings.folderLocation =
							normalizedValue === "/" ? "" : normalizePath(normalizedValue.replace(/^\/+/, ""));
						await this.plugin.saveSettings();
					});

				new FolderSuggest(this.app, search.inputEl);
			});

		new Setting(containerEl)
			.setName("Output file name")
			.setDesc("File name for the generated note.")
			.addText((text) =>
				text
					.setPlaceholder("Series.md")
					.setValue(this.plugin.settings.outputFileName)
					.onChange(async (value) => {
						this.plugin.settings.outputFileName = value.trim() || "audiobookshelf-series.md";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Libraries")
			.setDesc("Select which libraries to include in the generated note.")
			.addButton((btn) =>
				btn
					.setButtonText("Fetch libraries")
					.setCta()
					.onClick(() => this.fetchLibraries()),
			);

		this.statusEl = containerEl.createDiv({ cls: "abs-settings-status" });
		this.librariesEl = containerEl.createDiv({ cls: "abs-settings-libraries" });
		this.renderLibraryList();
	}

	private async fetchLibraries(): Promise<void> {
		if (!this.plugin.settings.serverUrl || !this.plugin.settings.apiToken) {
			new Notice("Set the server URL and API token first.");
			return;
		}
		this.setStatus("Fetching libraries...");
		try {
			const client = new AudiobookshelfClient({
				serverUrl: this.plugin.settings.serverUrl,
				apiToken: this.plugin.settings.apiToken,
			});
			this.libraries = await client.getLibraries();
			this.setStatus(`Loaded ${this.libraries.length} libraries.`);
			this.renderLibraryList();
		} catch (err) {
			const msg = err instanceof AudiobookshelfApiError ? err.message : String(err);
			new Notice(`Failed to fetch libraries: ${msg}`);
			this.setStatus(`Error: ${msg}`);
		}
	}

	private setStatus(text: string): void {
		if (this.statusEl) this.statusEl.setText(text);
	}

	private renderLibraryList(): void {
		const host = this.librariesEl;
		if (!host) return;
		host.empty();

		if (this.libraries.length === 0) {
			host.createEl("p", {
				text: "No libraries loaded yet. Use the button above to load them.",
				cls: "abs-settings-empty",
			});
			return;
		}

		const selected = new Set(this.plugin.settings.libraryIds);
		for (const lib of this.libraries) {
			new Setting(host)
				.setName(lib.name)
				.setDesc(lib.mediaType ? `Media type: ${lib.mediaType}` : "")
				.addToggle((toggle) =>
					toggle.setValue(selected.has(lib.id)).onChange(async (value) => {
						const ids = new Set(this.plugin.settings.libraryIds);
						if (value) ids.add(lib.id);
						else ids.delete(lib.id);
						this.plugin.settings.libraryIds = Array.from(ids);
						await this.plugin.saveSettings();
					}),
				);
		}
	}
}
