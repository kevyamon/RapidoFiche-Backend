import path from 'path';
import { EDUCATION_LEVEL_CODES, EducationLevelCode } from '../models/education-level.model';

export interface ParsedFileInfo {
  fileName: string;
  originalName: string;
  levelCode?: EducationLevelCode;
  subjectKeyword?: string;
  subjectSlug?: string;
  week?: number;
  topic?: string;
  suggestedTitle: string;
  isCompliant: boolean;
}

interface SubjectPattern {
  regex: RegExp;
  standardName: string;
  slug: string;
}

// Dictionnaire de correspondances pédagogiques par ordre strict de spécificité
const SUBJECT_PATTERNS: SubjectPattern[] = [
  // 1. Histoire-Géographie (prioritaire pour éviter les faux positifs 'geo' ou 'hist')
  {
    regex: /\b(?:histoire[\s_-]*g[eé]o(?:graphie)?|h[\s._-]*g|hist[\s._-]*g[eé]o|histoire|g[eé]ographie|hist|g[eé]o)\b/i,
    standardName: 'Histoire-Géographie',
    slug: 'histoire-geographie',
  },
  // 2. EDHC / Éducation Civique / Morale
  {
    regex: /\b(?:edhc|e[\s._-]*d[\s._-]*h[\s._-]*c|[eé]ducation\s+civique|instruction\s+civique|civisme|morale|citoyennet[eé]|droits?\s+(?:de\s+l['’]\s*homme|humains?|de\s+l['’]\s*enfant)|vivre\s+ensemble|secourisme|s[eé]curit[eé]\s+routi[eè]re)\b/i,
    standardName: 'EDHC',
    slug: 'edhc',
  },
  // 3. Sciences et Technologie / SVT / Physique-Chimie / Éveil
  {
    regex: /\b(?:sciences?(?:\s+et\s+techno(?:logie)?)?|sc(?:iences?)?[\s._-]*techno(?:logie)?|sc[\s._-]*tech|svt|s[\s._-]*v[\s._-]*t|physique(?:\s*[\s_-]*\s*chimie)?|p[\s._-]*c|chimie|[eé]veil|d[eé]couverte\s+du\s+monde|le[cç]on\s+de\s+choses|observation|biologie|corps\s+humain|hygi[eè]ne|sant[eé]|germination|[eé]lectricit[eé]|astronomie|mati[eè]re)\b/i,
    standardName: 'Sciences et Technologie',
    slug: 'sciences-technologie',
  },
  // 4. Français / Sous-disciplines littéraires
  {
    regex: /\b(?:fran[cç]ais|fra|fr\b|exploitation\s+de\s+(?:texte|t)|[eé]tude\s+de\s+texte|compr[eé]hension(?:\s+de\s+texte)?|production\s+(?:d['’]\s*)?[eé]crit(?:e)?|expression\s+[eé]crite|expression\s+orale|orthographe|ortho\b|grammaire|gram\b|gramm\b|vocabulaire|vocab\b|lexique|conjugaison|conj\b|dict[eé]e?s?|lecture|lectures|[eé]criture|graphisme|calligraphie|po[eé]sie|r[eé]citation|comptine|phon[eé]tique|langage|communication)\b/i,
    standardName: 'Français',
    slug: 'francais',
  },
  // 5. Mathématiques / Sous-disciplines mathématiques
  {
    regex: /\b(?:math[eé]matiques?|maths?|mat\b|calcul(?:s|\s+mental|\s+rapide)?|arithm[eé]tique|alg[eè]bre|g[eé]om[eé]trie|num[eé]ration|grandeurs?(?:\s+et\s+mesures?)?|mesures?|r[eé]solution\s+de\s+probl[eè]mes?|probl[eè]mes?|op[eé]rations?|fractions?|pourcentages?|proportionnalit[eé]|multiplications?|divisions?|additions?|soustractions?)\b/i,
    standardName: 'Mathématiques',
    slug: 'mathematiques',
  },
  // 6. Arts Plastiques / AEC
  {
    regex: /\b(?:arts?\s+plastiques?|a[\s._-]*e[\s._-]*c|dessin|peinture|chant|musique|bricolage|arts?)\b/i,
    standardName: 'Arts Plastiques',
    slug: 'arts-plastiques',
  },
  // 7. EPS
  {
    regex: /\b(?:eps|e[\s._-]*p[\s._-]*s|[eé]ducation\s+physique|sport|motricit[eé]|gymnastique)\b/i,
    standardName: 'EPS',
    slug: 'eps',
  },
  // 8. Anglais
  {
    regex: /\b(?:anglais|english|ang\b)\b/i,
    standardName: 'Anglais',
    slug: 'anglais',
  },
];

export class ImportParserService {
  public static parseFileName(fileName: string): ParsedFileInfo {
    const baseName = path.parse(fileName).name;

    // Découpage camelCase et standardisation des séparateurs
    const spaced = baseName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/[._\-–—[\](){}<>,;:!/?+='"~#&]+/g, ' ')
      .trim();

    // Normalisation textuelle pour faciliter la détection
    const normalizedNoAccents = spaced
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    let levelCode: EducationLevelCode | undefined;
    let subjectKeyword: string | undefined;
    let subjectSlug: string | undefined;
    let week: number | undefined;

    // 1. Détection du Niveau (PS, MS, GS, CP1, CP2, CE1, CE2, CM1, CM2)
    for (const code of EDUCATION_LEVEL_CODES) {
      const levelRegex = new RegExp(`\\b${code}\\b`, 'i');
      if (levelRegex.test(spaced)) {
        levelCode = code;
        break;
      }
    }

    // 2. Détection de la Semaine (ex: Semaine 12, Sem12, S12, W12, Semaine_04)
    const weekMatch = spaced.match(/\b(?:semaine|sem|s|w)\s*([0-9]{1,2})\b/i);
    if (weekMatch) {
      const parsedWeek = parseInt(weekMatch[1], 10);
      if (parsedWeek >= 1 && parsedWeek <= 52) {
        week = parsedWeek;
      }
    }

    // 3. Détection de la Matière via les patterns ordonnés (sur version avec et sans accents)
    for (const pattern of SUBJECT_PATTERNS) {
      if (pattern.regex.test(spaced) || pattern.regex.test(normalizedNoAccents)) {
        subjectKeyword = pattern.standardName;
        subjectSlug = pattern.slug;
        break;
      }
    }

    // 4. Nettoyage du sujet / sujet résiduel pour extraire le thème pédagogique
    let cleanedTopic = spaced
      // Supprimer les timestamps
      .replace(/\b\d{6,8}\s+\d{4,6}\b/g, '')
      .replace(/\b\d{6,14}\b/g, '')
      // Supprimer les mentions de bruit et versions
      .replace(/\b(?:recadr[eé]e?|ok\b(?:\s*\d+)?|partie\s*\d+|tome\s*\d+|version\s*\d+|v\d+|copie|fiche|le[cç]on|cours)\b/gi, '')
      // Supprimer le code de classe extrait ou présent
      .replace(/\b(?:PS|MS|GS|CP1|CP2|CE1|CE2|CM1|CM2)\b/gi, '')
      // Supprimer les mentions de semaine
      .replace(/\b(?:semaine|sem|s|w)\s*[0-9]{1,2}\b/gi, '')
      // Supprimer les abréviations de matières courantes du topic
      .replace(/\b(?:histoire|g[eé]o(?:graphie)?|hg|maths?|math[eé]matiques?|calcul|sciences?|techno(?:logie)?|svt|physique|chimie|pc|fran[cç]ais|edhc|anglais|eps|aec|arts?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Nettoyer d'éventuels tirets ou ponctuations orphelines
    cleanedTopic = cleanedTopic.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();

    // 5. Construction d'un titre pédagogique harmonisé
    let suggestedTitle = '';
    const displayTopic = cleanedTopic.length > 2 ? cleanedTopic : undefined;

    if (subjectKeyword && levelCode) {
      suggestedTitle = `${subjectKeyword} - ${levelCode}`;
      if (week) suggestedTitle += ` - Semaine ${week}`;
      if (displayTopic) suggestedTitle += ` : ${displayTopic}`;
    } else if (subjectKeyword) {
      suggestedTitle = subjectKeyword + (displayTopic ? ` : ${displayTopic}` : '');
    } else {
      suggestedTitle = spaced.length > 0 ? spaced : baseName;
    }

    const isCompliant = !!(levelCode && subjectKeyword);

    return {
      fileName,
      originalName: fileName,
      levelCode,
      subjectKeyword,
      subjectSlug,
      week,
      topic: displayTopic,
      suggestedTitle,
      isCompliant,
    };
  }
}

