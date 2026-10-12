/**
 * Rupee amounts in words for invoices, in the Indian system
 * (thousand, lakh, crore) — "Rupees One Lakh Twenty Thousand Only".
 */

const EN_ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const EN_TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

/** Hindi numbers below 100 are irregular words, not tens + ones, so they are listed. */
const HI_UPTO_99 = [
  '',
  'एक',
  'दो',
  'तीन',
  'चार',
  'पाँच',
  'छह',
  'सात',
  'आठ',
  'नौ',
  'दस',
  'ग्यारह',
  'बारह',
  'तेरह',
  'चौदह',
  'पंद्रह',
  'सोलह',
  'सत्रह',
  'अठारह',
  'उन्नीस',
  'बीस',
  'इक्कीस',
  'बाईस',
  'तेईस',
  'चौबीस',
  'पच्चीस',
  'छब्बीस',
  'सत्ताईस',
  'अट्ठाईस',
  'उनतीस',
  'तीस',
  'इकतीस',
  'बत्तीस',
  'तैंतीस',
  'चौंतीस',
  'पैंतीस',
  'छत्तीस',
  'सैंतीस',
  'अड़तीस',
  'उनतालीस',
  'चालीस',
  'इकतालीस',
  'बयालीस',
  'तैंतालीस',
  'चवालीस',
  'पैंतालीस',
  'छियालीस',
  'सैंतालीस',
  'अड़तालीस',
  'उनचास',
  'पचास',
  'इक्यावन',
  'बावन',
  'तिरपन',
  'चौवन',
  'पचपन',
  'छप्पन',
  'सत्तावन',
  'अट्ठावन',
  'उनसठ',
  'साठ',
  'इकसठ',
  'बासठ',
  'तिरसठ',
  'चौंसठ',
  'पैंसठ',
  'छियासठ',
  'सड़सठ',
  'अड़सठ',
  'उनहत्तर',
  'सत्तर',
  'इकहत्तर',
  'बहत्तर',
  'तिहत्तर',
  'चौहत्तर',
  'पचहत्तर',
  'छिहत्तर',
  'सतहत्तर',
  'अठहत्तर',
  'उन्यासी',
  'अस्सी',
  'इक्यासी',
  'बयासी',
  'तिरासी',
  'चौरासी',
  'पचासी',
  'छियासी',
  'सत्तासी',
  'अट्ठासी',
  'नवासी',
  'नब्बे',
  'इक्यानवे',
  'बानवे',
  'तिरानवे',
  'चौरानवे',
  'पचानवे',
  'छियानवे',
  'सत्तानवे',
  'अट्ठानवे',
  'निन्यानवे',
];

type Lang = 'en' | 'hi';

const SCALE: Record<Lang, { crore: string; lakh: string; thousand: string; hundred: string }> = {
  en: { crore: 'Crore', lakh: 'Lakh', thousand: 'Thousand', hundred: 'Hundred' },
  hi: { crore: 'करोड़', lakh: 'लाख', thousand: 'हज़ार', hundred: 'सौ' },
};

function below100(n: number, lang: Lang): string {
  if (lang === 'hi') return HI_UPTO_99[n] ?? '';
  if (n < 20) return EN_ONES[n] ?? '';
  const ones = n % 10;
  return `${EN_TENS[Math.floor(n / 10)] ?? ''}${ones ? ` ${EN_ONES[ones] ?? ''}` : ''}`;
}

function below1000(n: number, lang: Lang): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${below100(hundreds, lang)} ${SCALE[lang].hundred}`);
  if (rest) parts.push(below100(rest, lang));
  return parts.join(' ');
}

/** Whole number in words; crores above 99 recurse ("One Hundred Crore"). */
export function numberInWords(value: number, lang: Lang = 'en'): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return lang === 'hi' ? 'शून्य' : 'Zero';

  const scale = SCALE[lang];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${numberInWords(crore, lang)} ${scale.crore}`);
  if (lakh) parts.push(`${below100(lakh, lang)} ${scale.lakh}`);
  if (thousand) parts.push(`${below100(thousand, lang)} ${scale.thousand}`);
  if (rest) parts.push(below1000(rest, lang));
  return parts.join(' ');
}

export function amountInWords(paise: number, lang: Lang = 'en'): string {
  const rupees = Math.floor(Math.abs(paise) / 100);
  const remainder = Math.abs(paise) % 100;

  if (lang === 'hi') {
    const main = `${numberInWords(rupees, 'hi')} रुपये`;
    return remainder ? `${main} और ${numberInWords(remainder, 'hi')} पैसे मात्र` : `${main} मात्र`;
  }
  const main = `Rupees ${numberInWords(rupees, 'en')}`;
  return remainder ? `${main} and ${numberInWords(remainder, 'en')} Paise Only` : `${main} Only`;
}
