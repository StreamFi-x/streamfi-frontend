/* eslint-disable @typescript-eslint/no-explicit-any */
export function validateEmail(email: any) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }