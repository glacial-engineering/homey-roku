'use strict';

const Homey = require('homey');
const RokuClient = require('../../lib/RokuClient');

class RokuTvDevice extends Homey.Device {
  async onInit() {
    this.pollInterval = this.getSetting('pollInterval') || 30;
    const host = this.getSetting('host');
    this.log('Initializing with host:', host, 'interval:', this.pollInterval);

    await this._migrateCapabilities();

    this.client = new RokuClient(host);
    this._lastActiveAppId = null;
    this._isPlaying = false;

    this._registerCapabilityListeners();
    this.driver.recalculateInterval(host);
  }

  async _migrateCapabilities() {
    const remove = ['channel_up', 'channel_down'];
    const add = [
      'nav_home', 'nav_back', 'nav_up', 'nav_left', 'nav_ok',
      'nav_right', 'nav_down', 'nav_replay', 'nav_info',
    ];
    for (const cap of remove) {
      if (this.hasCapability(cap)) {
        await this.removeCapability(cap).catch(this.error);
      }
    }
    for (const cap of add) {
      if (!this.hasCapability(cap)) {
        await this.addCapability(cap).catch(this.error);
      }
    }
  }

  _registerCapabilityListeners() {
    this.registerCapabilityListener('onoff', async (value) => {
      await this.client.keypress(value ? 'Power' : 'PowerOff');
    });
    this.registerCapabilityListener('volume_up', async () => {
      await this.client.keypress('VolumeUp');
    });
    this.registerCapabilityListener('volume_down', async () => {
      await this.client.keypress('VolumeDown');
    });
    this.registerCapabilityListener('volume_mute', async () => {
      await this.client.keypress('VolumeMute');
    });

    const navMap = {
      nav_up: 'Up',
      nav_down: 'Down',
      nav_left: 'Left',
      nav_right: 'Right',
      nav_ok: 'Select',
      nav_back: 'Back',
      nav_home: 'Home',
      nav_info: 'Info',
      nav_replay: 'InstantReplay',
    };
    for (const [cap, key] of Object.entries(navMap)) {
      this.registerCapabilityListener(cap, async () => {
        await this.client.keypress(key);
      });
    }

    this.registerCapabilityListener('speaker_prev', async () => {
      await this.client.keypress('Rev');
    });
    this.registerCapabilityListener('speaker_next', async () => {
      await this.client.keypress('Fwd');
    });
    this.registerCapabilityListener('speaker_playing', async (value) => {
      // Roku Play key toggles between play/pause
      await this.client.keypress('Play');
      this._isPlaying = value;
    });
  }

  getHost() {
    return this.getSetting('host');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    if (changedKeys.includes('host')) {
      const oldHost = oldSettings.host;
      const newHost = newSettings.host;
      this.log('Host changed from', oldHost, 'to', newHost);
      this.client = new RokuClient(newHost);
      this.driver.recalculateInterval(newHost);
      this.driver.stopPollingIfUnused(oldHost);
    }
    if (changedKeys.includes('pollInterval')) {
      this.pollInterval = newSettings.pollInterval;
      this.log('Poll interval changed to', this.pollInterval);
      this.driver.recalculateInterval(this.getHost());
    }
  }

  updateFromPoll(info, activeApp) {
    try {
      // power-mode: "PowerOn" when on; "DisplayOff", "Headless", "Ready" when off/standby
      const powerMode = info['power-mode'] || '';
      const isOn = powerMode === 'PowerOn';
      this.setCapabilityValue('onoff', isOn).catch(this.error);

      const newAppId = activeApp ? activeApp.id : null;
      if (newAppId !== this._lastActiveAppId) {
        this._lastActiveAppId = newAppId;
        if (activeApp) {
          this.driver.activeAppTrigger
            .trigger(this, { app_id: activeApp.id, app_name: activeApp.name })
            .catch(this.error);
        }
      }

      this.setAvailable().catch(this.error);
    } catch (err) {
      this.error('Update failed:', err.message);
      this.setUnavailable('Roku data error').catch(this.error);
    }
  }

  async onUninit() {
    this.driver.stopPollingIfUnused(this.getHost());
  }
}

module.exports = RokuTvDevice;
