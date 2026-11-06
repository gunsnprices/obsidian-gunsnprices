// Keeps the README honest: every example in it is checked here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { roundsPerBox } from 'gunsnprices';
import { DEFAULT_SETTINGS, normalizeCalibersInText, splitLine } from '../src/core';
import { renderAmmoLog, renderSpecsBlock } from '../src/render';
import { asEl, FakeEl } from './fake-dom';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

function block(lang: string, index = 0): string {
	const re = new RegExp('```' + lang + '\\n([\\s\\S]*?)\\n```', 'g');
	const all = [...readme.matchAll(re)].map((m) => m[1] ?? '');
	const found = all[index];
	if (found === undefined) throw new Error(`README has no ${lang} block #${index}`);
	return found;
}

describe('README examples', () => {
	it('gunspecs cards', () => {
		const el = new FakeEl();
		renderSpecsBlock(block('gunspecs', 0), asEl(el), DEFAULT_SETTINGS);
		const cards = el.findAll('div', 'gnp-specs__item');
		expect(cards.map((c) => c.rows())).toEqual([
			[
				['Type', 'Ammo'],
				['Caliber', '9×19mm Parabellum'],
				['Rounds per box', '50'],
				['Price', '$18.99'],
				['Cost per round', '$0.38'],
			],
			[
				['Type', 'Firearm'],
				['Brand', 'Glock'],
				['Model', 'Glock 19 Gen 5 MOS'],
				['Configuration', 'MOS'],
				['Caliber', '9×19mm Parabellum'],
				['Capacity', '15 rounds'],
				['Barrel', '4.02"'],
			],
		]);
	});

	it('gunspecs compare', () => {
		const el = new FakeEl();
		renderSpecsBlock(block('gunspecs', 1), asEl(el), DEFAULT_SETTINGS);
		expect([...el.rows('thead'), ...el.rows()]).toEqual([
			['Product', 'Caliber', 'Rounds', 'Price', 'Per round'],
			['Federal 9mm 115gr FMJ 50rd', '9×19mm Parabellum', '50', '$18.99', '$0.38'],
			['Winchester 9mm 115gr FMJ 1000 Round Case', '9×19mm Parabellum', '1,000', '$289.99', '$0.29'],
		]);
	});

	it('ammo-log', () => {
		const el = new FakeEl();
		renderAmmoLog(block('ammo-log'), asEl(el), DEFAULT_SETTINGS);
		const [log, calibers] = el.findAll('table');
		expect(log?.rows()).toEqual([
			['2026-10-20', 'Federal 9mm 115gr FMJ 50rd', '9×19mm Parabellum', '4', '200', '$75.96', '$0.38'],
			['2026-10-25', 'CCI Blazer Brass .45 ACP 230gr FMJ 50rd', '.45 ACP', '1', '50', '$27.49', '$0.55'],
			['2026-11-01', 'Winchester 9mm 115gr FMJ 1000 Round Case', '9×19mm Parabellum', '1', '1,000', '$289.99', '$0.29'],
		]);
		expect(log?.rows('tfoot')).toEqual([['Total', '6', '1,250', '$393.44', '$0.31']]);
		expect(calibers?.rows()[0]).toEqual(['9×19mm Parabellum', '1,200', '$365.95', '$0.30']);
	});

	it('round count spellings and the no-pipe form', () => {
		for (const t of ['Federal 9mm 50rd', 'Federal 9mm 20 rounds', 'Federal 9mm box of 25', 'Federal 9mm 50/box']) {
			expect(roundsPerBox(t)).toBeGreaterThan(0);
		}
		expect(roundsPerBox('Winchester 9mm 115gr FMJ 1000 Round Case')).toBe(1000);
		expect(splitLine('2026-10-20 Federal 9mm 50rd $18.99')).toEqual({
			date: '2026-10-20',
			text: 'Federal 9mm 50rd',
			price: 18.99,
			total: false,
		});
	});

	it('normalize command table', () => {
		expect(normalizeCalibersInText('9mm Luger').text).toBe('9×19mm Parabellum');
		expect(normalizeCalibersInText('300 BLK').text).toBe('.300 AAC Blackout');
		expect(normalizeCalibersInText('caliber: 6.5 CM').text).toBe('caliber: 6.5mm Creedmoor');
		expect(normalizeCalibersInText('| 7.62x39 | 30-06 |').text).toBe('| 7.62x39mm | .30-06 Springfield |');
		expect(normalizeCalibersInText('9mm 115gr FMJ').changed).toBe(0);
		expect(normalizeCalibersInText('9mm +P').changed).toBe(0);
	});
});
