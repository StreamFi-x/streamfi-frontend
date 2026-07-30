export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface QuizSubmission {
  creator_id: string;
  mod_id: string;
  answers: number[];
}

export interface QuizResult {
  score: number;
  passed: boolean;
  certified_at: string | null;
}

const seedQuestions: Question[] = [
  {
    id: 'q1',
    text: 'What should you do if you see hate speech in chat?',
    options: [
      'Ignore it',
      'Warn the user and delete the message',
      'Ban the entire channel',
      'Join in',
    ],
    correctIndex: 1,
  },
  {
    id: 'q2',
    text: 'How long should you wait before timing out a repeat offender?',
    options: [
      'Immediately timeout',
      'Give 3 warnings first',
      'Only after the stream ends',
      'Never timeout',
    ],
    correctIndex: 0,
  },
  {
    id: 'q3',
    text: 'Which content is NOT allowed on StreamFi?',
    options: [
      'Gaming streams',
      'Music production',
      'Explicit adult content',
      'Coding tutorials',
    ],
    correctIndex: 2,
  },
  {
    id: 'q4',
    text: 'What is the proper way to handle a DMCA claim?',
    options: [
      'Delete the VOD and ignore',
      'Report to StreamFi support and remove the content',
      'Ban the reporter',
      'Continue streaming',
    ],
    correctIndex: 1,
  },
  {
    id: 'q5',
    text: 'Can moderators accept bribes from streamers?',
    options: [
      'Yes, if it\'s a small amount',
      'No, never',
      'Only if the streamer asks nicely',
      'Yes, but only in crypto',
    ],
    correctIndex: 1,
  },
];

export function getQuestions(): Question[] {
  return seedQuestions;
}

export function gradeQuiz(answers: number[]): { score: number; passed: boolean } {
  if (answers.length !== seedQuestions.length) {
    return { score: 0, passed: false };
  }

  let correct = 0;
  for (let i = 0; i < seedQuestions.length; i++) {
    if (answers[i] === seedQuestions[i].correctIndex) {
      correct++;
    }
  }

  const score = Math.round((correct / seedQuestions.length) * 100);
  const passed = score >= 80;

  return { score, passed };
}