import "whatwg-fetch";

import "@testing-library/jest-dom";

// Polyfill TextEncoder / TextDecoder — required by @stellar/stellar-sdk and
// other crypto libs when running in Jest's jsdom environment.
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextEncoder, TextDecoder });
