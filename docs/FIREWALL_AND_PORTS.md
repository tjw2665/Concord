# Firewall & Port Configuration

## Relay Port

The relay uses a **persistent port** stored in `scripts/relay-config.json`. On first run, it picks a random unused port and saves it. The same port is used on subsequent runs.

To change the port: edit `relay-config.json` or delete it to get a new random port.

---

## Windows Firewall

### Allow the relay (inbound)

1. Open **Windows Defender Firewall** → **Advanced settings**
2. Click **Inbound Rules** → **New Rule**
3. Select **Port** → Next
4. Select **TCP**, enter the port from `relay-config.json` (e.g. `41523`) → Next
5. Select **Allow the connection** → Next
6. Check Domain, Private, Public (as needed) → Next
7. Name: `Concord Relay` → Finish

### Or via PowerShell (run as Administrator)

```powershell
# Replace 41523 with your relay port from relay-config.json
New-NetFirewallRule -DisplayName "Concord Relay" -Direction Inbound -Protocol TCP -LocalPort 41523 -Action Allow
```

---

## Router Port Forwarding

For remote users to connect, forward the relay port to your machine:

1. Log into your router (often 192.168.1.1 or 192.168.0.1)
2. Find **Port Forwarding** / **Virtual Server** / **NAT**
3. Add rule:
   - **External port**: your relay port (from relay-config.json)
   - **Internal IP**: your machine's LAN IP (e.g. 192.168.1.100)
   - **Internal port**: same as external
   - **Protocol**: TCP

---

## Verify

- **Local**: Relay should start without errors
- **Remote**: Use https://www.yougetsignal.com/tools/open-ports/ — enter your public IP and relay port
