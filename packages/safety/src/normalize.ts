/**
 * Text normalisation shared by crisis detection and redaction.
 * NFKC folds full-width characters, so "ｋｉｌｌ" becomes "kill".
 * Curly quotes become straight quotes. Zero-width characters are dropped so they cannot hide a phrase.
 */
const ZERO_WIDTH = /[​-‍⁠﻿]/g;
const CURLY_SINGLE = /[‘’ʼ]/g;

export function normalizeForMatching(text: string): string {
  return text
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(CURLY_SINGLE, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
