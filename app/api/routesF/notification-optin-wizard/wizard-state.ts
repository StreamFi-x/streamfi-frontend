export const WIZARD_STEPS = ['channels', 'frequency', 'categories', 'review'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export interface WizardState {
  step: WizardStep | null;
  choices: Record<string, string>;
  completed: boolean;
}

function initialState(): WizardState {
  return { step: WIZARD_STEPS[0], choices: {}, completed: false };
}

const wizardStates = new Map<string, WizardState>();

export function getWizardState(viewerId: string): WizardState {
  const existing = wizardStates.get(viewerId);
  if (existing) return existing;
  return initialState();
}

export function advanceWizard(
  viewerId: string,
  step: string,
  choice: string | undefined
): { state: WizardState; error?: string } {
  const current = getWizardState(viewerId);

  if (current.completed || current.step === null) {
    return { state: current, error: 'Wizard already completed' };
  }

  if (step !== current.step) {
    return { state: current, error: `Expected step "${current.step}" but received "${step}"` };
  }

  const choices = { ...current.choices };
  if (choice !== undefined) {
    choices[step] = choice;
  }

  const currentIndex = WIZARD_STEPS.indexOf(current.step);
  const nextIndex = currentIndex + 1;
  const isLastStep = nextIndex >= WIZARD_STEPS.length;

  const next: WizardState = {
    step: isLastStep ? null : WIZARD_STEPS[nextIndex],
    choices,
    completed: isLastStep,
  };

  wizardStates.set(viewerId, next);
  return { state: next };
}

export function resetWizard(viewerId: string): WizardState {
  const fresh = initialState();
  wizardStates.set(viewerId, fresh);
  return fresh;
}
