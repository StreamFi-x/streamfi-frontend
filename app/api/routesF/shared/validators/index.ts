import { 
  VERIFICATION_METHODS, 
  COLOR_BLIND_MODES,
  MAX_PROOF_LINKS,
  MIN_PROOF_LINKS_REQUIRED,
  URL_REGEX 
} from '../constants';
import { validateDate } from '../helpers/dateUtilities';
import type { 
  ValidationError,
  SubmitVerificationRequest,
  SetBirthdayRequest,
  SetColorBlindRequest 
} from '../types';

/**
 * Validate birthday configuration request
 */
export function validateBirthdayRequest(data: unknown): {
  isValid: boolean;
  errors: ValidationError[];
  validatedData?: SetBirthdayRequest;
} {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body is required' }],
    };
  }

  const { viewer_id, birthday_iso, share_with_creators } = data as Record<string, unknown>;

  // Validate viewer_id
  if (!viewer_id || typeof viewer_id !== 'string' || viewer_id.trim().length === 0) {
    errors.push({ field: 'viewer_id', message: 'viewer_id is required' });
  }

  // Validate birthday_iso
  if (!birthday_iso || typeof birthday_iso !== 'string') {
    errors.push({ field: 'birthday_iso', message: 'birthday_iso is required' });
  } else {
    const dateValidation = validateDate(birthday_iso as string);
    if (!dateValidation.isValid) {
      errors.push({ field: 'birthday_iso', message: dateValidation.error || 'Invalid date' });
    }
  }

  // Validate share_with_creators
  if (typeof share_with_creators !== 'boolean') {
    errors.push({ field: 'share_with_creators', message: 'share_with_creators must be a boolean' });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    validatedData: {
      viewer_id: (viewer_id as string).trim(),
      birthday_iso: (birthday_iso as string),
      share_with_creators: share_with_creators as boolean,
    },
  };
}

/**
 * Validate verification request
 */
export function validateVerificationRequest(data: unknown): {
  isValid: boolean;
  errors: ValidationError[];
  validatedData?: SubmitVerificationRequest;
} {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body is required' }],
    };
  }

  const { creator_id, method, proof_links } = data as Record<string, unknown>;

  // Validate creator_id
  if (!creator_id || typeof creator_id !== 'string' || creator_id.trim().length === 0) {
    errors.push({ field: 'creator_id', message: 'creator_id is required' });
  }

  // Validate method
  if (!method || typeof method !== 'string') {
    errors.push({ field: 'method', message: 'method is required' });
  } else if (!VERIFICATION_METHODS.includes(method as any)) {
    errors.push({ 
      field: 'method', 
      message: `method must be one of: ${VERIFICATION_METHODS.join(', ')}` 
    });
  }

  // Validate proof_links
  if (!Array.isArray(proof_links)) {
    errors.push({ field: 'proof_links', message: 'proof_links must be an array' });
  } else {
    if (proof_links.length < MIN_PROOF_LINKS_REQUIRED) {
      errors.push({ 
        field: 'proof_links', 
        message: `At least ${MIN_PROOF_LINKS_REQUIRED} proof link is required` 
      });
    }

    if (proof_links.length > MAX_PROOF_LINKS) {
      errors.push({ 
        field: 'proof_links', 
        message: `Maximum ${MAX_PROOF_LINKS} proof links allowed` 
      });
    }

    proof_links.forEach((link, index) => {
      if (typeof link !== 'string' || link.trim().length === 0) {
        errors.push({ 
          field: `proof_links[${index}]`, 
          message: 'Proof link must be a non-empty string' 
        });
      } else if (!URL_REGEX.test(link.trim())) {
        errors.push({ 
          field: `proof_links[${index}]`, 
          message: 'Proof link must be a valid URL' 
        });
      }
    });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    validatedData: {
      creator_id: (creator_id as string).trim(),
      method: method as any,
      proof_links: (proof_links as string[]).map(link => link.trim()),
    },
  };
}

/**
 * Validate color blind preference request
 */
export function validateColorBlindRequest(data: unknown): {
  isValid: boolean;
  errors: ValidationError[];
  validatedData?: SetColorBlindRequest;
} {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'body', message: 'Request body is required' }],
    };
  }

  const { viewer_id, mode } = data as Record<string, unknown>;

  // Validate viewer_id
  if (!viewer_id || typeof viewer_id !== 'string' || viewer_id.trim().length === 0) {
    errors.push({ field: 'viewer_id', message: 'viewer_id is required' });
  }

  // Validate mode
  if (!mode || typeof mode !== 'string') {
    errors.push({ field: 'mode', message: 'mode is required' });
  } else if (!COLOR_BLIND_MODES.includes(mode as any)) {
    errors.push({ 
      field: 'mode', 
      message: `mode must be one of: ${COLOR_BLIND_MODES.join(', ')}` 
    });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    validatedData: {
      viewer_id: (viewer_id as string).trim(),
      mode: mode as any,
    },
  };
}

/**
 * Validate viewer_id query parameter
 */
export function validateViewerIdQuery(viewerId: string | null): {
  isValid: boolean;
  error?: string;
} {
  if (!viewerId) {
    return {
      isValid: false,
      error: 'viewer_id query parameter is required',
    };
  }

  if (typeof viewerId !== 'string' || viewerId.trim().length === 0) {
    return {
      isValid: false,
      error: 'viewer_id must be a non-empty string',
    };
  }

  return { isValid: true };
}

/**
 * Validate creator_id query parameter
 */
export function validateCreatorIdQuery(creatorId: string | null): {
  isValid: boolean;
  error?: string;
} {
  if (!creatorId) {
    return {
      isValid: false,
      error: 'creator_id query parameter is required',
    };
  }

  if (typeof creatorId !== 'string' || creatorId.trim().length === 0) {
    return {
      isValid: false,
      error: 'creator_id must be a non-empty string',
    };
  }

  return { isValid: true };
}

/**
 * Validate request_id query parameter
 */
export function validateRequestIdQuery(requestId: string | null): {
  isValid: boolean;
  error?: string;
} {
  if (!requestId) {
    return {
      isValid: false,
      error: 'request_id query parameter is required',
    };
  }

  if (typeof requestId !== 'string' || requestId.trim().length === 0) {
    return {
      isValid: false,
      error: 'request_id must be a non-empty string',
    };
  }

  return { isValid: true };
}