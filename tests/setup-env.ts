import { config } from "dotenv";
// Load local env for integration tests (unit tests don't need it).
config({ path: ".env.local" });
config();
