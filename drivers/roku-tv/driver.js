'use strict';

const Homey = require('homey');
const RokuClient = require('../../lib/RokuClient');

class RokuTvDriver extends Homey.Driver {
  async onInit() {
    this.pollers = new Map(); // host -> { client, timer, interval }

    this.activeAppTrigger = this.homey.flow.getDeviceTriggerCard('active_app_changed');

    this._registerActions();
  }

  _registerActions() {
    this.homey.flow.getActionCard('send_key').registerRunListener(async (args) => {
      await args.device.client.keypress(args.key);
    });

    this.homey.flow.getActionCard('set_input').registerRunListener(async (args) => {
      await args.device.client.keypress(args.input);
    });

    this.homey.flow.getActionCard('send_text').registerRunListener(async (args) => {
      await args.device.client.typeLiteral(args.text);
    });

    const launchAction = this.homey.flow.getActionCard('launch_app');
    launchAction.registerRunListener(async (args) => {
      await args.device.client.launch(args.app.id);
    });
    launchAction.registerArgumentAutocompleteListener('app', async (query, args) => {
      try {
        const apps = await args.device.client.getApps();
        const filtered = query
          ? apps.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
          : apps;
        return filtered.map((a) => ({ id: a.id, name: a.name }));
      } catch (err) {
        this.error('Failed to fetch apps:', err.message);
        return [];
      }
    });
  }

  startPolling(host, interval) {
    if (this.pollers.has(host)) {
      const poller = this.pollers.get(host);
      if (poller.interval === interval) return;
      this.homey.clearInterval(poller.timer);
    }

    const client = new RokuClient(host);
    const poll = () => this._poll(host, client);
    const timer = this.homey.setInterval(poll, interval * 1000);
    this.pollers.set(host, { client, timer, interval });
    poll();
  }

  _devicesForHost(host) {
    return this.getDevices().filter((d) => d.getHost() === host);
  }

  stopPollingIfUnused(host) {
    if (this._devicesForHost(host).length === 0 && this.pollers.has(host)) {
      this.homey.clearInterval(this.pollers.get(host).timer);
      this.pollers.delete(host);
      this.log('Stopped polling', host, '(no devices)');
    }
  }

  recalculateInterval(host) {
    const devices = this._devicesForHost(host);
    if (devices.length === 0) return;
    const fastest = Math.min(...devices.map((d) => d.pollInterval || 30));
    this.startPolling(host, fastest);
  }

  async _poll(host, client) {
    const devices = this._devicesForHost(host);
    if (devices.length === 0) return;

    try {
      const [info, activeApp] = await Promise.all([
        client.getDeviceInfo(),
        client.getActiveApp().catch(() => null),
      ]);
      for (const device of devices) {
        device.updateFromPoll(info, activeApp);
      }
    } catch (err) {
      this.error('Poll failed for', host, err.message);
      for (const device of devices) {
        device.setUnavailable('Roku unreachable').catch(this.error);
      }
    }
  }

  async onPair(session) {
    let mode = 'auto';
    let manualResult = null;

    session.setHandler('login', async (data) => {
      const host = (data.username || '').trim();
      this.log('Pairing: testing manual host', host);
      if (!host) throw new Error('Host is required');

      const info = await new RokuClient(host).getDeviceInfo();
      if (!info['serial-number']) {
        throw new Error('Device did not return a serial number');
      }

      manualResult = {
        name: info['user-device-name'] || info['friendly-device-name'] || info['model-name'] || `Roku ${host}`,
        data: { id: info['serial-number'] },
        settings: { host },
      };
      mode = 'manual';
      return true;
    });

    session.setHandler('list_devices', async () => {
      if (mode === 'manual' && manualResult) {
        const result = [manualResult];
        manualResult = null;
        return result;
      }

      this.log('Pairing: running SSDP discovery');
      const found = await RokuClient.discover(3000);
      this.log('Pairing: found', found.length, 'Roku(s) via SSDP');

      const devices = [];
      for (const r of found) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const info = await new RokuClient(r.host).getDeviceInfo();
          if (!info['serial-number']) continue;
          devices.push({
            name: info['user-device-name'] || info['friendly-device-name'] || info['model-name'] || `Roku ${r.host}`,
            data: { id: info['serial-number'] },
            settings: { host: r.host },
          });
        } catch (err) {
          this.error('Failed to query', r.host, err.message);
        }
      }
      return devices;
    });
  }

  async onUninit() {
    for (const [, poller] of this.pollers) {
      this.homey.clearInterval(poller.timer);
    }
    this.pollers.clear();
  }
}

module.exports = RokuTvDriver;
