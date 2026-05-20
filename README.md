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
