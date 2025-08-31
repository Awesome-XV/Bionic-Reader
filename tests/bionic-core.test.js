const { calculateBoldCount, transformWord, transformText } = require('../src/bionic-core');

describe('bionic-core', () => {
  test('calculateBoldCount small words', () => {
    expect(calculateBoldCount('a')).toBe(0);
    expect(calculateBoldCount('an')).toBe(1);
    expect(calculateBoldCount('the')).toBe(2);
  });

  test('calculateBoldCount longer words at default intensity', () => {
    expect(calculateBoldCount('reading')).toBeGreaterThanOrEqual(2);
    expect(calculateBoldCount('processing')).toBeGreaterThanOrEqual(3);
  });

  test('transformWord wraps letters in bold tags', () => {
    const out = transformWord('reading', 0.5);
    expect(out).toMatch(/<b>r<\/b>/i);
  // ensure some letters after bolded prefix remain unbolded (suffix present)
  expect(out.endsWith('ing')).toBe(true);
  });

  test('transformText preserves whitespace and punctuation', () => {
    const inText = 'Hello, world!';
    const out = transformText(inText, 0.5);
    expect(out).toContain(',');
    expect(out).toContain('!');
    expect(out.split(/(\s+)/).length).toBeGreaterThan(1);
  });

  test('handles numbers and symbols without failing', () => {
    const inText = '1234 !!! @@@';
    const out = transformText(inText, 0.5);
    expect(out).toBe(inText);
  });

  test('empty and null inputs', () => {
    expect(transformText('', 0.5)).toBe('');
    expect(transformText(null, 0.5)).toBeNull();
  });

  test('calculateBoldCount with non-string and undefined', () => {
    expect(calculateBoldCount(undefined)).toBe(0);
    expect(calculateBoldCount(12345)).toBe(0);
  });

  test('transformWord handles empty/undefined safely', () => {
    expect(transformWord('', 0.5)).toBe('');
    expect(transformWord(undefined, 0.5)).toBeUndefined();
  });

  test('short words return unchanged or minimal bolding', () => {
    expect(transformWord('a', 0.5)).toBe('a');
    expect(transformWord('an', 0.5)).toMatch(/<b>a<\/b>n/i);
  });

  test('transformText preserves explicit whitespace tokens', () => {
    const out = transformText('one\t two', 0.5);
    // should contain tab preserved
    expect(out).toContain('\t');
  });

  test('uses default intensity when omitted', () => {
    const outWord = transformWord('reading');
    expect(outWord).toMatch(/<b>r<\/b>/i);

    const outText = transformText('hello world');
    expect(outText).toContain(' ');
  });
});
