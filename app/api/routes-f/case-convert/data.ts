export type CaseFormat = 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase' | 'CONSTANT_CASE' | 'Title Case' | 'Sentence case';

// Detect the case format of the input string
export const detectCase = (text: string): CaseFormat | 'mixed' | 'unknown' => {
  if (!text) return 'unknown';
  
  // Check for camelCase
  if (/^[a-z][a-zA-Z0-9]*$/.test(text) && /[A-Z]/.test(text)) {
    return 'camelCase';
  }
  
  // Check for PascalCase
  if (/^[A-Z][a-zA-Z0-9]*$/.test(text)) {
    return 'PascalCase';
  }
  
  // Check for snake_case
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(text)) {
    return 'snake_case';
  }
  
  // Check for kebab-case
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(text)) {
    return 'kebab-case';
  }
  
  // Check for CONSTANT_CASE
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(text)) {
    return 'CONSTANT_CASE';
  }
  
  // Check for Title Case
  if (/^[A-Z][a-z]+([ ][A-Z][a-z]+)*$/.test(text)) {
    return 'Title Case';
  }
  
  // Check for Sentence case
  if (/^[A-Z][a-z]+([ ][a-z]+)*$/.test(text)) {
    return 'Sentence case';
  }
  
  // Check if it's mixed (contains multiple case patterns)
  const hasCamel = /[a-z][A-Z]/.test(text);
  const hasSnake = /_/.test(text);
  const hasKebab = /-/.test(text);
  const hasSpace = / /.test(text);
  const hasConstant = /^[A-Z_]+$/.test(text);
  
  if ((hasCamel && (hasSnake || hasKebab || hasSpace)) || 
      (hasSnake && hasKebab) || 
      (hasSnake && hasSpace) || 
      (hasKebab && hasSpace)) {
    return 'mixed';
  }
  
  return 'unknown';
};

// Split text into words, preserving numbers
export const splitIntoWords = (text: string): string[] => {
  // Handle different separators and camelCase
  const words = text
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to space
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // PascalCase words
    .replace(/[_-]/g, ' ') // snake_case and kebab-case to space
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
  
  return words;
};

// Convert to camelCase
export const toCamelCase = (words: string[]): string => {
  if (words.length === 0) return '';
  
  const [firstWord, ...restWords] = words;
  return firstWord.toLowerCase() + restWords.map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join('');
};

// Convert to snake_case
export const toSnakeCase = (words: string[]): string => {
  return words.map(word => word.toLowerCase()).join('_');
};

// Convert to kebab-case
export const toKebabCase = (words: string[]): string => {
  return words.map(word => word.toLowerCase()).join('-');
};

// Convert to PascalCase
export const toPascalCase = (words: string[]): string => {
  return words.map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join('');
};

// Convert to CONSTANT_CASE
export const toConstantCase = (words: string[]): string => {
  return words.map(word => word.toUpperCase()).join('_');
};

// Convert to Title Case
export const toTitleCase = (words: string[]): string => {
  return words.map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

// Convert to Sentence case
export const toSentenceCase = (words: string[]): string => {
  if (words.length === 0) return '';
  
  const [firstWord, ...restWords] = words;
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase() + 
         ' ' + restWords.map(word => word.toLowerCase()).join(' ');
};

// Main conversion function
export const convertCase = (text: string, target?: CaseFormat) => {
  const words = splitIntoWords(text);
  
  if (words.length === 0) {
    return target ? { result: '' } : {};
  }
  
  const conversions = {
    camelCase: toCamelCase(words),
    snake_case: toSnakeCase(words),
    'kebab-case': toKebabCase(words),
    PascalCase: toPascalCase(words),
    CONSTANT_CASE: toConstantCase(words),
    'Title Case': toTitleCase(words),
    'Sentence case': toSentenceCase(words),
  };
  
  if (target) {
    return { result: conversions[target] };
  }
  
  return conversions;
};
