import { LoremType } from './types';

const LATIN_WORDS = [
  'a', 'ab', 'accumsan', 'ad', 'adipiscing', 'aenean', 'aliquam', 'aliquet', 'amet', 'ante', 'apertam', 'arcu', 'at', 'auctor', 'augue', 'bibendum', 'blandit', 'commodo', 'condimentum', 'congue', 'consectetur', 'consequat', 'convallis', 'corrupti', 'cras', 'cubilia', 'curabitur', 'curae', 'cursus', 'dapibus', 'delectus', 'diam', 'dictum', 'dignissim', 'dis', 'do', 'dolor', 'dolore', 'donec', 'dui', 'duis', 'efficitur', 'egestas', 'eget', 'eiusmod', 'eleifend', 'elementum', 'elit', 'enim', 'erat', 'eros', 'esse', 'est', 'et', 'etiam', 'eu', 'euismod', 'ex', 'excepteur', 'facilisis', 'fames', 'faucibus', 'felis', 'fermentum', 'feugiat', 'finibus', 'fringilla', 'fusce', 'gravida', 'habitant', 'habitasse', 'hac', 'hendrerit', 'himenaeos', 'iaculis', 'id', 'imperdiet', 'in', 'incididunt', 'integer', 'interdum', 'ipsum', 'irure', 'justo', 'labore', 'laboris', 'laborum', 'lacinia', 'lacus', 'laoreet', 'lectus', 'leo', 'libero', 'ligula', 'lobortis', 'lorem', 'luctus', 'maecenas', 'magna', 'malesuada', 'massa', 'mattis', 'mauris', 'maximus', 'metus', 'mi', 'molestie', 'mollis', 'morbi', 'nam', 'nascentur', 'natu', 'nec', 'neque', 'netus', 'nibh', 'nisi', 'nisl', 'non', 'nostrud', 'nulla', 'nullam', 'nunc', 'obcaecati', 'odio', 'officia', 'orci', 'ornare', 'pariatur', 'parturient', 'pellentesque', 'phasellus', 'placerat', 'platea', 'porta', 'porttitor', 'posuere', 'potenti', 'praesent', 'pretium', 'primis', 'proin', 'pulvinar', 'purus', 'quam', 'quis', 'quisque', 'quo', 'reprehenderit', 'rhoncus', 'ridiculus', 'risus', 'rutrum', 'sagittis', 'sapien', 'scelerisque', 'sed', 'sem', 'semper', 'senectus', 'sit', 'sociis', 'sodales', 'sollicitudin', 'suscipit', 'suspendisse', 'tellus', 'tempor', 'tempus', 'tincidunt', 'tortor', 'tristique', 'turpis', 'ullamco', 'ultrices', 'ultricies', 'urna', 'ut', 'varius', 've', 'vehicula', 'vel', 'velit', 'venenatis', 'veniam', 'vestibulum', 'vitae', 'vivamus', 'viverra', 'volutpat', 'volutpat', 'vulputate'
];

const START_PHRASE = 'Lorem ipsum dolor sit amet consectetur adipiscing elit';

function getRandomWord(): string {
  return LATIN_WORDS[Math.floor(Math.random() * LATIN_WORDS.length)];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateWords(count: number, startLorem: boolean = false): string {
  let words: string[] = [];
  
  if (startLorem) {
    words = START_PHRASE.split(' ');
  }

  while (words.length < count) {
    words.push(getRandomWord());
  }

  return words.slice(0, count).join(' ');
}

export function generateSentences(count: number, startLorem: boolean = false): string {
  const sentences: string[] = [];

  for (let i = 0; i < count; i++) {
    const isFirst = i === 0 && startLorem;
    let sentence = '';
    
    if (isFirst) {
      // Start with a fixed number of words from START_PHRASE to make it recognizable
      const words = START_PHRASE.split(' ');
      const extraCount = Math.floor(Math.random() * 5) + 5; // Add 5-10 more words
      for (let j = 0; j < extraCount; j++) {
        words.push(getRandomWord());
      }
      sentence = words.join(' ');
    } else {
      const wordCount = Math.floor(Math.random() * 10) + 8; // 8-18 words
      const words = [];
      for (let j = 0; j < wordCount; j++) {
        words.push(getRandomWord());
      }
      sentence = capitalize(words.join(' '));
    }
    sentences.push(sentence + '.');
  }

  return sentences.join(' ');
}

export function generateParagraphs(count: number, startLorem: boolean = false): string {
  const paragraphs: string[] = [];

  for (let i = 0; i < count; i++) {
    const sentenceCount = Math.floor(Math.random() * 4) + 3; // 3-7 sentences
    paragraphs.push(generateSentences(sentenceCount, i === 0 && startLorem));
  }

  return paragraphs.join('\n\n');
}

export function generateLorem(type: LoremType, count: number, startLorem: boolean = false): string {
  switch (type) {
    case 'words':
      return generateWords(count, startLorem);
    case 'sentences':
      return generateSentences(count, startLorem);
    case 'paragraphs':
      return generateParagraphs(count, startLorem);
    default:
      return generateParagraphs(count, startLorem);
  }
}
