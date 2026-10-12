import { describe, expect, it } from 'vitest';
import { csvCell, csvRow, csvRupees } from './csv';

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Sharma, Ram')).toBe('"Sharma, Ram"');
    expect(csvCell('6" brick')).toBe('"6"" brick"');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('neutralises spreadsheet formulas in typed text', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+91 call')).toBe("'+91 call");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('-5+cmd')).toBe("'-5+cmd");
  });

  it('keeps negative amounts numeric', () => {
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell(csvRupees(-150))).toBe('-1.50');
  });

  it('leaves numbers as numbers and blanks as empty', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(null)).toBe('');
    expect(csvCell('राम कुमार')).toBe('राम कुमार');
  });
});

describe('csvRow', () => {
  it('ends every row with CRLF', () => {
    expect(csvRow(['a', 1, null])).toBe('a,1,\r\n');
  });
});

describe('csvRupees', () => {
  it('writes paise as a two-decimal rupee amount', () => {
    expect(csvRupees(125_050)).toBe('1250.50');
    expect(csvRupees(7)).toBe('0.07');
    expect(csvRupees(-150)).toBe('-1.50');
  });
});
