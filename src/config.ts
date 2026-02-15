/**
 * Hub relay configuration (for the user running the relay).
 *
 * You (the hub): Run relay, put the LOCAL address here for auto-connect.
 * Remote user: You share the REMOTE address with them; they paste it in the app.
 *
 * Setup:
 * 1. Run `npm run relay` — port is saved in scripts/relay-config.json
 * 2. Allow the relay port in Windows Firewall (see docs/FIREWALL_AND_PORTS.md)
 * 3. Port-forward the relay port in your router to this machine
 * 4. Copy the "Local" address from relay output → paste below (for your app)
 * 5. Share the "Remote" address (with your public IP) with the other user
 *
 * Update when you restart the relay (peer ID changes).
 */
export const DEFAULT_RELAY_ADDRESS =
  '/ip4/127.0.0.1/tcp/PORT/ws/p2p/RELAY_PEER_ID';
