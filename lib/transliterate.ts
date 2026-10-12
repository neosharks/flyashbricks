/**
 * Offline English ⇄ Hindi spelling suggestions for names, so whoever types a
 * customer or material once gets the other script filled in. Runs in the
 * browser and on the server, with no network call and nothing leaving the app.
 *
 * It is phonetic transliteration of Hinglish spelling ("Ramesh" → "रमेश"),
 * not translation, with a small dictionary for the words this trade uses most
 * (surnames, materials) where sound alone guesses wrong. The result is always
 * a suggestion people can correct.
 */

/** Whole words, matched case-insensitively, where the phonetic rules guess wrong. */
const EN_TO_HI: Record<string, string> = {
  singh: 'सिंह',
  kumar: 'कुमार',
  sharma: 'शर्मा',
  verma: 'वर्मा',
  gupta: 'गुप्ता',
  agarwal: 'अग्रवाल',
  aggarwal: 'अग्रवाल',
  yadav: 'यादव',
  meena: 'मीणा',
  jat: 'जाट',
  saini: 'सैनी',
  choudhary: 'चौधरी',
  chaudhary: 'चौधरी',
  ram: 'राम',
  shyam: 'श्याम',
  shree: 'श्री',
  shri: 'श्री',
  sri: 'श्री',
  ganesh: 'गणेश',
  lal: 'लाल',
  devi: 'देवी',
  jaipur: 'जयपुर',
  delhi: 'दिल्ली',
  // Uttar Pradesh towns around the plant, where sound alone guesses wrong.
  ghaziabad: 'ग़ाज़ियाबाद',
  noida: 'नोएडा',
  meerut: 'मेरठ',
  hapur: 'हापुड़',
  bulandshahr: 'बुलंदशहर',
  dadri: 'दादरी',
  modinagar: 'मोदीनगर',
  loni: 'लोनी',
  muradnagar: 'मुरादनगर',
  pilkhuwa: 'पिलखुआ',
  sikandrabad: 'सिकंदराबाद',
  greater: 'ग्रेटर',
  uttar: 'उत्तर',
  pradesh: 'प्रदेश',
  // Trade words: the usual Hindi names, not spelled-out English.
  fly: 'फ्लाई',
  ash: 'ऐश',
  cement: 'सीमेंट',
  stone: 'स्टोन',
  dust: 'डस्ट',
  sand: 'रेत',
  lime: 'चूना',
  gypsum: 'जिप्सम',
  brick: 'ईंट',
  bricks: 'ईंटें',
  water: 'पानी',
  builders: 'बिल्डर्स',
  builder: 'बिल्डर',
  construction: 'कंस्ट्रक्शन',
  contractor: 'ठेकेदार',
  developers: 'डेवलपर्स',
  infra: 'इंफ्रा',
  enterprises: 'एंटरप्राइजेज',
  traders: 'ट्रेडर्स',
  and: 'एंड',
  co: 'कंपनी',
};

const HI_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_HI).map(([en, hi]) => [hi, en]),
);

/** Consonant spellings, longest first so "ksh" wins over "k". */
const CONSONANTS: [string, string][] = [
  ['ksh', 'क्ष'],
  ['chh', 'छ'],
  ['shr', 'श्र'],
  ['ch', 'च'],
  ['sh', 'श'],
  ['kh', 'ख'],
  ['gh', 'घ'],
  ['th', 'थ'],
  ['dh', 'ध'],
  ['ph', 'फ'],
  ['bh', 'भ'],
  ['jh', 'झ'],
  ['k', 'क'],
  ['g', 'ग'],
  ['c', 'क'],
  ['j', 'ज'],
  ['t', 'त'],
  ['d', 'द'],
  ['n', 'न'],
  ['p', 'प'],
  ['b', 'ब'],
  ['m', 'म'],
  ['y', 'य'],
  ['r', 'र'],
  ['l', 'ल'],
  ['v', 'व'],
  ['w', 'व'],
  ['s', 'स'],
  ['h', 'ह'],
  ['f', 'फ़'],
  ['z', 'ज़'],
  ['q', 'क'],
  ['x', 'क्स'],
];

/** Vowel spellings: [latin, standalone letter, sign after a consonant]. */
const VOWELS: [string, string, string][] = [
  ['aa', 'आ', 'ा'],
  ['ai', 'ऐ', 'ै'],
  ['au', 'औ', 'ौ'],
  ['ou', 'औ', 'ौ'],
  ['ee', 'ई', 'ी'],
  ['ii', 'ई', 'ी'],
  ['oo', 'ऊ', 'ू'],
  ['uu', 'ऊ', 'ू'],
  ['a', 'अ', ''],
  ['i', 'इ', 'ि'],
  ['u', 'उ', 'ु'],
  ['e', 'ए', 'े'],
  ['o', 'ओ', 'ो'],
];

const HALANT = '्';

function matchAt<T extends [string, ...string[]]>(
  table: T[],
  word: string,
  index: number,
): T | null {
  for (const entry of table) if (word.startsWith(entry[0], index)) return entry;
  return null;
}

function wordToHindi(word: string): string {
  const lower = word.toLowerCase();
  const known = EN_TO_HI[lower];
  if (known) return known;
  // Codes such as "OPC" or "RJ14" stay as they are.
  if (/^[A-Z0-9]{2,6}$/.test(word) || !/[a-z]/i.test(word)) return word;

  let out = '';
  let index = 0;
  let afterConsonant = false;

  while (index < lower.length) {
    const vowel = matchAt(VOWELS, lower, index);
    if (vowel) {
      const [latin, standalone, sign] = vowel;
      // A word-final "a" after a consonant is usually long in names: Sharma, Meena.
      const finalA =
        latin === 'a' && index === lower.length - 1 && afterConsonant && lower.length > 3;
      out += afterConsonant ? (finalA ? 'ा' : sign) : standalone;
      afterConsonant = false;
      index += latin.length;
      continue;
    }

    const consonant = matchAt(CONSONANTS, lower, index);
    if (consonant) {
      if (afterConsonant) out += HALANT;
      out += consonant[1];
      afterConsonant = true;
      index += consonant[0].length;
      continue;
    }

    out += lower.charAt(index);
    afterConsonant = false;
    index += 1;
  }
  return out;
}

export function toHindi(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) => wordToHindi(word));
}

const HI_CONSONANTS: Record<string, string> = {
  क: 'k',
  ख: 'kh',
  ग: 'g',
  घ: 'gh',
  ङ: 'n',
  च: 'ch',
  छ: 'chh',
  ज: 'j',
  झ: 'jh',
  ञ: 'n',
  ट: 't',
  ठ: 'th',
  ड: 'd',
  ढ: 'dh',
  ण: 'n',
  त: 't',
  थ: 'th',
  द: 'd',
  ध: 'dh',
  न: 'n',
  प: 'p',
  फ: 'ph',
  ब: 'b',
  भ: 'bh',
  म: 'm',
  य: 'y',
  र: 'r',
  ल: 'l',
  व: 'v',
  श: 'sh',
  ष: 'sh',
  स: 's',
  ह: 'h',
  क़: 'q',
  ख़: 'kh',
  ग़: 'g',
  ज़: 'z',
  ड़: 'r',
  ढ़: 'rh',
  फ़: 'f',
};

const HI_VOWELS: Record<string, string> = {
  अ: 'a',
  आ: 'aa',
  इ: 'i',
  ई: 'ee',
  उ: 'u',
  ऊ: 'oo',
  ऋ: 'ri',
  ए: 'e',
  ऐ: 'ai',
  ओ: 'o',
  औ: 'au',
};

const HI_SIGNS: Record<string, string> = {
  'ा': 'a',
  'ि': 'i',
  'ी': 'ee',
  'ु': 'u',
  'ू': 'oo',
  'ृ': 'ri',
  'े': 'e',
  'ै': 'ai',
  'ो': 'o',
  'ौ': 'au',
};

function wordToEnglish(word: string): string {
  const known = HI_TO_EN[word];
  if (known) return known.charAt(0).toUpperCase() + known.slice(1);

  // Precomposed nukta letters are split by NFD; recombine them for lookup.
  // Code points are exactly the unit here: every vowel sign and halant is its own one.
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  const chars = [...word.normalize('NFC')];
  let out = '';
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] ?? '';
    const next = chars[index + 1] ?? '';
    const consonant = HI_CONSONANTS[char];
    if (consonant !== undefined) {
      out += consonant;
      if (next === HALANT) {
        index += 1;
      } else if (HI_SIGNS[next] !== undefined) {
        out += HI_SIGNS[next];
        index += 1;
      } else if (index + 1 < chars.length && next !== 'ं' && next !== 'ँ') {
        // Inherent "a", dropped at the end of a word as Hindi is spoken: राम → Ram.
        out += 'a';
      } else if (next === 'ं' || next === 'ँ') {
        out += 'a';
      }
      continue;
    }
    if (HI_VOWELS[char] !== undefined) {
      out += HI_VOWELS[char];
      continue;
    }
    if (char === 'ं' || char === 'ँ') {
      out += 'n';
      continue;
    }
    if (char === 'ः' || char === HALANT || char === '़') continue;
    out += /[०-९]/.test(char) ? String(char.charCodeAt(0) - 0x0966) : char;
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function toEnglish(text: string): string {
  return text.replace(/[ऀ-ॿ]+/g, (word) => wordToEnglish(word));
}
