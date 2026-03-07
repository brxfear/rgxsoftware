import PocketBase from 'pocketbase';

const url = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
export const pb = new PocketBase(url);

// Disable auto-cancellation to avoid issues with high-frequency updates/subscriptions
pb.autoCancellation(false);
