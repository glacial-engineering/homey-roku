'use strict';

const Homey = require('homey');
const RokuClient = require('../../lib/RokuClient');

class RokuTvDevice extends Homey.Device {
  async onInit() {
    this.pollInterval = this.getSetting('pollInterval') || 30;
    const host = this.getSetting('host');
    this.log('Initializing with host:', host, 'interval:', this.pollInterval);

    this.client = new RokuClient(host);
    this._lastActiveAppId = null;
    this._isPlaying = false;

    this._registerCapabilityListeners();
    this.driver.recalculateInterval(host);
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
    this.registerCapabilityListener('channel_up', async () => {
      await this.client.keypress('ChannelUp');
    });
    this.registerCapabilityListener('channel_down', async () => {
      await this.client.keypress('ChannelDown');
    });
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
