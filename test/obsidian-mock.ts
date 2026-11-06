// Minimal runtime mock of the parts of the "obsidian" module that the plugin uses.
// vitest.config.ts aliases "obsidian" to this file.
import { FakeEl } from './fake-dom';

type Processor = (source: string, el: HTMLElement, ctx: unknown) => void;

export interface CommandSpec {
	id: string;
	name: string;
	hotkeys?: unknown[];
	editorCallback?: (editor: unknown, ctx?: unknown) => void;
	callback?: () => void;
}

export class Notice {
	static messages: string[] = [];
	constructor(message: string) {
		Notice.messages.push(message);
	}
}

export class MarkdownView {
	rerenders = 0;
	previewMode = {
		rerender: (_full?: boolean): void => {
			this.rerenders++;
		},
	};
}

export class Editor {}

export interface MockApp {
	workspace: { getLeavesOfType: (type: string) => { view: unknown }[] };
}

export function createApp(views: unknown[] = []): MockApp {
	return {
		workspace: {
			getLeavesOfType: (type: string) => (type === 'markdown' ? views.map((view) => ({ view })) : []),
		},
	};
}

export class Plugin {
	app: MockApp;
	manifest: unknown;
	processors: Record<string, Processor> = {};
	commands: CommandSpec[] = [];
	settingTabs: unknown[] = [];
	stored: unknown = null;

	constructor(app: MockApp, manifest: unknown) {
		this.app = app;
		this.manifest = manifest;
	}

	registerMarkdownCodeBlockProcessor(language: string, handler: Processor): void {
		this.processors[language] = handler;
	}

	addCommand(command: CommandSpec): CommandSpec {
		this.commands.push(command);
		return command;
	}

	addSettingTab(tab: unknown): void {
		this.settingTabs.push(tab);
	}

	loadData(): Promise<unknown> {
		return Promise.resolve(this.stored);
	}

	saveData(data: unknown): Promise<void> {
		this.stored = JSON.parse(JSON.stringify(data)) as unknown;
		return Promise.resolve();
	}
}

export class PluginSettingTab {
	app: MockApp;
	containerEl = new FakeEl('div');

	constructor(app: MockApp, _plugin: unknown) {
		this.app = app;
	}
}

class ToggleComponent {
	value = false;
	handler: ((value: boolean) => unknown) | null = null;
	setValue(value: boolean): this {
		this.value = value;
		return this;
	}
	onChange(handler: (value: boolean) => unknown): this {
		this.handler = handler;
		return this;
	}
}

class TextComponent {
	value = '';
	placeholder = '';
	handler: ((value: string) => unknown) | null = null;
	setPlaceholder(value: string): this {
		this.placeholder = value;
		return this;
	}
	setValue(value: string): this {
		this.value = value;
		return this;
	}
	onChange(handler: (value: string) => unknown): this {
		this.handler = handler;
		return this;
	}
}

export class Setting {
	static all: Setting[] = [];
	name = '';
	desc = '';
	toggle: ToggleComponent | null = null;
	text: TextComponent | null = null;

	constructor(_containerEl: unknown) {
		Setting.all.push(this);
	}

	setName(name: string): this {
		this.name = name;
		return this;
	}

	setDesc(desc: string): this {
		this.desc = desc;
		return this;
	}

	addToggle(cb: (toggle: ToggleComponent) => unknown): this {
		this.toggle = new ToggleComponent();
		cb(this.toggle);
		return this;
	}

	addText(cb: (text: TextComponent) => unknown): this {
		this.text = new TextComponent();
		cb(this.text);
		return this;
	}
}
