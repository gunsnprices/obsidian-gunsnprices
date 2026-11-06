import { beforeEach, describe, expect, it } from 'vitest';
import type { App, PluginManifest } from 'obsidian';
import GunsNPricesPlugin from '../src/main';
import { GunsNPricesSettingTab } from '../src/settings';
import { asEl, FakeEl } from './fake-dom';
import { createApp, MarkdownView, Notice, Setting, type CommandSpec, type Plugin as MockPlugin } from './obsidian-mock';

const manifest = { id: 'gunsnprices', name: 'GunsNPrices', version: '0.1.0' } as PluginManifest;

function setup(stored: unknown = null): { plugin: GunsNPricesPlugin; mock: MockPlugin; view: MarkdownView } {
	const view = new MarkdownView();
	const plugin = new GunsNPricesPlugin(createApp([view]) as unknown as App, manifest);
	const mock = plugin as unknown as MockPlugin;
	mock.stored = stored;
	return { plugin, mock, view };
}

class FakeEditor {
	constructor(public selection: string) {}
	getSelection(): string {
		return this.selection;
	}
	replaceSelection(text: string): void {
		this.selection = text;
	}
}

function command(mock: MockPlugin, id: string): CommandSpec {
	const c = mock.commands.find((x) => x.id === id);
	if (!c) throw new Error(`command ${id} not registered`);
	return c;
}

beforeEach(() => {
	Notice.messages = [];
	Setting.all = [];
});

describe('plugin', () => {
	it('registers both code blocks, the command and the settings tab', async () => {
		const { plugin, mock } = setup();
		await plugin.onload();
		expect(Object.keys(mock.processors).sort()).toEqual(['ammo-log', 'gunspecs']);
		const c = command(mock, 'normalize-caliber');
		expect(c.name).toBe('Normalize caliber in selection');
		expect(c.hotkeys).toBeUndefined();
		expect(mock.settingTabs).toHaveLength(1);
	});

	it('renders blocks through the registered processors with the saved settings', async () => {
		const { plugin, mock } = setup({ linkCalibers: true });
		await plugin.onload();
		expect(plugin.settings).toEqual({ linkCalibers: true, currency: '$' });
		const el = new FakeEl();
		mock.processors.gunspecs?.('Federal 9mm 115gr 50rd $18.99', asEl(el), {});
		expect(el.find('a')?.attrs.href).toBe('https://gunsnprices.com/ammo/handgun-ammo/9-19mm-parabellum');
		const log = new FakeEl();
		mock.processors['ammo-log']?.('Federal 9mm 115gr FMJ 50rd x4 | $18.99', asEl(log), {});
		expect(log.rows('tfoot')).toEqual([['Total', '4', '200', '$75.96', '$0.38']]);
	});

	it('normalizes the selection and reports what it did', async () => {
		const { plugin, mock } = setup();
		await plugin.onload();
		const run = command(mock, 'normalize-caliber').editorCallback;

		const editor = new FakeEditor('9mm Luger, 300 BLK');
		run?.(editor);
		expect(editor.selection).toBe('9×19mm Parabellum, .300 AAC Blackout');
		expect(Notice.messages.pop()).toBe('Normalized 2 calibers.');

		const prose = new FakeEditor('Federal 9mm 115gr FMJ');
		run?.(prose);
		expect(prose.selection).toBe('Federal 9mm 115gr FMJ');
		expect(Notice.messages.pop()).toBe('No caliber to normalize in the selection.');

		run?.(new FakeEditor('  '));
		expect(Notice.messages.pop()).toBe('Select a caliber first, for example 9mm Luger.');
	});
});

describe('settings tab', () => {
	it('defaults to links off and saves changes', async () => {
		const { plugin, mock, view } = setup();
		await plugin.onload();
		expect(plugin.settings).toEqual({ linkCalibers: false, currency: '$' });

		const tab = mock.settingTabs[0] as GunsNPricesSettingTab;
		tab.display();
		const [links, currency] = Setting.all;
		expect(links?.name).toBe('Link calibers to price pages');
		expect(links?.toggle?.value).toBe(false);
		expect(currency?.name).toBe('Currency symbol');

		await links?.toggle?.handler?.(true);
		await currency?.text?.handler?.(' € ');
		expect(mock.stored).toEqual({ linkCalibers: true, currency: '€' });
		expect(view.rerenders).toBe(2);

		await currency?.text?.handler?.('');
		expect(plugin.settings.currency).toBe('$');
	});

	it('offers declarative definitions for Obsidian 1.13+', async () => {
		const { plugin, mock } = setup();
		await plugin.onload();
		const tab = mock.settingTabs[0] as GunsNPricesSettingTab;
		const defs = tab.getSettingDefinitions();
		expect(defs.map((d) => ('name' in d ? d.name : ''))).toEqual(['Link calibers to price pages', 'Currency symbol']);
		expect(tab.getControlValue('linkCalibers')).toBe(false);
		await tab.setControlValue('linkCalibers', true);
		expect(plugin.settings.linkCalibers).toBe(true);
	});
});
