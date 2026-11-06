import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	extractPrice,
	extractQuantity,
	formatMoney,
	formatPerRound,
	isCaliberOnly,
	normalizeCalibersInText,
	parseLogLine,
	parseSpecsBlock,
	productSpecs,
	splitLine,
	summarizeLog,
} from '../src/core';

const S = DEFAULT_SETTINGS;

describe('prices and lines', () => {
	it('finds prices written with a currency symbol', () => {
		expect(extractPrice('Federal 9mm 115gr 50rd $18.99')).toEqual({
			price: 18.99,
			total: false,
			rest: 'Federal 9mm 115gr 50rd',
		});
		expect(extractPrice('Glock 19 - $1,299.00')?.price).toBe(1299);
		expect(extractPrice('PMC 5.56 1000rd 449.00 USD')?.price).toBe(449);
		expect(extractPrice('Federal 9mm 50rd x4 $75.96 total')).toEqual({
			price: 75.96,
			total: true,
			rest: 'Federal 9mm 50rd x4',
		});
		expect(extractPrice('Glock 19 Gen 5 9mm 4.02" 15rd')).toBeNull();
		expect(extractPrice('Sellier 9mm 50rd €17.50', '€')?.price).toBe(17.5);
	});

	it('splits pipe-separated log lines', () => {
		expect(splitLine('2026-10-20 | Federal 9mm 115gr FMJ 50rd x4 | $18.99')).toEqual({
			date: '2026-10-20',
			text: 'Federal 9mm 115gr FMJ 50rd x4',
			price: 18.99,
			total: false,
		});
		expect(splitLine('- Federal 9mm 50rd | 18.99')).toMatchObject({ date: null, price: 18.99 });
		expect(splitLine('2026-10-20 Federal 9mm 50rd $18.99')).toMatchObject({
			date: '2026-10-20',
			text: 'Federal 9mm 50rd',
			price: 18.99,
		});
		expect(splitLine('10/20/2026 | Federal 9mm 50rd | $75.96 total')).toMatchObject({
			date: '10/20/2026',
			price: 75.96,
			total: true,
		});
	});

	it('formats money and cost per round', () => {
		expect(formatMoney(1234.5, '$')).toBe('$1,234.50');
		expect(formatMoney(18.99, 'EUR')).toBe('EUR 18.99');
		expect(formatPerRound(0.3798, '$')).toBe('$0.38');
		expect(formatPerRound(0.066, '$')).toBe('$0.066');
	});
});

describe('gunspecs', () => {
	it('reads an ammo title with a price', () => {
		const p = productSpecs('Federal 9mm 115gr 50rd $18.99', S);
		expect(p?.title).toBe('Federal 9mm 115gr 50rd');
		expect(p?.rows.map((r) => [r.label, r.value])).toEqual([
			['Type', 'Ammo'],
			['Caliber', '9×19mm Parabellum'],
			['Rounds per box', '50'],
			['Price', '$18.99'],
			['Cost per round', '$0.38'],
		]);
		expect(p?.rows.some((r) => r.href)).toBe(false);
	});

	it('links the caliber only when the setting is on', () => {
		const p = productSpecs('Federal 9mm 115gr 50rd', { ...S, linkCalibers: true });
		const cal = p?.rows.find((r) => r.key === 'caliber');
		expect(cal?.href).toBe('https://gunsnprices.com/ammo/handgun-ammo/9-19mm-parabellum');
	});

	it('reads a firearm title', () => {
		const p = productSpecs('Glock 19 Gen 5 MOS 9mm 4.02" 15rd Pistol | $549', S);
		expect(Object.fromEntries(p?.rows.map((r) => [r.label, r.value]) ?? [])).toEqual({
			Type: 'Firearm',
			Brand: 'Glock',
			Model: 'Glock 19 Gen 5 MOS',
			Configuration: 'MOS',
			Caliber: '9×19mm Parabellum',
			Capacity: '15 rounds',
			Barrel: '4.02"',
			Price: '$549.00',
		});
	});

	it('reads a block with comments and a layout line', () => {
		const block = parseSpecsBlock(
			['layout: compare', '# my list', '', 'Ruger 10/22 Carbine .22 LR 18.5" 10rd', 'CCI Blazer Brass .45 ACP 230gr FMJ 50rd $27.49'].join('\n'),
			S,
		);
		expect(block.layout).toBe('compare');
		expect(block.products.map((p) => p.title)).toEqual([
			'Ruger 10/22 Carbine .22 LR 18.5" 10rd',
			'CCI Blazer Brass .45 ACP 230gr FMJ 50rd',
		]);
		expect(block.products[1]?.info.costPerRound).toBe(0.5498);
	});
});

describe('ammo-log', () => {
	it('reads box counts without eating calibers', () => {
		expect(extractQuantity('Federal 9mm 115gr FMJ 50rd x4')).toEqual({ boxes: 4, rest: 'Federal 9mm 115gr FMJ 50rd' });
		expect(extractQuantity('Federal 9mm 50rd × 2').boxes).toBe(2);
		expect(extractQuantity('Federal 9mm 50rd 3 boxes').boxes).toBe(3);
		expect(extractQuantity('Federal 9mm 50rd qty 5').boxes).toBe(5);
		expect(extractQuantity('2x Federal 9mm 50rd').boxes).toBe(2);
		expect(extractQuantity('Fiocchi 9 x 19 FMJ 50rd')).toEqual({ boxes: 1, rest: 'Fiocchi 9 x 19 FMJ 50rd' });
		expect(extractQuantity('Wolf 7.62x39 123gr 20rd').boxes).toBe(1);
	});

	it('totals rounds, money and average cost per round', () => {
		const log = summarizeLog(
			[
				'2026-10-20 | Federal 9mm 115gr FMJ 50rd x4 | $18.99',
				'2026-10-25 | CCI Blazer Brass .45 ACP 230gr FMJ 50rd | $27.49',
				'2026-11-01 | Winchester 9mm 115gr FMJ 1000 Round Case | $289.99 total',
			].join('\n'),
		);
		expect(log.entries).toHaveLength(3);
		expect(log.entries[0]).toMatchObject({ date: '2026-10-20', boxes: 4, roundsPerBox: 50, rounds: 200 });
		expect(log.entries[0]?.spent).toBeCloseTo(75.96, 6);
		expect(log.entries[0]?.costPerRound).toBeCloseTo(0.3798, 6);
		expect(log.boxes).toBe(6);
		expect(log.rounds).toBe(1250);
		expect(log.spent).toBeCloseTo(393.44, 6);
		expect(log.costPerRound).toBeCloseTo(393.44 / 1250, 9);
		expect(log.byCaliber.map((g) => [g.name, g.rounds])).toEqual([
			['9×19mm Parabellum', 1200],
			['.45 ACP', 50],
		]);
		expect(log.byCaliber[0]?.costPerRound).toBeCloseTo(365.95 / 1200, 9);
		expect(log.missingRounds).toBe(0);
		expect(log.missingPrice).toBe(0);
	});

	it('treats a "total" price as the price of all boxes', () => {
		const e = parseLogLine('Federal 9mm 115gr FMJ 50rd x4 | $75.96 total', 1);
		expect(e?.spent).toBeCloseTo(75.96, 6);
		expect(e?.costPerRound).toBeCloseTo(0.3798, 6);
	});

	it('keeps lines without rounds or price out of the average', () => {
		const log = summarizeLog(['Federal 9mm 50rd | $20', 'Mystery 9mm ammo | $10', '2026-11-02 | Federal 9mm 50rd'].join('\n'));
		expect(log.missingRounds).toBe(1);
		expect(log.missingPrice).toBe(1);
		expect(log.rounds).toBe(100);
		expect(log.spent).toBe(30);
		expect(log.costPerRound).toBeCloseTo(0.4, 9);
	});
});

describe('caliber normalization', () => {
	it('recognizes text that is only a caliber', () => {
		expect(isCaliberOnly('9mm Luger')).toBe(true);
		expect(isCaliberOnly('300 BLK')).toBe(true);
		expect(isCaliberOnly('9x19 (9mm Luger)')).toBe(true);
		expect(isCaliberOnly('9mm 115gr FMJ')).toBe(false);
		expect(isCaliberOnly('9mm +P')).toBe(false);
		expect(isCaliberOnly('Luger')).toBe(false);
		expect(isCaliberOnly('9mm / .45 ACP')).toBe(false);
	});

	it('rewrites calibers and leaves other text alone', () => {
		expect(normalizeCalibersInText('9mm Luger')).toEqual({ text: '9×19mm Parabellum', changed: 1 });
		expect(normalizeCalibersInText('caliber: 300 BLK').text).toBe('caliber: .300 AAC Blackout');
		expect(normalizeCalibersInText('- 5.56\n- 12 GA\n- 9mm 115gr FMJ')).toEqual({
			text: '- 5.56×45mm NATO\n- 12 Gauge\n- 9mm 115gr FMJ',
			changed: 2,
		});
		expect(normalizeCalibersInText('| 7.62x39 | 30-06 |').text).toBe('| 7.62x39mm | .30-06 Springfield |');
		expect(normalizeCalibersInText('**6.5 CM**, [[45 auto]]').text).toBe('**6.5mm Creedmoor**, [[.45 ACP]]');
		expect(normalizeCalibersInText('.308 Win').changed).toBe(0);
		expect(normalizeCalibersInText('Federal 9mm 115gr FMJ 50rd').changed).toBe(0);
	});
});
