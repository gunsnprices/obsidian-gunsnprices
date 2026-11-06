// Pure logic: reading code block lines, building spec rows, totalling an ammo log, normalizing calibers.
// No Obsidian or DOM imports here, so everything can be unit tested in Node.
import { findCalibers, listCalibers, normalizeCaliber, parseTitle, roundsPerBox } from 'gunsnprices';
import type { Caliber, ProductInfo } from 'gunsnprices';

export interface GnpSettings {
	/** Turn caliber names into links to their GunsNPrices price comparison page. */
	linkCalibers: boolean;
	/** Currency symbol shown before prices; prices in notes are also read with it. */
	currency: string;
}

export const DEFAULT_SETTINGS: GnpSettings = {
	linkCalibers: false,
	currency: '$',
};

// ---------------------------------------------------------------- formatting

function symbolPrefix(currency: string): string {
	const c = currency.trim() || '$';
	return /^[A-Za-z]{2,}$/.test(c) ? c + ' ' : c;
}

/** "$1,234.50" */
export function formatMoney(value: number, currency: string): string {
	const n = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	return symbolPrefix(currency) + n;
}

/** Cost per round: "$0.38", or three decimals below ten cents ("$0.066"). */
export function formatPerRound(value: number, currency: string): string {
	const digits = value < 0.1 ? 3 : 2;
	return symbolPrefix(currency) + value.toFixed(digits);
}

/** "1,000" */
export function formatCount(value: number): string {
	return value.toLocaleString('en-US');
}

// ---------------------------------------------------------------- reading lines

const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;
const TOTAL = String.raw`(\s+(?:total|for all))?`;
const LIST_MARK = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const DATE_FIELD = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})$/;
const LEADING_DATE = /^(\d{4}-\d{2}-\d{2})\s+/;

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function symbols(currency: string): string {
	const list = ['US$', '$', 'USD', currency.trim()].filter((s, i, a) => s.length > 0 && a.indexOf(s) === i);
	list.sort((a, b) => b.length - a.length);
	return list.map(escapeRegExp).join('|');
}

function amount(s: string): number {
	return parseFloat(s.replace(/,/g, ''));
}

/** Remove separators left behind after a price or date was taken out of a line. */
export function tidy(s: string): string {
	return s
		.replace(/\s+[@|–—-](?=\s|$)/g, ' ')
		.replace(/^[\s@|,;:–—-]+/, '')
		.replace(/[\s@|,;:–—-]+$/, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

export interface PriceMatch {
	price: number;
	/** true when the line says the price is for everything ("$75.96 total") */
	total: boolean;
	/** the text with the price taken out */
	rest: string;
}

/** A price written with a currency symbol inside free text: "$18.99", "18.99 USD", "$75.96 total". */
export function extractPrice(text: string, currency = '$'): PriceMatch | null {
	const sym = symbols(currency);
	const re = new RegExp(
		String.raw`(^|[\s(:,;])(?:(?:${sym})\s?${NUM}|${NUM}\s?(?:${sym}))${TOTAL}(?=$|[\s),;])`,
		'i',
	);
	const m = re.exec(text);
	if (!m) return null;
	const value = amount(m[2] ?? m[3] ?? '');
	if (!(value > 0)) return null;
	const rest = text.slice(0, m.index) + (m[1] ?? '') + text.slice(m.index + m[0].length);
	return { price: value, total: Boolean(m[4]), rest: tidy(rest) };
}

export interface LineParts {
	date: string | null;
	text: string;
	price: number | null;
	total: boolean;
}

/** True for lines a block should skip: empty, comments, rules. */
export function isSkippable(line: string): boolean {
	const s = line.trim();
	return s === '' || s.startsWith('#') || s.startsWith('//') || s.startsWith('%%') || !/[A-Za-z0-9]/.test(s);
}

/**
 * Split a block line into date, text and price.
 * Fields may be separated with "|": "2026-10-20 | Federal 9mm 115gr FMJ 50rd x4 | $18.99".
 * Without "|", a leading ISO date and a price with a currency symbol are found inside the text.
 */
export function splitLine(line: string, currency = '$'): LineParts {
	const sym = symbols(currency);
	const symbolField = new RegExp(String.raw`^(?:(?:${sym})\s?${NUM}|${NUM}\s?(?:${sym}))${TOTAL}$`, 'i');
	const bareField = new RegExp(String.raw`^${NUM}${TOTAL}$`, 'i');

	const fields = line
		.replace(LIST_MARK, '')
		.split('|')
		.map((f) => f.trim())
		.filter((f) => f.length > 0);

	let date: string | null = null;
	let price: number | null = null;
	let total = false;
	let priceField = -1;

	// a field with a currency symbol wins; otherwise the last field that is only a number
	for (let i = 0; i < fields.length; i++) {
		const m = symbolField.exec(fields[i] ?? '');
		if (m) {
			price = amount(m[1] ?? m[2] ?? '');
			total = Boolean(m[3]);
			priceField = i;
			break;
		}
	}
	if (priceField < 0 && fields.length > 1) {
		for (let i = fields.length - 1; i > 0; i--) {
			const m = bareField.exec(fields[i] ?? '');
			if (m) {
				price = amount(m[1] ?? '');
				total = Boolean(m[2]);
				priceField = i;
				break;
			}
		}
	}

	const parts: string[] = [];
	for (let i = 0; i < fields.length; i++) {
		const f = fields[i] ?? '';
		if (i === priceField) continue;
		if (date === null && DATE_FIELD.test(f)) {
			date = f;
			continue;
		}
		parts.push(f);
	}

	let text = parts.join(' ');
	if (date === null) {
		const m = LEADING_DATE.exec(text);
		if (m) {
			date = m[1] ?? null;
			text = text.slice(m[0].length);
		}
	}
	if (price === null) {
		const p = extractPrice(text, currency);
		if (p) {
			price = p.price;
			total = p.total;
			text = p.rest;
		}
	}
	return { date, text: tidy(text), price, total };
}

// ---------------------------------------------------------------- gunspecs

export type SpecKey =
	| 'kind'
	| 'brand'
	| 'model'
	| 'configs'
	| 'features'
	| 'caliber'
	| 'capacity'
	| 'barrel'
	| 'rounds'
	| 'price'
	| 'cpr';

export interface SpecRow {
	key: SpecKey;
	label: string;
	value: string;
	/** set only when caliber links are turned on */
	href?: string;
}

export interface ProductSpecs {
	title: string;
	price: number | null;
	info: ProductInfo;
	rows: SpecRow[];
}

/** Parse one gunspecs line ("Federal 9mm 115gr 50rd $18.99") into labelled rows. */
export function productSpecs(line: string, settings: GnpSettings): ProductSpecs | null {
	if (isSkippable(line)) return null;
	const parts = splitLine(line, settings.currency);
	const title = parts.text;
	if (!title) return null;
	const info = parseTitle(title, parts.price ? { price: parts.price } : {});
	const rows: SpecRow[] = [];
	rows.push({ key: 'kind', label: 'Type', value: info.kind === 'ammo' ? 'Ammo' : 'Firearm' });
	if (info.brand) rows.push({ key: 'brand', label: 'Brand', value: info.brand });
	if (info.model) {
		rows.push({ key: 'model', label: 'Model', value: info.model.model });
		if (info.model.configs.length) {
			rows.push({ key: 'configs', label: 'Configuration', value: info.model.configs.join(', ') });
		}
		if (info.model.features.length) {
			rows.push({ key: 'features', label: 'Features', value: info.model.features.join(', ') });
		}
	}
	if (info.calibers.length) {
		const only = info.calibers.length === 1 ? info.calibers[0] : undefined;
		const row: SpecRow = {
			key: 'caliber',
			label: info.calibers.length > 1 ? 'Calibers' : 'Caliber',
			value: info.calibers.map((c) => c.name).join(' / '),
		};
		if (settings.linkCalibers && only && only.url) row.href = only.url;
		rows.push(row);
	}
	if (info.capacity) rows.push({ key: 'capacity', label: 'Capacity', value: `${info.capacity} rounds` });
	if (info.barrelLength) rows.push({ key: 'barrel', label: 'Barrel', value: `${info.barrelLength}"` });
	if (info.rounds) rows.push({ key: 'rounds', label: 'Rounds per box', value: formatCount(info.rounds) });
	if (parts.price) {
		rows.push({ key: 'price', label: 'Price', value: formatMoney(parts.price, settings.currency) });
	}
	if (info.costPerRound != null) {
		rows.push({ key: 'cpr', label: 'Cost per round', value: formatPerRound(info.costPerRound, settings.currency) });
	}
	return { title, price: parts.price, info, rows };
}

export type SpecsLayout = 'cards' | 'compare';

export interface SpecsBlock {
	layout: SpecsLayout;
	products: ProductSpecs[];
}

const LAYOUT = /^\s*layout\s*:\s*(cards|compare)\s*$/i;

/** Read a whole gunspecs block. A line "layout: compare" puts all products into one table. */
export function parseSpecsBlock(source: string, settings: GnpSettings): SpecsBlock {
	let layout: SpecsLayout = 'cards';
	const products: ProductSpecs[] = [];
	for (const line of source.split(/\r?\n/)) {
		const m = LAYOUT.exec(line);
		if (m) {
			layout = (m[1] ?? '').toLowerCase() === 'compare' ? 'compare' : 'cards';
			continue;
		}
		const p = productSpecs(line, settings);
		if (p) products.push(p);
	}
	return { layout, products };
}

// ---------------------------------------------------------------- ammo log

export interface LogEntry {
	line: number;
	date: string | null;
	text: string;
	caliber: Caliber | null;
	boxes: number;
	roundsPerBox: number | null;
	/** rounds bought on this line (boxes x rounds per box) */
	rounds: number | null;
	/** money spent on this line */
	spent: number | null;
	costPerRound: number | null;
}

export interface CaliberTotal {
	caliber: Caliber | null;
	name: string;
	rounds: number;
	spent: number;
	costPerRound: number | null;
}

export interface LogSummary {
	entries: LogEntry[];
	boxes: number;
	rounds: number;
	spent: number;
	/** spent / rounds over the lines that have both */
	costPerRound: number | null;
	byCaliber: CaliberTotal[];
	/** lines without a round count */
	missingRounds: number;
	/** lines without a price */
	missingPrice: number;
}

const QTY_PATTERNS: RegExp[] = [/(^|\s)qty:?\s?(\d{1,4})(?=$|\s)/i, /(^|\s)(\d{1,4})\s+(?:boxes|bx)(?=$|\s)/i];
const QTY_X = /(^|\s)[x×]\s?(\d{1,4})(?=$|\s)/gi;
const QTY_X_AFTER = /(^|\s)(\d{1,4})[x×](?=$|\s+\D)/i;

/** Box count written as "x4", "× 4", "4x", "4 boxes" or "qty 4". Returns the count and the text without it. */
export function extractQuantity(text: string): { boxes: number; rest: string } {
	const cut = (m: RegExpExecArray): { boxes: number; rest: string } => {
		const n = parseInt(m[2] ?? '1', 10);
		const rest = text.slice(0, m.index) + (m[1] ?? '') + text.slice(m.index + m[0].length);
		return { boxes: n > 0 ? n : 1, rest: tidy(rest) };
	};
	for (const re of QTY_PATTERNS) {
		const m = re.exec(text);
		if (m) return cut(m);
	}
	// "x4", but not the "x 19" of "9 x 19"
	for (const m of text.matchAll(QTY_X)) {
		const before = text.slice(0, m.index).trimEnd();
		if (!/\d$/.test(before)) return cut(m);
	}
	const m = QTY_X_AFTER.exec(text);
	if (m) return cut(m);
	return { boxes: 1, rest: text };
}

/** Read one ammo log line. */
export function parseLogLine(line: string, lineNo: number, currency = '$'): LogEntry | null {
	if (isSkippable(line)) return null;
	const parts = splitLine(line, currency);
	if (!parts.text) return null;
	const { boxes, rest } = extractQuantity(parts.text);
	const perBox = roundsPerBox(rest);
	const rounds = perBox != null ? perBox * boxes : null;
	const spent = parts.price == null ? null : parts.total ? parts.price : parts.price * boxes;
	const cpr = spent != null && rounds ? spent / rounds : null;
	return {
		line: lineNo,
		date: parts.date,
		text: rest,
		caliber: findCalibers(rest)[0] ?? null,
		boxes,
		roundsPerBox: perBox,
		rounds,
		spent,
		costPerRound: cpr,
	};
}

/** Total an ammo log block: rounds, money, average cost per round, and the same per caliber. */
export function summarizeLog(source: string, currency = '$'): LogSummary {
	const entries: LogEntry[] = [];
	source.split(/\r?\n/).forEach((line, i) => {
		const e = parseLogLine(line, i + 1, currency);
		if (e) entries.push(e);
	});
	let boxes = 0;
	let rounds = 0;
	let spent = 0;
	let pricedRounds = 0;
	let pricedSpent = 0;
	let missingRounds = 0;
	let missingPrice = 0;
	const groups = new Map<string, CaliberTotal & { pricedRounds: number; pricedSpent: number }>();
	for (const e of entries) {
		boxes += e.boxes;
		if (e.rounds != null) rounds += e.rounds;
		else missingRounds++;
		if (e.spent != null) spent += e.spent;
		else missingPrice++;
		const id = e.caliber ? e.caliber.id : '';
		let g = groups.get(id);
		if (!g) {
			g = {
				caliber: e.caliber,
				name: e.caliber ? e.caliber.name : 'Unknown caliber',
				rounds: 0,
				spent: 0,
				costPerRound: null,
				pricedRounds: 0,
				pricedSpent: 0,
			};
			groups.set(id, g);
		}
		if (e.rounds != null) g.rounds += e.rounds;
		if (e.spent != null) g.spent += e.spent;
		if (e.rounds != null && e.spent != null) {
			pricedRounds += e.rounds;
			pricedSpent += e.spent;
			g.pricedRounds += e.rounds;
			g.pricedSpent += e.spent;
		}
	}
	const byCaliber: CaliberTotal[] = [...groups.values()]
		.map((g) => ({
			caliber: g.caliber,
			name: g.name,
			rounds: g.rounds,
			spent: g.spent,
			costPerRound: g.pricedRounds > 0 ? g.pricedSpent / g.pricedRounds : null,
		}))
		.sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name));
	return {
		entries,
		boxes,
		rounds,
		spent,
		costPerRound: pricedRounds > 0 ? pricedSpent / pricedRounds : null,
		byCaliber,
		missingRounds,
		missingPrice,
	};
}

// ---------------------------------------------------------------- caliber normalization

// Words that appear in caliber spellings but not in the canonical names ("9mm Luger", "300 BLK", "S&W").
const EXTRA_WORDS =
	'win winchester rem remington mag magnum wby weatherby spl special sprg springfield spfd government govt gov ' +
	'acp auto s&w sw s w smith wesson and & blackout blk black out creedmoor creed cm crd creedmore parabellum ' +
	'para luger gauge ga gauges bore lr long rifle h&h holland h&r h r bm bushmaster bush nato aac mm cal caliber ' +
	'x short super express';

let vocabulary: Set<string> | null = null;

function words(s: string): string[] {
	return s
		.toLowerCase()
		.replace(/×/g, 'x')
		.split(/[\s\-_/]+/)
		.map((t) => t.replace(/^[("'[]+/, '').replace(/[)"'\],.]+$/, ''))
		.filter((t) => t.length > 0);
}

function vocab(): Set<string> {
	if (vocabulary) return vocabulary;
	const v = new Set(EXTRA_WORDS.split(' '));
	for (const c of listCalibers()) {
		for (const w of words(c.name)) if (!/\d/.test(w)) v.add(w);
	}
	vocabulary = v;
	return v;
}

const NUMBER_WORD = /^\.?\d+(?:[.,]\d+)?(?:x\.?\d+(?:[.,]\d+)?)?([a-z&]*)$/;

/** True when the text is a caliber and nothing else: "9mm Luger" yes, "9mm 115gr FMJ" or "9mm +P" no. */
export function isCaliberOnly(text: string): boolean {
	const toks = words(text);
	if (!toks.length || !toks.some((t) => /\d/.test(t))) return false;
	const v = vocab();
	const ok = toks.every((t) => {
		if (v.has(t)) return true;
		const m = NUMBER_WORD.exec(t);
		return m !== null && (m[1] === '' || v.has(m[1] ?? ''));
	});
	return ok && findCalibers(text).length <= 1 && normalizeCaliber(text) !== null;
}

const WRAPPERS: [string, string][] = [
	['[[', ']]'],
	['**', '**'],
	['==', '=='],
	['`', '`'],
	['*', '*'],
	['_', '_'],
	['"', '"'],
	["'", "'"],
	['(', ')'],
];

function normalizeSegment(seg: string): { text: string; changed: boolean } {
	// keep list markers, "key: " prefixes, surrounding spaces and matching wrappers such as **...** or [[...]]
	const m = /^(\s*(?:(?:[-*+]|\d+[.)])\s+)?(?:[A-Za-z][\w -]*:\s+)?)([\s\S]*?)(\s*)$/.exec(seg);
	if (!m) return { text: seg, changed: false };
	let head = m[1] ?? '';
	let core = m[2] ?? '';
	let tail = m[3] ?? '';
	for (let again = true; again; ) {
		again = false;
		for (const [open, close] of WRAPPERS) {
			if (core.length > open.length + close.length && core.startsWith(open) && core.endsWith(close)) {
				head += open;
				tail = close + tail;
				core = core.slice(open.length, core.length - close.length);
				again = true;
				break;
			}
		}
	}
	if (!isCaliberOnly(core)) return { text: seg, changed: false };
	const c = normalizeCaliber(core);
	if (!c || c.name === core.trim()) return { text: seg, changed: false };
	return { text: head + c.name + tail, changed: true };
}

export interface NormalizeResult {
	text: string;
	/** number of calibers rewritten */
	changed: number;
}

/**
 * Rewrite calibers in a selection to their canonical names ("9mm Luger" -> "9×19mm Parabellum").
 * Works per line and per table cell or comma-separated item; anything that is not only a caliber is left alone.
 */
export function normalizeCalibersInText(text: string): NormalizeResult {
	let changed = 0;
	const out = text
		.split(/(\r?\n)/)
		.map((chunk) => {
			if (/^\r?\n$/.test(chunk)) return chunk;
			return chunk
				.split(/([|,;])/)
				.map((seg) => {
					if (/^[|,;]$/.test(seg)) return seg;
					const r = normalizeSegment(seg);
					if (r.changed) changed++;
					return r.text;
				})
				.join('');
		})
		.join('');
	return { text: out, changed };
}
