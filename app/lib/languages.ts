/**
 * Language Configuration
 *
 * Defines supported programming languages and their mappings.
 */

/**
 * Supported languages with their display names and file extensions
 */
export const LANGUAGES = {
  cpp: {
    id: "cpp",
    name: "C++ 17",
    extension: "cpp",
    contentType: "text/x-c++src",
    aceMode: "c_cpp",
    codemirrorMode: "cpp",
    compileCommand: "g++ -std=c++17 -O2 -o {output} {source}",
    runCommand: "./{binary}",
  },
  py: {
    id: "py",
    name: "Python 3",
    extension: "py",
    contentType: "text/x-python",
    aceMode: "python",
    codemirrorMode: "python",
    compileCommand: null, // Interpreted
    runCommand: "python3 {source}",
  },
} as const;

export type LanguageId = keyof typeof LANGUAGES;

/**
 * Map from short code to full language config
 */
export const languageConfig = LANGUAGES;

/**
 * Get all available languages
 */
export function getLanguages() {
  return Object.values(LANGUAGES);
}

/**
 * Get language by ID
 */
export function getLanguage(id: string) {
  return LANGUAGES[id as LanguageId] || null;
}

/**
 * Get display name for a language
 */
export function getLanguageName(id: string): string {
  return LANGUAGES[id as LanguageId]?.name || id;
}

/**
 * Get file extension for a language
 */
export function getLanguageExtension(id: string): string {
  return LANGUAGES[id as LanguageId]?.extension || id;
}

/**
 * Map from display name to short code
 */
export const languagesByName: Record<string, LanguageId> = Object.fromEntries(
  Object.entries(LANGUAGES).map(([id, config]) => [config.name, id as LanguageId])
);

/**
 * Get language ID from display name
 */
export function getLanguageIdFromName(name: string): LanguageId | null {
  return languagesByName[name] || null;
}

/**
 * Check if a language is supported
 */
export function isValidLanguage(id: string): id is LanguageId {
  return id in LANGUAGES;
}

/**
 * Get languages as options for select dropdowns
 */
export function getLanguageOptions() {
  return Object.entries(LANGUAGES).map(([id, config]) => ({
    value: id,
    label: config.name,
  }));
}
