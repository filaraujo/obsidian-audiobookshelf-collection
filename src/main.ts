import { Plugin } from "obsidian";
import { AudiobookshelfSettings, DEFAULT_SETTINGS } from "./settings";
import { AudiobookshelfSettingTab } from "./ui/settingsTab";
import { generateSeriesNote } from "./commands/generateSeriesNote";

export default class AudiobookshelfPlugin extends Plugin {
	settings: AudiobookshelfSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AudiobookshelfSettingTab(this.app, this));

		this.addCommand({
			id: "generate-series-note",
			name: "Generate series note",
			callback: () => {
				void generateSeriesNote(this);
			},
		});

		this.addRibbonIcon("book-open", "Generate series note", () => {
			void generateSeriesNote(this);
		});
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<AudiobookshelfSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
