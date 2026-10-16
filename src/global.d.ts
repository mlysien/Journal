import type { JournalApi } from '../electron/api';

declare global {
  interface Window {
    journal: JournalApi;
  }
}
