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

const SUBJECT_ALIASES: Record<string, string> = {
  maths: 'Mathématiques',
  mathematiques: 'Mathématiques',
  calcul: 'Mathématiques',
  francais: 'Français',
  lecture: 'Français',
  ecriture: 'Français',
  sciences: 'Sciences et Technologie',
  histoire: 'Histoire-Géographie',
  geo: 'Histoire-Géographie',
  edhc: 'EDHC',
  anglais: 'Anglais',
  eps: 'EPS',
  art: 'Arts Plastiques',
};

export class ImportParserService {
  public static parseFileName(fileName: string): ParsedFileInfo {
    const baseName = path.parse(fileName).name;
    const parts = baseName.split(/[_ -]+/);

    let levelCode: EducationLevelCode | undefined;
    let subjectKeyword: string | undefined;
    let week: number | undefined;
    const topicParts: string[] = [];

    for (const part of parts) {
      const upperPart = part.toUpperCase();
      const lowerPart = part.toLowerCase();

      // 1. Détection du Niveau
      if (
        !levelCode &&
        EDUCATION_LEVEL_CODES.includes(upperPart as EducationLevelCode)
      ) {
        levelCode = upperPart as EducationLevelCode;
        continue;
      }

      // 2. Détection de la Semaine (ex: Semaine12, S12, W12)
      const weekMatch = lowerPart.match(/^(?:semaine|sem|s|w)([0-9]{1,2})$/);
      if (!week && weekMatch) {
        const parsedWeek = parseInt(weekMatch[1], 10);
        if (parsedWeek >= 1 && parsedWeek <= 52) {
          week = parsedWeek;
          continue;
        }
      }

      // 3. Détection de la Matière
      if (!subjectKeyword && SUBJECT_ALIASES[lowerPart]) {
        subjectKeyword = SUBJECT_ALIASES[lowerPart];
        continue;
      }

      // 4. Reste = Thème / Titre
      topicParts.push(part);
    }

    const topic = topicParts.length > 0 ? topicParts.join(' ') : undefined;
    const isCompliant = !!(levelCode && (subjectKeyword || topic));

    let suggestedTitle = baseName.replace(/_/g, ' ');
    if (levelCode && subjectKeyword && week) {
      suggestedTitle = `${subjectKeyword} - ${levelCode} - Semaine ${week}${topic ? ` : ${topic}` : ''}`;
    } else if (levelCode && subjectKeyword) {
      suggestedTitle = `${subjectKeyword} - ${levelCode}${topic ? ` : ${topic}` : ''}`;
    }

    return {
      fileName,
      originalName: fileName,
      levelCode,
      subjectKeyword,
      week,
      topic,
      suggestedTitle,
      isCompliant,
    };
  }
}
