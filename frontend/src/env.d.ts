/// <reference types="vite/client" />

// Public build-time configuration (frontend/.env.example). VITE_ variables are bundled: never secrets.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
