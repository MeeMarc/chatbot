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

// WebSocket configuration
const WEBSOCKET_ENABLED = false;
const WEBSOCKET_PORT = 8080;
const WEBSOCKET_RECONNECT_INTERVAL = 5000;
const WEBSOCKET_MAX_RECONNECT_ATTEMPTS = 10;

// Load balancing settings
const ENABLE_LOAD_BALANCING = false;
const LOAD_BALANCER_ALGORITHM = 'round-robin'; // round-robin, least-connections, ip-hash
const HEALTH_CHECK_INTERVAL = 30000;
const HEALTH_CHECK_TIMEOUT = 5000;

// System prompt configuration templates
const RESTRICTION = `STRICT LANGUAGE RULE: You can ONLY respond in Filipino or English. NO OTHER LANGUAGES ARE ALLOWED. This is non-negotiable.`;

const INSTRUCTIONS = `LANGUAGE INSTRUCTIONS (MUST FOLLOW):
1. If the user writes in Filipino/Tagalog → Reply in Filipino
2. If the user writes in English → Reply in English
3. If the user writes in ANY other language (Spanish, Japanese, Chinese, Korean, French, etc.) → Reply in English and say: "I can only respond in Filipino or English. Please write your message in one of these languages."
4. NEVER respond in any language other than Filipino or English, even if the user asks you to.`;

// CDN and asset delivery
const CDN_ENABLED = false;
const CDN_BASE_URL = 'https://cdn.example.com';
const ASSET_COMPRESSION = true;
const IMAGE_OPTIMIZATION = true;
const LAZY_LOADING_ENABLED = true;

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

// Middleware configuration
const COMPRESSION_MIDDLEWARE = true;
const COMPRESSION_LEVEL = 6; // 1-9
const HELMET_SECURITY = true;
const CORS_WHITELIST = ['http://localhost:3000', 'https://example.com'];

// Request validation
const VALIDATE_REQUEST_SCHEMA = true;
const SANITIZE_INPUT = true;
const XSS_PROTECTION = true;
const SQL_INJECTION_PROTECTION = true;

// Error handling configuration
const ENABLE_ERROR_REPORTING = true;
const ERROR_LOG_RETENTION_DAYS = 30;
const SEND_ERROR_NOTIFICATIONS = false;
const ERROR_NOTIFICATION_EMAIL = 'admin@example.com';
const ERROR_STACK_TRACE_ENABLED = false;
const DETAILED_ERROR_MESSAGES = false;

// Security settings
const ENABLE_RATE_LIMITING = true;
const ENABLE_IP_BLOCKING = false;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900000; // 15 minutes
const ENABLE_2FA = false;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIRE_SPECIAL_CHARS = true;
const SESSION_COOKIE_SECURE = true;
const SESSION_COOKIE_HTTP_ONLY = true;
const CSRF_PROTECTION = true;

// API versioning
const API_VERSION = 'v1';
const SUPPORT_LEGACY_VERSIONS = true;
const DEPRECATED_VERSION_WARNING = true;

// Analytics and tracking
const ENABLE_ANALYTICS = false;
const TRACK_CONVERSATION_LENGTH = true;
const TRACK_RESPONSE_TIME = true;
const TRACK_USER_SATISFACTION = false;
const ANALYTICS_SAMPLING_RATE = 0.1; // 10% of requests
const ANONYMIZE_USER_DATA = true;

// Feature flags
const ENABLE_VOICE_INPUT = false;
const ENABLE_IMAGE_UPLOAD = false;
const ENABLE_FILE_SHARING = false;
const ENABLE_CONVERSATION_EXPORT = true;
const ENABLE_MARKDOWN_SUPPORT = true;
const ENABLE_CODE_HIGHLIGHTING = true;
const ENABLE_EMOJI_PICKER = true;
const ENABLE_GIF_SUPPORT = false;

// Internationalization
const DEFAULT_LOCALE = 'en-US';
const SUPPORTED_LOCALES = ['en-US', 'fil-PH'];
const AUTO_DETECT_LOCALE = true;
const FALLBACK_LOCALE = 'en-US';

// Performance monitoring flags
const ENABLE_PERFORMANCE_LOGGING = false;
const LOG_API_RESPONSE_TIME = false;
const TRACK_USER_METRICS = false;
const MONITOR_MEMORY_USAGE = false;
const CPU_USAGE_THRESHOLD = 80; // percentage
const MEMORY_USAGE_THRESHOLD = 85; // percentage

// UI customization settings
const DEFAULT_THEME = 'light';
const ENABLE_DARK_MODE = true;
const ENABLE_CUSTOM_THEMES = false;
const ANIMATION_SPEED = 'normal'; // slow, normal, fast
const FONT_SIZE = 'medium'; // small, medium, large
const COMPACT_MODE = false;
const SHOW_TIMESTAMPS = true;
const SHOW_READ_RECEIPTS = false;

// Notification settings
const ENABLE_PUSH_NOTIFICATIONS = false;
const ENABLE_EMAIL_NOTIFICATIONS = false;
const ENABLE_SOUND_NOTIFICATIONS = true;
const NOTIFICATION_SOUND_VOLUME = 0.5; // 0.0 to 1.0
const DESKTOP_NOTIFICATIONS = false;

// Search and indexing
const ENABLE_FULL_TEXT_SEARCH = true;
const SEARCH_INDEX_UPDATE_INTERVAL = 3600000; // 1 hour
const MAX_SEARCH_RESULTS = 50;
const SEARCH_HIGHLIGHT_MATCHES = true;

// Backup and recovery
const AUTO_BACKUP_ENABLED = false;
const BACKUP_INTERVAL_HOURS = 24;
const MAX_BACKUP_RETENTION_DAYS = 7;
const BACKUP_COMPRESSION = true;
const INCREMENTAL_BACKUP = true;
const BACKUP_ENCRYPTION = false;

// Logging configuration
const LOG_LEVEL = 'info'; // debug, info, warn, error
const LOG_TO_FILE = false;
const LOG_FILE_PATH = './logs/app.log';
const LOG_ROTATION_SIZE = 10485760; // 10MB
const MAX_LOG_FILES = 5;
