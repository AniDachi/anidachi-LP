import { config } from "zod/v4/core";

// Must run before any protocol schema is constructed, in every entrypoint.
// MV3 forbids Function/eval; even Zod's caught capability probe reports a CSP
// violation. Keep the normal schema interpreter and all validation rules.
config({ jitless: true });
