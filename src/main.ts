import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, normalizeCalibersInText, type GnpSettings } from './core';
import { renderAmmoLog, renderSpecsBlock } from './render';
import { GunsNPricesSettingTab } from './settings';

export default class GunsNPricesPlugin extends Plugin {
	settings: GnpSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor('gunspecs', (source, el) => {
			renderSpecsBlock(source, el, this.settings);
		});
		this.registerMarkdownCodeBlockProcessor('ammo-log', (source, el) => {
			renderAmmoLog(source, el, this.settings);
		});

		this.addCommand({
			id: 'normalize-caliber',
			name: 'Normalize caliber in selection',
			editorCallback: (editor: Editor) => {
				this.normalizeSelection(editor);
			},
		});

		this.addSettingTab(new GunsNPricesSettingTab(this.app, this));
	}

	normalizeSelection(editor: Editor): void {
		const selection = editor.getSelection();
		if (!selection.trim()) {
			new Notice('Select a caliber first, for example 9mm Luger.');
			return;
		}
		const result = normalizeCalibersInText(selection);
		if (!result.changed) {
			new Notice('No caliber to normalize in the selection.');
			return;
		}
		editor.replaceSelection(result.text);
		new Notice(`Normalized ${result.changed} caliber${result.changed === 1 ? '' : 's'}.`);
	}

	async loadSettings(): Promise<void> {
		const saved = ((await this.loadData()) ?? {}) as Partial<GnpSettings>;
		this.settings = { ...DEFAULT_SETTINGS, ...saved };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// re-render open notes in reading view so the blocks pick up the new settings
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
		}
	}
}
