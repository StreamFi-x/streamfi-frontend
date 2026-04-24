import { generateLorem, generateWords, generateSentences, generateParagraphs } from '../_lib/generator';

describe('Lorem Ipsum Generator', () => {
  describe('Generator Logic', () => {
    test('generates correct number of words', () => {
      const result = generateWords(10);
      expect(result.split(' ')).toHaveLength(10);
    });

    test('starts with classic phrase when startLorem is true (words)', () => {
      const result = generateWords(10, true);
      expect(result.startsWith('Lorem ipsum dolor sit amet')).toBe(true);
    });

    test('generates correct number of sentences', () => {
      const result = generateSentences(3);
      // Split by '. ' or '.' at end
      const sentences = result.split('.').filter(s => s.trim().length > 0);
      expect(sentences).toHaveLength(3);
    });

    test('starts with classic phrase when startLorem is true (sentences)', () => {
      const result = generateSentences(1, true);
      expect(result.startsWith('Lorem ipsum dolor sit amet')).toBe(true);
    });

    test('generates correct number of paragraphs', () => {
      const result = generateParagraphs(2);
      const paragraphs = result.split('\n\n');
      expect(paragraphs).toHaveLength(2);
    });

    test('main entry point works for all types', () => {
      expect(generateLorem('words', 5).split(' ')).toHaveLength(5);
      expect(generateLorem('sentences', 2).split('.').filter(s => s.trim().length > 0)).toHaveLength(2);
      expect(generateLorem('paragraphs', 1).split('\n\n')).toHaveLength(1);
    });
  });
});
