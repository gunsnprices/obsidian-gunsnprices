import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/core';
import { renderAmmoLog, renderError, renderSpecsBlock } from '../src/render';
import { asEl, FakeEl } from './fake-dom';

const S = DEFAULT_SETTINGS;

describe('renderSpecsBlock', () => {
	it('renders one spec table per title, without links by default', () => {
		const el = new FakeEl();
		renderSpecsBlock('Federal 9mm 115gr 50rd $18.99\nGlock 19 Gen 5 MOS 9mm 4.02" 15rd Pistol', asEl(el), S);
		const cards = el.findAll('div', 'gnp-specs__item');
		expect(cards).toHaveLength(2);
		expect(cards[0]?.find('div', 'gnp-specs__title')?.textContent).toBe('Federal 9mm 115gr 50rd');
		expect(cards[0]?.rows()).toEqual([
			['Type', 'Ammo'],
			['Caliber', '9×19mm Parabellum'],
			['Rounds per box', '50'],
			['Price', '$18.99'],
			['Cost per round', '$0.38'],
		]);
		expect(cards[1]?.rows()).toContainEqual(['Model', 'Glock 19 Gen 5 MOS']);
		expect(el.findAll('a')).toHaveLength(0);
	});

	it('adds external links when the setting is on', () => {
		const el = new FakeEl();
		renderSpecsBlock('PMC Bronze 5.56 NATO 55gr FMJ 1000rd $449', asEl(el), { ...S, linkCalibers: true });
		const a = el.find('a');
		expect(a?.textContent).toBe('5.56×45mm NATO');
		expect(a?.attrs).toEqual({
			href: 'https://gunsnprices.com/ammo/rifle-ammo/5-56-45mm-nato',
			target: '_blank',
			rel: 'noopener',
		});
		expect(a?.hasClass('external-link')).toBe(true);
	});

	it('renders a comparison table with only the columns that have values', () => {
		const el = new FakeEl();
		renderSpecsBlock(
			'layout: compare\nFederal 9mm 115gr FMJ 50rd $18.99\nWinchester 9mm 115gr FMJ 1000 Round Case $289.99',
			asEl(el),
			S,
		);
		expect(el.findAll('table')).toHaveLength(1);
		expect(el.rows('thead')).toEqual([['Product', 'Caliber', 'Rounds', 'Price', 'Per round']]);
		expect(el.rows()).toEqual([
			['Federal 9mm 115gr FMJ 50rd', '9×19mm Parabellum', '50', '$18.99', '$0.38'],
			['Winchester 9mm 115gr FMJ 1000 Round Case', '9×19mm Parabellum', '1,000', '$289.99', '$0.29'],
		]);
	});

	it('shows a hint for an empty block', () => {
		const el = new FakeEl();
		renderSpecsBlock('\n# nothing yet\n', asEl(el), S);
		expect(el.find('div', 'gnp-hint')?.textContent).toMatch(/one product title per line/);
	});

	it('uses the configured currency symbol', () => {
		const el = new FakeEl();
		renderSpecsBlock('Sellier & Bellot 9mm 115gr FMJ 50rd €17.50', asEl(el), { ...S, currency: '€' });
		expect(el.rows()).toContainEqual(['Price', '€17.50']);
		expect(el.rows()).toContainEqual(['Cost per round', '€0.35']);
	});
});

describe('renderAmmoLog', () => {
	const source = [
		'2026-10-20 | Federal 9mm 115gr FMJ 50rd x4 | $18.99',
		'2026-10-25 | CCI Blazer Brass .45 ACP 230gr FMJ 50rd | $27.49',
		'2026-11-01 | Winchester 9mm 115gr FMJ 1000 Round Case | $289.99',
	].join('\n');

	it('renders entries, totals and a per-caliber summary', () => {
		const el = new FakeEl();
		renderAmmoLog(source, asEl(el), S);
		const [log, calibers] = el.findAll('table');
		expect(log?.rows('thead')).toEqual([['Date', 'Ammo', 'Caliber', 'Boxes', 'Rounds', 'Paid', 'Per round']]);
		expect(log?.rows()[0]).toEqual([
			'2026-10-20',
			'Federal 9mm 115gr FMJ 50rd',
			'9×19mm Parabellum',
			'4',
			'200',
			'$75.96',
			'$0.38',
		]);
		expect(log?.rows('tfoot')).toEqual([['Total', '6', '1,250', '$393.44', '$0.31']]);
		expect(log?.find('tfoot')?.find('th')?.attrs.colspan).toBe('3');
		expect(calibers?.rows()).toEqual([
			['9×19mm Parabellum', '1,200', '$365.95', '$0.30'],
			['.45 ACP', '50', '$27.49', '$0.55'],
		]);
	});

	it('notes lines that lack a round count', () => {
		const el = new FakeEl();
		renderAmmoLog('Federal 9mm 50rd | $20\nMystery 9mm ammo | $10', asEl(el), S);
		expect(el.rows()[1]).toEqual(['Mystery 9mm ammo', '9×19mm Parabellum', '?', '$10.00', '']);
		expect(el.findAll('div', 'gnp-hint').map((d) => d.textContent)).toEqual([
			'1 line has no round count (write it like 50rd or 20 rounds); left out of the average.',
		]);
	});
});

describe('renderError', () => {
	it('explains old browser engines', () => {
		const el = new FakeEl();
		renderError(asEl(el), new SyntaxError('Invalid regular expression: /(?<!a)b/: Invalid group'));
		expect(el.textContent).toMatch(/iOS: version 16\.4 or later/);
	});
});
