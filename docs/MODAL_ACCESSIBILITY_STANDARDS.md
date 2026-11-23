# Modal Accessibility Standards - Issues #1825, #1826

## Overview

This document outlines the accessibility standards required for modal dialogs throughout the application, with specific focus on the language selection modal (#1825) and email verification modal (#1826).

## Accessibility Requirements

### 1. Dialog Role and ARIA Attributes

#### Required Attributes
```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Modal Title</h2>
  <p id="modal-description">Modal description</p>
</div>
```

**Explanation:**
- `role="dialog"` - Announces to screen readers that this is a modal dialog
- `aria-modal="true"` - Indicates this is a modal that blocks interaction with page content
- `aria-labelledby="id"` - Associates the heading with the dialog for screen reader context
- `aria-describedby="id"` - Provides additional description of the dialog's purpose

#### Why It Matters
- Screen reader users receive no indication a dialog has opened without these attributes
- Without proper labeling, users don't know what the dialog is for
- Blind and low-vision users can't navigate or understand modal purpose

### 2. Focus Management

#### Focus Trap
When a modal opens, keyboard focus must be trapped within it:

```typescript
// When modal opens
const firstFocusableElement = modal.querySelector(
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
);
firstFocusableElement?.focus();

// Tab handling
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    if (e.shiftKey) {
      // Shift+Tab on first element -> focus last element
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab on last element -> focus first element
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }
});
```

**Why It Matters:**
- Keyboard users should not be able to tab out of the modal into hidden content
- Users without this trap experience confusing navigation
- Focus trapping is essential for keyboard accessibility

#### Focus Restoration
When modal closes, focus must return to the element that opened it:

```typescript
// Store reference to trigger element
let triggerElement: HTMLElement;

function openModal() {
  triggerElement = document.activeElement as HTMLElement;
  modal.showModal();
  firstFocusableElement.focus();
}

function closeModal() {
  modal.close();
  triggerElement?.focus(); // Restore focus
}
```

**Why It Matters:**
- Keyboard users need to know where they are after closing a modal
- Without focus restoration, users lose their place in the page
- Makes the experience feel disorienting and broken

### 3. Escape Key Handler

#### Implementation
```typescript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.open) {
    closeModal();
  }
});
```

Or using native HTML dialog:
```html
<dialog id="modal">
  <!-- Content -->
</dialog>

<script>
  const dialog = document.getElementById('modal');
  
  // Native dialog handles Escape automatically
  dialog.showModal();
  
  // To handle Escape manually:
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault(); // Prevent close if needed
    closeModal();
  });
</script>
```

**Why It Matters:**
- Escape is the standard keyboard shortcut to close modals
- Users expect this behavior from any modal
- Without it, modal users have no keyboard escape route

### 4. Visible Close Button

#### Requirements
- **Visible**: Must be visible at all times (not hidden behind other elements)
- **Accessible**: Must have descriptive text or aria-label
- **Keyboard accessible**: Must be reachable via Tab key
- **Non-dependent**: Closing should NOT require completing the form

#### Good Example
```html
<dialog role="dialog" aria-modal="true" aria-labelledby="title">
  <button 
    aria-label="Close modal" 
    onClick={closeModal}
    style={{ position: 'absolute', top: '1rem', right: '1rem' }}
  >
    ✕
  </button>
  <h2 id="title">Language Selection</h2>
  <!-- Content -->
</dialog>
```

#### Bad Example (From Issue #1826)
```html
<!-- No close button at all -->
<div>
  <h2>Email Verification</h2>
  <!-- User has NO WAY to close this -->
</div>
```

**Why It Matters:**
- Users need a way to dismiss a modal without completing it
- Email verification modal has no close button - users are TRAPPED
- This is a critical accessibility failure

### 5. Inert Background Content

#### Implementation
```typescript
function openModal() {
  // Disable interaction with page content
  document.body.setAttribute('aria-hidden', 'true');
  document.body.inert = true;
  
  modal.showModal();
}

function closeModal() {
  // Re-enable page interaction
  document.body.removeAttribute('aria-hidden');
  document.body.inert = false;
  
  modal.close();
}
```

Or use native `<dialog>`:
```html
<dialog>
  <!-- Content - backdrop is automatically inert -->
</dialog>
```

**Why It Matters:**
- Prevents accidental interaction with content behind modal
- Screen readers won't read hidden content
- Ensures modal is the only interactive element

## Issue #1825: Language Selection Modal

### Current State
- ✗ No `role="dialog"`
- ✗ No `aria-modal="true"`
- ✗ No focus trap
- ✗ No escape key handler
- ✗ No visible close button
- ✗ No focus restoration

### Acceptance Criteria (From Issue #1825)
> Opening this modal moves focus into it and traps tab navigation within it, pressing escape closes it, and closing it by any method returns focus to the element that originally opened it.

**Must Pass:**
- [ ] Modal has `role="dialog"` and `aria-modal="true"`
- [ ] Modal has `aria-labelledby` pointing to modal title
- [ ] Opening modal moves focus into it
- [ ] Tab key stays within modal (focus trap)
- [ ] Shift+Tab key stays within modal (focus trap)
- [ ] Escape key closes the modal
- [ ] Focus returns to trigger element after close
- [ ] Modal is keyboard navigable

### Implementation Location
Search for: Language selection modal in profile settings
- Likely in: `/components/shared/profile/*` or `/components/settings/*`
- May be named: `LanguageModal`, `LanguageSelector`, `LanguageSelection`

## Issue #1826: Email Verification Modal

### Current State
- ✗ No `role="dialog"`
- ✗ No `aria-modal="true"`
- ✗ No focus trap
- ✗ No escape key handler
- ✗ **No close button at all** - Users cannot exit without completing verification
- ✗ No focus restoration

### Critical Issue
Users are **TRAPPED** in this modal with no way to exit. This is more severe than other modals because:
1. Security flow (verification code entry)
2. No visible escape route
3. No escape key handler
4. No close button
5. User cannot proceed if they don't have access to email

### Acceptance Criteria (From Issue #1826)
> The verification popup has proper dialog semantics, traps focus while open, and provides a clear, accessible way to close it via both mouse and keyboard without requiring verification to be completed first.

**Must Pass:**
- [ ] Modal has `role="dialog"` and `aria-modal="true"`
- [ ] Modal has `aria-labelledby` pointing to modal title
- [ ] **Visible close button is present and accessible**
- [ ] Opening modal moves focus into it
- [ ] Tab key stays within modal (focus trap)
- [ ] Shift+Tab key stays within modal (focus trap)
- [ ] Escape key closes the modal
- [ ] Closing doesn't require completing verification
- [ ] Focus returns to trigger element after close

### Implementation Location
Search for: Email verification modal in profile settings
- Likely in: `/components/shared/profile/*` or `/components/settings/*`
- May be named: `EmailVerification`, `VerificationModal`, `VerificationCode`

## Testing Accessibility

### Manual Testing (Most Important)
1. **Keyboard Navigation**
   - Open modal with mouse
   - Press Tab repeatedly - focus should stay in modal
   - Press Shift+Tab repeatedly - focus should stay in modal
   - Focus should cycle through all interactive elements
   - No accidental focus on page content behind modal

2. **Escape Key**
   - Open modal
   - Press Escape
   - Modal should close
   - Focus should return to element that opened it

3. **Close Button**
   - Close button must be visible
   - Must be clickable
   - Must be reachable via Tab key
   - Should not require completing any form

4. **Screen Reader Testing**
   - Use NVDA (Windows), JAWS, or VoiceOver (Mac)
   - Open modal
   - Screen reader should announce: "Dialog: [Title]"
   - All text content should be readable
   - Form fields should be labeled and accessible

### Automated Testing
```typescript
describe("Modal Accessibility", () => {
  it("should have dialog role and aria-modal", () => {
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
  });

  it("should trap focus within modal", async () => {
    render(<Modal />);
    const dialog = screen.getByRole("dialog");
    
    // Get all focusable elements
    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    // Tab from last to first
    lastElement.focus();
    fireEvent.keyDown(lastElement, { key: 'Tab' });
    expect(document.activeElement).toBe(firstElement);
  });

  it("should close on Escape key", () => {
    const onClose = jest.fn();
    render(<Modal onClose={onClose} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it("should restore focus on close", () => {
    const triggerButton = <button>Open Modal</button>;
    render(
      <>
        {triggerButton}
        <Modal />
      </>
    );
    
    fireEvent.click(screen.getByText("Open Modal"));
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(document.activeElement).toBe(screen.getByText("Open Modal"));
  });
});
```

## Implementation Libraries

### React Recommended Approach
Consider using established accessible modal library:
- **Headless UI Dialog** - Handles most accessibility automatically
- **Radix UI Dialog** - Battle-tested accessibility
- **React ARIA** - Adobe's accessibility library

Example with Headless UI:
```typescript
import { Dialog } from '@headlessui/react';

export function AccessibleModal({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <Dialog.Panel>
        <Dialog.Title>Modal Title</Dialog.Title>
        {/* Content - Dialog handles accessibility */}
      </Dialog.Panel>
    </Dialog>
  );
}
```

### Custom Implementation Checklist
If building custom modal:
- [ ] Add `role="dialog"` and `aria-modal="true"`
- [ ] Add `aria-labelledby` and `aria-describedby`
- [ ] Implement focus trap on Tab/Shift+Tab
- [ ] Implement Escape key handler
- [ ] Add visible close button
- [ ] Restore focus on close
- [ ] Make background content inert
- [ ] Test with screen reader
- [ ] Test keyboard navigation thoroughly

## WCAG Compliance

These requirements align with:
- **WCAG 2.1 Level AA** - Industry standard for accessibility
- **WCAG 2.1 1.4.3 - Focus Visible** - User can see keyboard focus
- **WCAG 2.1 2.1.1 - Keyboard** - All functionality keyboard accessible
- **WCAG 2.1 2.4.3 - Focus Order** - Logical, expected focus order
- **WCAG 2.1 2.5.4 - Target Size** - Touch targets are adequately sized
- **WCAG 2.1 3.2.4 - Consistent Identification** - Consistent patterns
- **WCAG 2.1 4.1.2 - Name, Role, Value** - Proper semantic markup

## References

- [ARIA Authoring Practices Guide: Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [MDN: ARIA: dialog role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/dialog_role)
- [WebAIM: Focus Management](https://webaim.org/articles/keyboard/#focus)
- [Deque University: Modal Dialog](https://dequeuniversity.com/class/modal-dialog/html)
- Issues: #1825, #1826
