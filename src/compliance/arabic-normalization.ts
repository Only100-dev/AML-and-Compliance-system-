/**
 * Arabic Phonetic Normalization Module — IC-OS Compliance Platform
 *
 * Provides Arabic-to-Latin transliteration, phonetic variant generation,
 * and Arabic name comparison for sanctions screening.
 *
 * Supports:
 * - Arabic character to Latin mapping
 * - Common Arabic name transliteration variants
 * - Phonetic variant generation for the 100 most common Arabic names
 * - Arabic name comparison with similarity scoring
 * - Arabic script detection
 */

// ─── Arabic-to-Latin Character Map ─────────────────────────────────────────

export const ARABIC_TO_LATIN_MAP: Record<string, string> = {
  // Arabic letters
  'ا': 'a',   // Alif
  'أ': 'a',   // Alif with hamza above
  'إ': 'i',   // Alif with hamza below
  'آ': 'aa',  // Alif madda
  'ب': 'b',   // Ba
  'پ': 'p',   // Pa (Persian/Urdu)
  'ت': 't',   // Ta
  'ث': 'th',  // Tha
  'ج': 'j',   // Jim
  'چ': 'ch',  // Cha (Persian/Urdu)
  'ح': 'h',   // Ha
  'خ': 'kh',  // Kha
  'د': 'd',   // Dal
  'ذ': 'dh',  // Dhal
  'ر': 'r',   // Ra
  'ز': 'z',   // Zay
  'ژ': 'zh',  // Zha (Persian/Urdu)
  'س': 's',   // Sin
  'ش': 'sh',  // Shin
  'ص': 's',   // Sad
  'ض': 'd',   // Dad
  'ط': 't',   // Tta
  'ظ': 'z',   // Ttha
  'ع': 'a',   // Ain
  'غ': 'gh',  // Ghain
  'ف': 'f',   // Fa
  'ق': 'q',   // Qaf
  'ك': 'k',   // Kaf
  'گ': 'g',   // Gaf (Persian/Urdu)
  'ل': 'l',   // Lam
  'م': 'm',   // Mim
  'ن': 'n',   // Nun
  'ه': 'h',   // Ha
  'و': 'w',   // Waw
  'ؤ': 'ou',  // Waw with hamza
  'ي': 'y',   // Ya
  'ئ': 'y',   // Ya with hamza
  'ى': 'a',   // Alif maqsura
  'ة': 'a',   // Ta marbuta
  // Diacritics (tashkeel) — typically stripped
  'ّ': '',    // Shadda
  'ً': '',    // Fathatan
  'ٌ': '',    // Dammatan
  'ٍ': '',    // Kasratan
  'َ': 'a',   // Fatha
  'ُ': 'u',   // Damma
  'ِ': 'i',   // Kasra
  'ْ': '',    // Sukun
  // Arabic numerals
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

// ─── Arabic Name Variants Dictionary ────────────────────────────────────────
// The 100 most common Arabic names with their transliteration variants

export const ARABIC_NAME_VARIANTS: Record<string, string[]> = {
  // Male names
  'محمد': ['Muhammad', 'Mohammed', 'Mohammad', 'Mohamed', 'Muhamad', 'Muhamed', 'Mehmet', 'Mahomet', 'Mahammed'],
  'أحمد': ['Ahmed', 'Ahmad', 'Achmad', 'Ahmet'],
  'علي': ['Ali', 'Aly', 'Alee'],
  'حسين': ['Hussein', 'Hussain', 'Hossein', 'Husein', 'Husain'],
  'عبدالله': ['Abdullah', 'Abdallah', 'Abdulah', 'Abdulla', 'Abdellah'],
  'عبدالرحمن': ['Abdulrahman', 'Abderrahmane', 'Abdulrahmane', 'Abdul Rehman', 'Abd al-Rahman'],
  'خالد': ['Khalid', 'Khaled', 'Kaleed', 'Chalid'],
  'عمر': ['Omar', 'Omer', 'Umar', 'Omero'],
  'يوسف': ['Yousuf', 'Yusuf', 'Yousef', 'Yusoff', 'Joseph', 'Youseff'],
  'إبراهيم': ['Ibrahim', 'Ibraheem', 'Ebrahim', 'Ebraheem', 'Abraham'],
  'حسن': ['Hasan', 'Hassan', 'Hassen', 'Hacen'],
  'سعيد': ['Saeed', 'Said', 'Saeid', 'Sayeed', 'Saidi'],
  'طارق': ['Tariq', 'Tareq', 'Tarek', 'Tarik', 'Tariq'],
  'ماجد': ['Majid', 'Majeed', 'Magid'],
  'فهد': ['Fahad', 'Fahd', 'Fahed'],
  'سلطان': ['Sultan', 'Soltan'],
  'ناصر': ['Nasser', 'Naser', 'Nassir', 'Nasir'],
  'مشعل': ['Mishaal', 'Mishal', 'Mishael', 'Meshaal'],
  'بدر': ['Badr', 'Badar', 'Bader'],
  'فيصل': ['Faisal', 'Faysal', 'Faisal', 'Feisal'],
  'سعود': ['Saud', 'Saoud', 'Saaud'],
  'تركي': ['Turki', 'Torkey', 'Turkie'],
  'عبدالعزيز': ['Abdulaziz', 'Abdelaziz', 'Abdul Aziz', 'Abd al-Aziz'],
  'منصور': ['Mansour', 'Mansoor', 'Mansur'],
  'راشد': ['Rashid', 'Rashed', 'Rasheed', 'Rachid'],
  'حمزة': ['Hamza', 'Hamzah', 'Hamzeh'],
  'وليد': ['Walid', 'Waleed', "Waleed", 'Oualid'],
  'زياد': ['Ziad', 'Ziyad', 'Zeyad', 'Ziyed'],
  'أنس': ['Anas', 'Anass', 'Enas'],
  'بلال': ['Bilal', 'Belal', 'Bilaal'],
  'عمرو': ['Amr', 'Amro', 'Omar'],
  'كريم': ['Karim', 'Kareem', 'Kareem', 'Kerim'],
  'هشام': ['Hisham', 'Hesham', 'Hicham'],
  'محمود': ['Mahmoud', 'Mahmud', 'Mehmoud', 'Mahmood'],
  'جمال': ['Jamal', 'Jamaal', 'Djemal', 'Gamal'],
  'أسامة': ['Osama', 'Usama', 'Oussama'],
  'ياسر': ['Yasser', 'Yaser', 'Yasir', 'Yassine'],
  'صالح': ['Salih', 'Saleh', 'Salah', 'Salleh'],
  'عادل': ['Adel', 'Adil', 'Aadel', 'Adel'],
  'شريف': ['Sharif', 'Sherif', 'Cherif', 'Shareef'],
  'مصطفى': ['Mustafa', 'Mostafa', 'Moustafa', 'Mustapha'],
  'إسماعيل': ['Ismail', 'Ismail', 'Ishmael', 'Ismaeel'],
  'داود': ['Dawood', 'Daoud', 'David', 'Daud'],
  'يحيى': ['Yahya', 'Yahia', 'Yehia', 'Yahia'],
  'زكريا': ['Zakaria', 'Zakariya', 'Zakariyah', 'Zacharia'],
  'محسن': ['Mohsen', 'Muhsen', 'Mouhsen', 'Muhsin'],
  'رائد': ['Raed', 'Raid', 'Raed'],
  'عزام': ['Azzam', 'Azam'],
  'طه': ['Taha', 'Tahe'],
  'نادر': ['Nader', 'Nadhir', 'Nadher'],
  // Female names
  'فاطمة': ['Fatima', 'Fatma', 'Fatimah', 'Fatemeh'],
  'عائشة': ['Aisha', 'Ayesha', 'Aysha', 'Aicha', 'Aishah'],
  'مريم': ['Mariam', 'Maryam', 'Miriam', 'Mariyam'],
  'نورة': ['Noura', 'Nora', 'Noora', 'Nourah'],
  'سارة': ['Sara', 'Sarah', 'Sarra'],
  'ليلى': ['Layla', 'Leila', 'Laila', 'Laylah', 'Leilah'],
  'هدى': ['Huda', 'Houda', 'Houda'],
  'ريم': ['Reem', 'Rim', 'Riim'],
  'منى': ['Mona', 'Muna', 'Mouna'],
  'أمل': ['Amal', 'Amel', 'Amaal'],
  'هالة': ['Hala', 'Halah', 'Haala'],
  'سميرة': ['Samira', 'Sameera', 'Samirah', 'Samira'],
  'نجلاء': ['Najla', 'Najlaa', 'Najlah'],
  'شيما': ['Shaimaa', 'Shaymaa', 'Shaima', 'Chaimae'],
  'دانة': ['Dana', 'Danna', 'Daana'],
  'لمياء': ['Lamia', 'Lamya', 'Lamya'],
  'رنا': ['Rana', 'Ranna'],
  'مها': ['Maha', 'Maha'],
  'غادة': ['Ghada', 'Ghadeer', 'Ghadaa'],
  'حنان': ['Hanan', 'Hanaan'],
  'زينب': ['Zainab', 'Zeinab', 'Zaynab', 'Zineb'],
  'خديجة': ['Khadija', 'Khadijah', 'Khadidja', 'Khadija'],
  'آمنة': ['Amina', 'Amenah', 'Amena', 'Aminah'],
  'سعاد': ['Suad', 'Souad', "Sou'ad"],
  'لطيفة': ['Latifa', 'Lateefa', 'Latifah'],
  'نادية': ['Nadia', 'Nadia', 'Nadiya', 'Nadiyah'],
  'هيفاء': ['Haifa', 'Hayfaa', 'Hayfa'],
  'رانية': ['Rania', 'Ranya', 'Raniya'],
  'دينا': ['Dina', 'Deena', 'Dena'],
  'بثينة': ['Buthaina', 'Bouthaina', 'Buthayna'],
  'عبير': ['Abeer', 'Abeir', 'Abir'],
  'شيماء': ['Shaymaa', 'Shaimaa', 'Chaimaa'],
  'إيمان': ['Iman', 'Eman', 'Imaan', 'Imane'],
  'رويدة': ['Ruwaida', 'Rowaida', 'Rweida'],
  'سلمى': ['Salma', 'Selma', 'Thelma'],
  'ندى': ['Nada', 'Nadaa'],
  'أسماء': ['Asmaa', 'Asma', 'Asmah', 'Asma'],
  'تغريد': ['Taghreed', 'Tagrid', 'Taghrid'],
  'هند': ['Hind', 'Hend'],
  'ولاء': ['Walaa', 'Walaa', 'Wala'],
  'رغدة': ['Raghda', 'Raghad', 'Raghdaa'],
  'بسمة': ['Basma', 'Bassma', 'Basmaa'],
  'جواهر': ['Jawaher', 'Jawahir', 'Jawaher'],
  'مديحة': ['Madiha', 'Madihah', 'Madiha'],
  'صباح': ['Sabah', 'Sabbah', 'Sabah'],
  'كريمة': ['Karima', 'Kareema', 'Karimah'],
  'نبيهة': ['Nabiha', 'Nabeeha', 'Nabila'],
  'عزيزة': ['Aziza', 'Azizah', 'Azeza'],
  'رفيقة': ['Rafika', 'Rafeeqa', 'Rafika'],
  'شريفة': ['Sharifa', 'Shareefa', 'Cherifa'],
  'طيبة': ['Tayba', 'Taiba', 'Tayyiba'],
  'وفاء': ['Wafaa', 'Wafa', 'Wafaa'],
};

// ─── Arabic Script Detection ────────────────────────────────────────────────

/**
 * Detect if the input string contains Arabic script characters.
 */
export function detectArabicScript(input: string): boolean {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicPattern.test(input);
}

// ─── Arabic Normalization ───────────────────────────────────────────────────

/**
 * Normalize an Arabic or mixed Arabic-Latin string:
 * - Remove diacritics (tashkeel)
 * - Normalize letter forms (e.g., different Alif representations)
 * - Convert Arabic numerals to Latin
 * - Remove tatweel
 */
export function normalizeArabic(input: string): string {
  if (!input) return '';

  let normalized = input.trim().toLowerCase();

  // Remove tatweel (kashida)
  normalized = normalized.replace(/\u0640/g, '');

  // Normalize different forms of Alif
  normalized = normalized.replace(/[أإآا]/g, 'ا');

  // Normalize Ya and Alif Maqsura
  normalized = normalized.replace(/[ىيئ]/g, 'ي');

  // Normalize Ta Marbuta to Ha
  normalized = normalized.replace(/ة/g, 'ه');

  // Remove diacritics (tashkeel)
  normalized = normalized.replace(/[\u064B-\u065F\u0670]/g, '');

  // Convert Arabic numerals to Western numerals
  normalized = normalized.replace(/[٠-٩]/g, (d) =>
    String(d.charCodeAt(0) - 0x0660)
  );

  return normalized;
}

// ─── Phonetic Variant Generation ────────────────────────────────────────────

/**
 * Generate all common transliteration variants for a given name.
 * If the name is in Arabic, uses the ARABIC_NAME_VARIANTS dictionary.
 * If the name is in Latin script, generates common phonetic variants.
 */
export function generatePhoneticVariants(name: string): string[] {
  if (!name) return [];

  const variants = new Set<string>();
  const trimmed = name.trim();

  // Add the original name
  variants.add(trimmed);

  // Check if the name is in Arabic script
  if (detectArabicScript(trimmed)) {
    // Look up in Arabic name variants dictionary
    const normalizedArabic = normalizeArabic(trimmed);
    for (const [arabicName, nameVariants] of Object.entries(ARABIC_NAME_VARIANTS)) {
      if (normalizeArabic(arabicName) === normalizedArabic) {
        for (const v of nameVariants) {
          variants.add(v);
          variants.add(v.toLowerCase());
          variants.add(v.toUpperCase());
        }
        break;
      }
    }

    // Also generate a transliteration from the Arabic character map
    let transliterated = '';
    for (const char of trimmed) {
      if (ARABIC_TO_LATIN_MAP[char] !== undefined) {
        transliterated += ARABIC_TO_LATIN_MAP[char];
      } else if (/[a-zA-Z0-9\s\-']/.test(char)) {
        transliterated += char;
      }
    }
    if (transliterated) {
      variants.add(transliterated);
      variants.add(capitalize(transliterated));
    }
  }

  // Generate Latin script phonetic variants
  const lower = trimmed.toLowerCase();

  // Common substitution patterns
  const substitutions: [RegExp, string][] = [
    [/kh/g, 'ch'],
    [/ch/g, 'kh'],
    [/ou/g, 'u'],
    [/ou/g, 'oo'],
    [/oo/g, 'ou'],
    [/ee/g, 'i'],
    [/aa/g, 'a'],
    [/ie/g, 'y'],
    [/y/g, 'i'],
    [/gh/g, 'g'],
    [/sh/g, 'sch'],
    [/ae/g, 'a'],
    [/oe/g, 'o'],
    [/ue/g, 'u'],
    [/al\s*/g, 'el'],
    [/el\s*/g, 'al'],
    [/bin\s*/g, 'ben'],
    [/ben\s*/g, 'bin'],
    [/abdul\s*/g, 'abdal'],
    [/abd\s*/g, 'abed'],
  ];

  for (const [pattern, replacement] of substitutions) {
    const variant = lower.replace(pattern, replacement);
    if (variant !== lower) {
      variants.add(capitalize(variant));
    }
  }

  // Handle doubled consonants: Hassan → Hasan, etc.
  const dedoubled = lower.replace(/(.)\1/g, '$1');
  if (dedoubled !== lower) {
    variants.add(capitalize(dedoubled));
  }

  // Add with and without common prefixes
  for (const prefix of ['al ', 'el ', 'abdul ', 'bin ', 'ben ', 'abu ']) {
    if (lower.startsWith(prefix)) {
      variants.add(capitalize(lower.slice(prefix.length)));
      // Also try alternate prefix
      const altPrefix = prefix === 'al ' ? 'el ' : prefix === 'el ' ? 'al ' : prefix;
      variants.add(capitalize(altPrefix + lower.slice(prefix.length)));
    }
  }

  // Add hyphenated and space variants
  const noSpaces = lower.replace(/\s+/g, '-');
  variants.add(capitalize(noSpaces));

  return Array.from(variants).filter((v) => v.length > 0);
}

// ─── Arabic Name Comparison ─────────────────────────────────────────────────

/**
 * Compare two names (Arabic or Latin) and return a similarity score (0-100).
 * Considers:
 * - Exact match
 * - Arabic name variant lookup
 * - Phonetic similarity
 * - Levenshtein distance
 */
export function compareArabicNames(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  const n1 = name1.trim().toLowerCase();
  const n2 = name2.trim().toLowerCase();

  // Exact match
  if (n1 === n2) return 100;

  // Normalized Arabic comparison
  const norm1 = normalizeArabic(name1);
  const norm2 = normalizeArabic(name2);
  if (norm1 === norm2 && norm1.length > 0) return 98;

  // Check variant lists
  const variants1 = generatePhoneticVariants(name1).map((v) => v.toLowerCase());
  const variants2 = generatePhoneticVariants(name2).map((v) => v.toLowerCase());

  // Cross-check variants
  for (const v1 of variants1) {
    for (const v2 of variants2) {
      if (v1 === v2) return 95;
      if (v1.includes(v2) || v2.includes(v1)) return 85;
    }
  }

  // Levenshtein-based comparison
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 0;

  const distance = levenshteinDistance(n1, n2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  // Check component-wise (for multi-word names)
  const words1 = n1.split(/\s+/);
  const words2 = n2.split(/\s+/);

  if (words1.length > 1 || words2.length > 1) {
    let componentScore = 0;
    let componentCount = 0;

    for (const w1 of words1) {
      let bestWordScore = 0;
      for (const w2 of words2) {
        if (w1 === w2) {
          bestWordScore = Math.max(bestWordScore, 100);
        } else {
          // Check variants for individual name parts
          const w1Variants = generatePhoneticVariants(w1).map((v) => v.toLowerCase());
          const w2Variants = generatePhoneticVariants(w2).map((v) => v.toLowerCase());
          for (const v1 of w1Variants) {
            for (const v2 of w2Variants) {
              if (v1 === v2) {
                bestWordScore = Math.max(bestWordScore, 95);
              }
            }
          }
          // Fall back to Levenshtein for individual words
          const wordDist = levenshteinDistance(w1, w2);
          const wordMaxLen = Math.max(w1.length, w2.length);
          if (wordMaxLen > 0) {
            const wordSim = ((wordMaxLen - wordDist) / wordMaxLen) * 100;
            bestWordScore = Math.max(bestWordScore, wordSim);
          }
        }
      }
      componentScore += bestWordScore;
      componentCount++;
    }

    const avgComponentScore = componentCount > 0 ? componentScore / componentCount : 0;
    // Return the better of the two scores
    return Math.max(similarity, avgComponentScore);
  }

  return similarity;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Capitalize the first letter of each word in a string.
 */
function capitalize(str: string): string {
  return str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
