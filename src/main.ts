import { Plugin } from "obsidian";
import { AudiobookshelfSettings, DEFAULT_SETTINGS } from "./settings";
import { AudiobookshelfSettingTab } from "./ui/settingsTab";
import { syncLibrarySeriesNotes } from "./commands/syncLibrarySeriesNotes";

export default class AudiobookshelfPlugin extends Plugin {
	settings: AudiobookshelfSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AudiobookshelfSettingTab(this.app, this));

		this.addCommand({
			id: "generate-series-note",
			name: "Sync library series notes",
			callback: () => {
				void syncLibrarySeriesNotes(this);
			},
		});

		this.addRibbonIcon("library-big", "Sync library series notes", () => {
			void syncLibrarySeriesNotes(this);
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
