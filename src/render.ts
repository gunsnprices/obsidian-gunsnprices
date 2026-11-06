// Rendering of the code blocks. Uses only Obsidian's createEl helpers: user text is always set as text, never as HTML.
import {
	formatCount,
	formatMoney,
	formatPerRound,
	parseSpecsBlock,
	summarizeLog,
	type GnpSettings,
	type ProductSpecs,
	type SpecKey,
	type SpecRow,
} from './core';

function valueCell(parent: HTMLElement, tag: 'td' | 'th', row: SpecRow | undefined): void {
	const cell = parent.createEl(tag);
	if (!row) return;
	if (row.href) {
		cell.createEl('a', {
			text: row.value,
			href: row.href,
			cls: 'external-link',
			attr: { target: '_blank', rel: 'noopener' },
		});
	} else {
		cell.setText(row.value);
	}
}

function hint(el: HTMLElement, text: string): void {
	el.createDiv({ cls: 'gnp-hint', text });
}

/** Show a parse failure inside the block instead of breaking the note. */
export function renderError(el: HTMLElement, err: unknown): void {
	const msg = err instanceof Error ? err.message : String(err);
	const box = el.createDiv({ cls: 'gnp-error' });
	box.createDiv({ text: 'This block could not be read.' });
	if (/invalid regular expression|invalid group/i.test(msg)) {
		box.createDiv({ text: 'The parser needs a newer system browser engine (on iOS: version 16.4 or later).' });
	}
	box.createDiv({ cls: 'gnp-hint', text: msg });
}

function renderCards(el: HTMLElement, products: ProductSpecs[]): void {
	for (const p of products) {
		const card = el.createDiv({ cls: 'gnp-specs__item' });
		card.createDiv({ cls: 'gnp-specs__title', text: p.title });
		const body = card.createEl('table', { cls: 'gnp-table gnp-specs__table' }).createEl('tbody');
		for (const row of p.rows) {
			const tr = body.createEl('tr', { attr: { 'data-key': row.key } });
			tr.createEl('th', { text: row.label });
			valueCell(tr, 'td', row);
		}
		if (p.rows.length <= 1) hint(card, 'No caliber, model or round count recognized in this title.');
	}
}

const COMPARE_COLUMNS: { key: SpecKey; label: string }[] = [
	{ key: 'brand', label: 'Brand' },
	{ key: 'model', label: 'Model' },
	{ key: 'caliber', label: 'Caliber' },
	{ key: 'capacity', label: 'Capacity' },
	{ key: 'barrel', label: 'Barrel' },
	{ key: 'rounds', label: 'Rounds' },
	{ key: 'price', label: 'Price' },
	{ key: 'cpr', label: 'Per round' },
];

function renderCompare(el: HTMLElement, products: ProductSpecs[]): void {
	const cols = COMPARE_COLUMNS.filter((c) => products.some((p) => p.rows.some((r) => r.key === c.key)));
	const table = el.createEl('table', { cls: 'gnp-table gnp-specs__compare' });
	const head = table.createEl('thead').createEl('tr');
	head.createEl('th', { text: 'Product' });
	for (const c of cols) head.createEl('th', { text: c.label });
	const body = table.createEl('tbody');
	for (const p of products) {
		const tr = body.createEl('tr');
		tr.createEl('td', { text: p.title });
		for (const c of cols) valueCell(tr, 'td', p.rows.find((r) => r.key === c.key));
	}
}

/** ```gunspecs``` : one product title per line, optional price ("$18.99"); "layout: compare" for one table. */
export function renderSpecsBlock(source: string, el: HTMLElement, settings: GnpSettings): void {
	const root = el.createDiv({ cls: 'gnp-specs' });
	try {
		const block = parseSpecsBlock(source, settings);
		if (!block.products.length) {
			hint(root, 'Add one product title per line, for example: Federal 9mm 115gr FMJ 50rd $18.99');
			return;
		}
		if (block.layout === 'compare') renderCompare(root, block.products);
		else renderCards(root, block.products);
	} catch (err) {
		renderError(root, err);
	}
}

/** ```ammo-log``` : "2026-10-20 | Federal 9mm 115gr FMJ 50rd x4 | $18.99" per line. */
export function renderAmmoLog(source: string, el: HTMLElement, settings: GnpSettings): void {
	const root = el.createDiv({ cls: 'gnp-log' });
	try {
		const cur = settings.currency;
		const log = summarizeLog(source, cur);
		if (!log.entries.length) {
			hint(root, 'Add one purchase per line, for example: 2026-10-20 | Federal 9mm 115gr FMJ 50rd x4 | $18.99');
			return;
		}
		const showDate = log.entries.some((e) => e.date);
		const showBoxes = log.entries.some((e) => e.boxes > 1);

		const table = root.createEl('table', { cls: 'gnp-table gnp-log__table' });
		const head = table.createEl('thead').createEl('tr');
		if (showDate) head.createEl('th', { text: 'Date' });
		head.createEl('th', { text: 'Ammo' });
		head.createEl('th', { text: 'Caliber' });
		if (showBoxes) head.createEl('th', { text: 'Boxes', cls: 'gnp-num' });
		head.createEl('th', { text: 'Rounds', cls: 'gnp-num' });
		head.createEl('th', { text: 'Paid', cls: 'gnp-num' });
		head.createEl('th', { text: 'Per round', cls: 'gnp-num' });

		const body = table.createEl('tbody');
		for (const e of log.entries) {
			const tr = body.createEl('tr');
			if (showDate) tr.createEl('td', { text: e.date ?? '' });
			tr.createEl('td', { text: e.text });
			const calCell = tr.createEl('td');
			if (e.caliber) {
				if (settings.linkCalibers && e.caliber.url) {
					calCell.createEl('a', {
						text: e.caliber.name,
						href: e.caliber.url,
						cls: 'external-link',
						attr: { target: '_blank', rel: 'noopener' },
					});
				} else {
					calCell.setText(e.caliber.name);
				}
			}
			if (showBoxes) tr.createEl('td', { text: String(e.boxes), cls: 'gnp-num' });
			tr.createEl('td', { text: e.rounds != null ? formatCount(e.rounds) : '?', cls: 'gnp-num' });
			tr.createEl('td', { text: e.spent != null ? formatMoney(e.spent, cur) : '?', cls: 'gnp-num' });
			tr.createEl('td', {
				text: e.costPerRound != null ? formatPerRound(e.costPerRound, cur) : '',
				cls: 'gnp-num',
			});
		}

		const foot = table.createEl('tfoot').createEl('tr', { cls: 'gnp-log__total' });
		foot.createEl('th', { text: 'Total', attr: { colspan: String(showDate ? 3 : 2) } });
		if (showBoxes) foot.createEl('td', { text: formatCount(log.boxes), cls: 'gnp-num' });
		foot.createEl('td', { text: formatCount(log.rounds), cls: 'gnp-num' });
		foot.createEl('td', { text: formatMoney(log.spent, cur), cls: 'gnp-num' });
		foot.createEl('td', {
			text: log.costPerRound != null ? formatPerRound(log.costPerRound, cur) : '',
			cls: 'gnp-num',
		});

		if (log.byCaliber.length > 1) {
			const t = root.createEl('table', { cls: 'gnp-table gnp-log__calibers' });
			const h = t.createEl('thead').createEl('tr');
			h.createEl('th', { text: 'Caliber' });
			h.createEl('th', { text: 'Rounds', cls: 'gnp-num' });
			h.createEl('th', { text: 'Paid', cls: 'gnp-num' });
			h.createEl('th', { text: 'Average per round', cls: 'gnp-num' });
			const b = t.createEl('tbody');
			for (const g of log.byCaliber) {
				const tr = b.createEl('tr');
				tr.createEl('td', { text: g.name });
				tr.createEl('td', { text: formatCount(g.rounds), cls: 'gnp-num' });
				tr.createEl('td', { text: formatMoney(g.spent, cur), cls: 'gnp-num' });
				tr.createEl('td', {
					text: g.costPerRound != null ? formatPerRound(g.costPerRound, cur) : '',
					cls: 'gnp-num',
				});
			}
		}

		const notes: string[] = [];
		if (log.missingRounds) {
			notes.push(
				`${log.missingRounds} line${log.missingRounds === 1 ? ' has' : 's have'} no round count ` +
					'(write it like 50rd or 20 rounds); left out of the average.',
			);
		}
		if (log.missingPrice) {
			notes.push(`${log.missingPrice} line${log.missingPrice === 1 ? ' has' : 's have'} no price.`);
		}
		for (const n of notes) hint(root, n);
	} catch (err) {
		renderError(root, err);
	}
}
