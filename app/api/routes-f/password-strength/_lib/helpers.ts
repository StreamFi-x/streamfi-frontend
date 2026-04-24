// Embedded list of known bad passwords
const BAD_PASSWORDS = new Set([
  "password",
  "123456",
  "12345678",
  "qwerty",
  "123456789",
  "12345",
  "1234",
  "111111",
  "admin",
  "welcome",
  "login",
  "football",
  "soccer",
  "monkey",
  "letmein",
  "charlie",
  "shadow",
  "master",
  "hunter2",
  "princess",
  "keyboard",
  "dragon",
  "baseball",
  "summer",
  "superman",
  "starwars",
  "google",
  "application",
  "password123",
  "abc123",
  "qwertyuiop",
  "iloveyou",
  "nicetomeetyou",
  "secret",
  "testing",
  "nothing",
  "pussycat",
  "testing123",
  "yellow",
  "orange",
  "purple",
  "black",
  "white",
  "silver",
  "gold",
  "diamond",
  "ruby",
  "laptop",
  "monitor",
  "iphone",
]);

export function calculatePasswordStrength(password: string) {
  let score = 0;
  const feedback: string[] = [];

  // 🚨 Blacklist check (override everything)
  if (BAD_PASSWORDS.has(password.toLowerCase())) {
    return {
      score: 0,
      feedback: ["This is a very common password and is easily guessed."],
      estimated_crack_time: "Instant",
    };
  }

  // =========================
  // 1. LENGTH (PRIMARY FACTOR)
  // =========================
  if (password.length >= 8) score++;
  else if (password.length > 0) {
    feedback.push("Password should be at least 8 characters long.");
  }

  if (password.length >= 12) score++;

  // =========================
  // 2. COMPLEXITY (ONLY IF LONG ENOUGH)
  // =========================
  if (password.length >= 10) {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (hasUpper && hasLower) {
      score++;
    } else {
      feedback.push("Use a mix of uppercase and lowercase letters.");
    }

    if (hasNumber && hasSpecial) {
      score++;
    } else {
      feedback.push("Include at least one number and one special character.");
    }
  } else if (password.length >= 8) {
    feedback.push(
      "Increase length to unlock stronger security (10+ characters)."
    );
  }

  // =========================
  // 3. FINAL SCORE (0–4)
  // =========================
  const finalScore = Math.min(Math.max(score, 0), 4);

  // =========================
  // 4. CRACK TIME ESTIMATION
  // =========================
  const crackTimeMap = ["Instant", "Seconds", "Minutes", "Hours", "Years"];

  return {
    score: finalScore,
    feedback,
    estimated_crack_time: crackTimeMap[finalScore],
  };
}
