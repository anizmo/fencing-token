/* Fencing Token Live settings. After `npx wrangler deploy`, paste your Worker's address below
   (it is printed by the deploy command, e.g. https://fencingtoken-live.yourname.workers.dev) and
   change https:// to wss://. Nothing here is secret. */
window.FT_LIVE = {
  api: 'wss://fencingtoken-live.REPLACE-ME.workers.dev',
  joinUrl: 'fencingtoken.com/live',
  defaultRoom: 'XAI',
};
