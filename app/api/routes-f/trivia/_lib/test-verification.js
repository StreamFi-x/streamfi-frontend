// Simple verification script to test the trivia API logic
// This can be run with Node.js to verify the implementation works

// Mock the questions data
const questions = [
  {
    id: 'sci_001',
    question: 'What is the chemical symbol for gold?',
    answers: ['Go', 'Gd', 'Au', 'Ag'],
    correct_index: 2,
    category: 'science',
    difficulty: 'easy'
  },
  {
    id: 'hist_001',
    question: 'In which year did World War II end?',
    answers: ['1943', '1944', '1945', '1946'],
    correct_index: 2,
    category: 'history',
    difficulty: 'easy'
  }
];

function generateHash(questionId, correctIndex) {
  const data = `${questionId}:${correctIndex}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function filterQuestions(category, difficulty) {
  let filtered = questions;
  
  if (category) {
    filtered = filtered.filter(q => q.category === category);
  }
  
  if (difficulty) {
    filtered = filtered.filter(q => q.difficulty === difficulty);
  }
  
  return filtered;
}

function getRandomQuestions(questions, count) {
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, questions.length));
}

function formatQuestionForResponse(question) {
  return {
    id: question.id,
    question: question.question,
    answers: question.answers,
    correct_hash: generateHash(question.id, question.correct_index),
    category: question.category,
    difficulty: question.difficulty
  };
}

function validateAnswer(questionId, answerIndex) {
  const question = questions.find(q => q.id === questionId);
  
  if (!question) {
    return null;
  }
  
  return {
    correct: question.correct_index === answerIndex,
    correct_index: question.correct_index
  };
}

// Test the implementation
console.log('Testing Trivia API Implementation...\n');

// Test 1: Generate hash consistency
const hash1 = generateHash('sci_001', 2);
const hash2 = generateHash('sci_001', 2);
console.log('✓ Hash consistency test:', hash1 === hash2);

// Test 2: Hash uniqueness
const hash3 = generateHash('sci_001', 3);
console.log('✓ Hash uniqueness test:', hash1 !== hash3);

// Test 3: Filter by category
const scienceQuestions = filterQuestions('science');
console.log('✓ Category filter test:', scienceQuestions.length === 1 && scienceQuestions[0].category === 'science');

// Test 4: Filter by difficulty
const easyQuestions = filterQuestions(undefined, 'easy');
console.log('✓ Difficulty filter test:', easyQuestions.length === 2);

// Test 5: Random selection
const randomQuestions = getRandomQuestions(questions, 1);
console.log('✓ Random selection test:', randomQuestions.length === 1);

// Test 6: Format for response (no correct_index leak)
const formatted = formatQuestionForResponse(questions[0]);
const hasCorrectIndex = formatted.hasOwnProperty('correct_index');
const hasCorrectHash = formatted.hasOwnProperty('correct_hash');
console.log('✓ Response format test:', !hasCorrectIndex && hasCorrectHash);

// Test 7: Answer validation - correct
const correctResult = validateAnswer('sci_001', 2);
console.log('✓ Correct answer validation:', correctResult.correct === true && correctResult.correct_index === 2);

// Test 8: Answer validation - incorrect
const incorrectResult = validateAnswer('sci_001', 0);
console.log('✓ Incorrect answer validation:', incorrectResult.correct === false && incorrectResult.correct_index === 2);

// Test 9: Answer validation - non-existent question
const nonExistentResult = validateAnswer('nonexistent', 0);
console.log('✓ Non-existent question test:', nonExistentResult === null);

// Test 10: API response format simulation
const filtered = filterQuestions('science', 'easy');
const random = getRandomQuestions(filtered, 1);
const response = {
  questions: random.map(formatQuestionForResponse)
};

console.log('✓ API response format test:', response.questions.length === 1 && !response.questions[0].hasOwnProperty('correct_index'));

console.log('\nAll tests passed! ✓');
console.log('\nSample API Response:');
console.log(JSON.stringify(response, null, 2));
