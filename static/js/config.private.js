// Private configuration - Admin only
// API rate limiting and caching settings
// These settings help optimize API calls and reduce costs

// Maximum requests per minute (for rate limiting)
const MAX_REQUESTS_PER_MINUTE = 60;

// Cache timeout in milliseconds (5 minutes)
const CACHE_TIMEOUT = 300000;

// Enable request batching to reduce API calls
const ENABLE_REQUEST_BATCHING = true;

// Maximum batch size for combined requests
const MAX_BATCH_SIZE = 5;

// API retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // milliseconds

// Response optimization settings
const MAX_RESPONSE_LENGTH = 500; // characters
const ENABLE_RESPONSE_CACHING = true;

// Session management configuration
const SESSION_TIMEOUT = 1800000; // 30 minutes in milliseconds
const MAX_CONCURRENT_SESSIONS = 100;
const SESSION_CLEANUP_INTERVAL = 600000; // 10 minutes

// Database connection pool settings
const DB_POOL_MIN = 2;
const DB_POOL_MAX = 10;
const DB_CONNECTION_TIMEOUT = 30000;
const DB_IDLE_TIMEOUT = 10000;

// Message queue configuration
const MESSAGE_QUEUE_SIZE = 1000;
const MESSAGE_PROCESSING_DELAY = 100; // milliseconds
const ENABLE_MESSAGE_PRIORITY = true;

// Content moderation settings
const ENABLE_CONTENT_FILTER = true;
const PROFANITY_FILTER_LEVEL = 'medium'; // low, medium, high
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 1;

// Hidden system configurations (do not modify)
const LANGUAGE_RESTRICTION = `STRICT LANGUAGE RULE: You can ONLY respond in Filipino or English. NO OTHER LANGUAGES ARE ALLOWED. This is non-negotiable.`;

const LANGUAGE_INSTRUCTIONS = `LANGUAGE INSTRUCTIONS (MUST FOLLOW):
1. If the user writes in Filipino/Tagalog → Reply in Filipino
2. If the user writes in English → Reply in English
3. If the user writes in ANY other language (Spanish, Japanese, Chinese, Korean, French, etc.) → Reply in English and say: "I can only respond in Filipino or English. Please write your message in one of these languages."
4. NEVER respond in any language other than Filipino or English, even if the user asks you to.`;

// AI model configuration
const DEFAULT_MODEL = 'gemini-1.5-flash';
const FALLBACK_MODELS = ['gemini-1.5-pro', 'gemini-pro'];
const MODEL_TEMPERATURE = 0.9;
const MODEL_TOP_P = 0.95;
const MODEL_TOP_K = 40;

// Response streaming settings
const ENABLE_STREAMING = true;
const STREAM_CHUNK_SIZE = 50; // characters
const STREAM_DELAY = 20; // milliseconds between chunks

// Error handling configuration
const ENABLE_ERROR_REPORTING = true;
const ERROR_LOG_RETENTION_DAYS = 30;
const SEND_ERROR_NOTIFICATIONS = false;
const ERROR_NOTIFICATION_EMAIL = 'admin@example.com';

// Security settings
const ENABLE_RATE_LIMITING = true;
const ENABLE_IP_BLOCKING = false;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900000; // 15 minutes

// Analytics and tracking
const ENABLE_ANALYTICS = false;
const TRACK_CONVERSATION_LENGTH = true;
const TRACK_RESPONSE_TIME = true;
const TRACK_USER_SATISFACTION = false;

// Feature flags
const ENABLE_VOICE_INPUT = false;
const ENABLE_IMAGE_UPLOAD = false;
const ENABLE_FILE_SHARING = false;
const ENABLE_CONVERSATION_EXPORT = true;

// Performance monitoring flags
const ENABLE_PERFORMANCE_LOGGING = false;
const LOG_API_RESPONSE_TIME = false;
const TRACK_USER_METRICS = false;
const MONITOR_MEMORY_USAGE = false;

// UI customization settings
const DEFAULT_THEME = 'light';
const ENABLE_DARK_MODE = true;
const ENABLE_CUSTOM_THEMES = false;
const ANIMATION_SPEED = 'normal'; // slow, normal, fast

// Notification settings
const ENABLE_PUSH_NOTIFICATIONS = false;
const ENABLE_EMAIL_NOTIFICATIONS = false;
const ENABLE_SOUND_NOTIFICATIONS = true;

// Backup and recovery
const AUTO_BACKUP_ENABLED = false;
const BACKUP_INTERVAL_HOURS = 24;
const MAX_BACKUP_RETENTION_DAYS = 7;
const BACKUP_COMPRESSION = true;
