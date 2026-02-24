import "whatwg-fetch";

import "@testing-library/jest-dom";

// Add TextEncoder and TextDecoder to global scope for Stellar SDK compatibility
import { TextEncoder, TextDecoder } from "util";

Object.assign(global, {
  TextEncoder,
  TextDecoder,
});
