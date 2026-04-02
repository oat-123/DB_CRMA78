/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHEET_CSV_URL?: string;
  readonly VITE_PTTEST_CSV_URL?: string;
  readonly VITE_SHEET_UPDATE_URL?: string;
  readonly VITE_REFRESH_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
