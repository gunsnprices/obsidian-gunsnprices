// A tiny stand-in for Obsidian's HTMLElement helpers (createEl, createDiv, createSpan, setText, empty).
// Setting innerHTML throws, so the tests also prove that rendering never writes HTML strings.

export interface ElInfo {
	text?: string;
	cls?: string | string[];
	attr?: Record<string, string | number | boolean | null>;
	href?: string;
	title?: string;
}

export class FakeEl {
	tag: string;
	classes: string[] = [];
	attrs: Record<string, string> = {};
	children: FakeEl[] = [];
	ownText = '';

	constructor(tag = 'div') {
		this.tag = tag;
	}

	set innerHTML(_value: string) {
		throw new Error('innerHTML must not be used');
	}

	createEl(tag: string, o?: ElInfo | string): FakeEl {
		const el = new FakeEl(tag);
		if (typeof o === 'string') {
			el.classes.push(...o.split(/\s+/).filter(Boolean));
		} else if (o) {
			if (o.text != null) el.ownText = o.text;
			if (o.cls) el.classes.push(...(Array.isArray(o.cls) ? o.cls : o.cls.split(/\s+/)).filter(Boolean));
			if (o.attr) {
				for (const [k, v] of Object.entries(o.attr)) if (v != null) el.attrs[k] = String(v);
			}
			if (o.href) el.attrs.href = o.href;
			if (o.title) el.attrs.title = o.title;
		}
		this.children.push(el);
		return el;
	}

	createDiv(o?: ElInfo | string): FakeEl {
		return this.createEl('div', o);
	}

	createSpan(o?: ElInfo | string): FakeEl {
		return this.createEl('span', o);
	}

	setText(text: string): void {
		this.ownText = text;
	}

	empty(): void {
		this.children = [];
		this.ownText = '';
	}

	get textContent(): string {
		return this.ownText + this.children.map((c) => c.textContent).join('');
	}

	hasClass(cls: string): boolean {
		return this.classes.includes(cls);
	}

	/** All descendants matching a tag and, optionally, a class. */
	findAll(tag: string, cls?: string): FakeEl[] {
		const out: FakeEl[] = [];
		const walk = (el: FakeEl): void => {
			for (const c of el.children) {
				if ((tag === '*' || c.tag === tag) && (!cls || c.hasClass(cls))) out.push(c);
				walk(c);
			}
		};
		walk(this);
		return out;
	}

	find(tag: string, cls?: string): FakeEl | undefined {
		return this.findAll(tag, cls)[0];
	}

	/** Text of each cell in each row of the first table body or foot under this element. */
	rows(section: 'thead' | 'tbody' | 'tfoot' = 'tbody'): string[][] {
		const sec = this.find(section);
		if (!sec) return [];
		return sec.findAll('tr').map((tr) => tr.children.map((cell) => cell.textContent));
	}
}

/** Use a FakeEl where the code expects an HTMLElement. */
export function asEl(el: FakeEl): HTMLElement {
	return el as unknown as HTMLElement;
}
