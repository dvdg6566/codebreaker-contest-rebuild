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
 * Get file extension for a language
 */
export function getLanguageExtension(id: string): string {
  return LANGUAGES[id as LanguageId]?.extension || id;
}

/**
 * Get language ID from display name
 */
export function getLanguageIdFromName(name: string): LanguageId | null {
  for (const [id, config] of Object.entries(LANGUAGES)) {
    if (config.name === name) {
      return id as LanguageId;
    }
  }
  return null;
}

/**
 * Get display name for a language ID
 */
export function getLanguageDisplayName(id: string): string {
  return LANGUAGES[id as LanguageId]?.name || id;
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
