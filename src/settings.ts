import { App, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type GunsNPricesPlugin from './main';

const LINK_NAME = 'Link calibers to price pages';
const LINK_DESC =
	'Turn caliber names in rendered blocks into links to their price comparison page on gunsnprices.com. ' +
	'Nothing is loaded until you click a link.';
const CURRENCY_NAME = 'Currency symbol';
const CURRENCY_DESC = 'Shown before prices and cost per round. Prices in notes are read with this symbol or with $.';

export class GunsNPricesSettingTab extends PluginSettingTab {
	plugin: GunsNPricesPlugin;

	constructor(app: App, plugin: GunsNPricesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/** Obsidian 1.13 and later: declarative settings, which also appear in settings search. */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{ name: LINK_NAME, desc: LINK_DESC, control: { type: 'toggle', key: 'linkCalibers', defaultValue: false } },
			{
				name: CURRENCY_NAME,
				desc: CURRENCY_DESC,
				control: { type: 'text', key: 'currency', placeholder: '$', defaultValue: '$' },
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === 'linkCalibers') return this.plugin.settings.linkCalibers;
		if (key === 'currency') return this.plugin.settings.currency;
		return undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'linkCalibers') this.plugin.settings.linkCalibers = value === true;
		else if (key === 'currency') this.plugin.settings.currency = (typeof value === 'string' && value.trim()) || '$';
		else return;
		await this.plugin.saveSettings();
	}

	/** Obsidian before 1.13. */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(LINK_NAME)
			.setDesc(LINK_DESC)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.linkCalibers).onChange(async (value) => {
					await this.setControlValue('linkCalibers', value);
				}),
			);

		new Setting(containerEl)
			.setName(CURRENCY_NAME)
			.setDesc(CURRENCY_DESC)
			.addText((text) =>
				text
					.setPlaceholder('$')
					.setValue(this.plugin.settings.currency)
					.onChange(async (value) => {
						await this.setControlValue('currency', value);
					}),
			);
	}
}
