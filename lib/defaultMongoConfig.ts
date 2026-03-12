const DEFAULT_MONGODB_URI =
  process.env.MONGODB_URI || process.env.cliqs_MONGODB_URI || "";

const DEFAULT_MONGODB_DB_NAME =
  process.env.MONGODB_DB_NAME || process.env.cliqs_MONGODB_DB_NAME || undefined;

// Support both the legacy env names and the Vercel-prefixed cliqs_* variants.
const hasDefaultMongoConfig = () => Boolean(DEFAULT_MONGODB_URI);

export { DEFAULT_MONGODB_URI, DEFAULT_MONGODB_DB_NAME, hasDefaultMongoConfig };
