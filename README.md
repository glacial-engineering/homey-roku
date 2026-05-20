# Roku

Athom Homey smart-home app to control [Roku](https://www.roku.com/) TVs over the local network using the [External Control Protocol (ECP)](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md).

## Features

- Control Roku TVs from Homey: power, volume, channel, transport, app launch
- Auto-discovery via SSDP, plus manual IP entry
- Multiple Roku TVs supported (centralized polling per host)
- Flow cards for arbitrary key presses, text input, app launching, and active-app triggers

### Capabilities

- `onoff` — Power / Power off
- `volume_up` / `volume_down` / `volume_mute`
- `channel_up` / `channel_down`
- `speaker_prev` / `speaker_next` — Rewind / Fast-forward
- `speaker_playing` — Play / Pause toggle

### Flow cards

- **Action: Send key** — Home, Back, Select, Up/Down/Left/Right, Play, Search, etc.
- **Action: Set input** — Tuner, HDMI 1–4, AV 1
- **Action: Type text** — sends a string of characters via the on-screen keyboard
- **Action: Launch app** — pick from the apps installed on the Roku
- **Trigger: Active app changed** — fires when the foreground app changes

### Device Settings

- **Host** — IP address or hostname of the Roku (port 8060 is used automatically)
- **Polling interval** — How often to poll device-info / active-app (5–300 s, default 30)

## Install

### From source (Homey CLI)

```bash
git clone https://github.com/glacial-engineering/homey-roku.git
cd homey-roku
homey app install
```

### Requirements

- Homey Pro with firmware ≥ 5.0.0
- [Homey CLI](https://apps.developer.homey.app/the-basics/getting-started/homey-cli) installed
- Roku TV with **Network access: Permissive** (default) — Settings → System → Advanced system settings → Control by mobile apps

## Setup

1. Install the app on your Homey Pro
2. Add a new device → Roku TV
3. Choose **Discover automatically** (SSDP) or **Enter IP manually**
4. Confirm and finish pairing

## Notes

- ECP does not report the current input source, so input switching is provided as a Flow action only (no stateful capability).
- Power-on requires the Roku TV to be in network standby (the default). Wake-on-LAN is not implemented.
- The Roku **Play** key toggles between play and pause; Homey's `speaker_playing` state may drift if the Roku is controlled with a physical remote.

## Troubleshooting

### Buttons do nothing / 403 Forbidden in logs

The Roku TV's network-access setting is too restrictive. ECP control commands (button presses, app launches, etc.) require the TV to allow external network control.

On the Roku TV:

**Settings → System → Advanced system settings → Control by mobile apps → Network access**

Set it to **Permissive** (or **Default**, depending on Roku OS version). If it's set to **Disabled**, all POST requests return `403 Forbidden`.

You can verify the Roku side directly from any machine on the same LAN:

```bash
curl -v -d '' http://<roku-ip>:8060/keypress/Home
```

A working Roku returns `HTTP/1.1 200 OK`. A 403 means the setting above needs to change.

### Device not found during auto-discovery

- Make sure Homey and the Roku are on the **same LAN / VLAN** (SSDP uses multicast and does not cross subnets).
- Try **Enter IP manually** instead — it bypasses discovery entirely.
- Some routers block SSDP/multicast between wired and wireless segments; check AP isolation settings.

### Device shows as unavailable

- Confirm the Roku's IP hasn't changed (DHCP can reassign). Update the **Host** setting on the device if needed, or reserve a static lease in your router.
- ECP listens on port `8060`. If the Roku is behind a firewall, allow Homey's IP to reach that port.

## Changelog

- **1.0.0** — Initial release. SSDP + manual pairing, standard TV capabilities, Flow cards for key/text/app/input.

## Development

```bash
# Run in dev mode (uninstalls on Ctrl+C)
homey app run --remote

# Install permanently
homey app install
```

## License

MIT
