import path from 'path';
import { EDUCATION_LEVEL_CODES, EducationLevelCode } from '../models/education-level.model';

export interface ParsedFileInfo {
  fileName: string;
  originalName: string;
  levelCode?: EducationLevelCode;
  subjectKeyword?: string;
  week?: number;
  topic?: string;
  suggestedTitle: string;
  isCompliant: boolean;
}

// Dictionnaire de correspondances pédagogiques (ordonné par spécificité décroissante)
const COMPOUND_SUBJECT_PATTERNS: Array<{ regex: RegExp; standardName: string }> = [
  { regex: /\b(?:histoire[\s_-]*g[eé]o(?:graphie)?|hg)\b/i, standardName: 'Histoire-Géographie' },
  { regex: /\b(?:exploitation\s+de\s+(?:texte|t)|expression\s+[eé]crite|orthographe|grammaire|vocabulaire|po[eé]sie|conjugaison)\b/i, standardName: 'Français' },
  { regex: /\b(?:sciences?(?:\s+et\s+techno(?:logie)?)?|svt|physique(?:\s+chimie)?)\b/i, standardName: 'Sciences et Technologie' },
  { regex: /\b(?:arts?\s+plastiques?|a\.?e\.?c\.?|dessin)\b/i, standardName: 'Arts Plastiques' },
  { regex: /\b(?:[eé]ducation\s+civique|edhc)\b/i, standardName: 'EDHC' },
  { regex: /\b(?:math[eé]matiques?|maths?|calcul|arithm[eé]tique|g[eé]om[eé]trie)\b/i, standardName: 'Mathématiques' },
  { regex: /\b(?:fran[cç]ais|[eé]criture|lecture)\b/i, standardName: 'Français' },
  { regex: /\b(?:anglais|english)\b/i, standardName: 'Anglais' },
  { regex: /\b(?:e\.?p\.?s\.?|[eé]ducation\s+physique|sport)\b/i, standardName: 'EPS' },
];

export class ImportParserService {
  public static parseFileName(fileName: string): ParsedFileInfo {
    const baseName = path.parse(fileName).name;
    const cleanStr = baseName.replace(/[._-]+/g, ' ').trim();

    let levelCode: EducationLevelCode | undefined;
    let subjectKeyword: string | undefined;
    let week: number | undefined;

    // 1. Détection du Niveau (CP1, CP2, CE1, CE2, CM1, CM2)
    for (const code of EDUCATION_LEVEL_CODES) {
      const levelRegex = new RegExp(`\\b${code}\\b`, 'i');
      if (levelRegex.test(cleanStr)) {
        levelCode = code;
        break;
      }
    }

    // 2. Détection de la Semaine (ex: Semaine 12, Sem12, S12, W12)
    const weekMatch = cleanStr.match(/\b(?:semaine|sem|s|w)\s*([0-9]{1,2})\b/i);
    if (weekMatch) {
      const parsedWeek = parseInt(weekMatch[1], 10);
      if (parsedWeek >= 1 && parsedWeek <= 52) {
        week = parsedWeek;
      }
    }

    // 3. Détection de la Matière via les patterns ordonnés
    for (const pattern of COMPOUND_SUBJECT_PATTERNS) {
      if (pattern.regex.test(cleanStr)) {
        subjectKeyword = pattern.standardName;
        break;
      }
    }

    // 4. Nettoyage du titre : suppression des bruits et artefacts fréquents
    let cleanedTitle = cleanStr
      // Supprimer timestamps (ex: 221028 101140)
      .replace(/\b\d{6,8}\s+\d{6}\b/g, '')
      // Supprimer mentions "recadrée", "ok", "ok-1", "tome 1", "partie 1", "page"
      .replace(/\b(?:recadr[eé]e?|ok\b(?:\s*\d+)?|partie\s*\d+|tome\s*\d+|version\s*\d+|copie)\b/gi, '')
      // Supprimer le code de classe et la semaine déjà extraits
      .replace(new RegExp(`\\b(?:CP1|CP2|CE1|CE2|CM1|CM2)\\b`, 'gi'), '')
      .replace(/\b(?:semaine|sem|s|w)\s*[0-9]{1,2}\b/gi, '')
      // Supprimer les mots de matière du titre s'ils sont déjà reconnus
      .replace(/\b(?:histoire|g[eé]o(?:graphie)?|hg|maths?|math[eé]matiques?|calcul|sciences?|techno(?:logie)?|fran[cç]ais|edhc|[eé]criture|lecture|anglais|eps|dessin)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 5. Construction d'un titre pédagogique harmonisé
    let suggestedTitle = '';
    if (subjectKeyword && levelCode) {
      suggestedTitle = `${subjectKeyword} - ${levelCode}`;
      if (week) suggestedTitle += ` - Semaine ${week}`;
      if (cleanedTitle.length > 2) suggestedTitle += ` : ${cleanedTitle}`;
    } else if (subjectKeyword) {
      suggestedTitle = subjectKeyword + (cleanedTitle.length > 2 ? ` : ${cleanedTitle}` : '');
    } else {
      suggestedTitle = baseName.replace(/[._-]+/g, ' ').trim();
    }

    const isCompliant = !!(levelCode && subjectKeyword);

    return {
      fileName,
      originalName: fileName,
      levelCode,
      subjectKeyword,
      week,
      topic: cleanedTitle.length > 2 ? cleanedTitle : undefined,
      suggestedTitle,
      isCompliant,
    };
  }
}
