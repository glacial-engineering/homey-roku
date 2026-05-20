'use strict';

const http = require('http');
const dgram = require('dgram');

class RokuClient {
  constructor(host) {
    this.host = host.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/:\d+$/, '');
    this.port = 8060;
  }

  _request(method, path) {
    return new Promise((resolve, reject) => {
      const headers = { 'Content-Length': '0' };
      if (method === 'POST') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      const options = {
        hostname: this.host,
        port: this.port,
        path,
        method,
        headers,
      };

      let settled = false;
      const settle = (fn, val) => {
        if (!settled) {
          settled = true;
          fn(val);
        }
      };

      const hardTimeout = setTimeout(() => {
        req.destroy();
        settle(reject, new Error(`Request to ${this.host}${path} timed out`));
      }, 5000);

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          clearTimeout(hardTimeout);
          if (res.statusCode >= 400) {
            settle(reject, new Error(`Roku ${method} ${path} returned ${res.statusCode}`));
          } else {
            settle(resolve, data);
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(hardTimeout);
        settle(reject, new Error(`Roku ${method} ${path} failed: ${err.message}`));
      });

      req.end();
    });
  }

  async keypress(key) {
    return this._request('POST', `/keypress/${encodeURIComponent(key)}`);
  }

  async launch(appId, params) {
    let path = `/launch/${encodeURIComponent(appId)}`;
    if (params) {
      const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      path += `?${qs}`;
    }
    return this._request('POST', path);
  }

  async typeLiteral(text) {
    for (const ch of text) {
      // eslint-disable-next-line no-await-in-loop
      await this.keypress(`Lit_${encodeURIComponent(ch)}`);
    }
  }

  async getDeviceInfo() {
    const xml = await this._request('GET', '/query/device-info');
    return RokuClient.parseFlatXml(xml);
  }

  async getActiveApp() {
    const xml = await this._request('GET', '/query/active-app');
    const match = xml.match(/<app[^>]*?id="([^"]+)"[^>]*>([^<]*)<\/app>/);
    if (match) {
      return { id: match[1], name: match[2].trim() };
    }
    const screensaver = xml.match(/<screensaver[^>]*?id="([^"]+)"[^>]*>([^<]*)<\/screensaver>/);
    if (screensaver) {
      return { id: screensaver[1], name: screensaver[2].trim(), isScreensaver: true };
    }
    return null;
  }

  async getApps() {
    const xml = await this._request('GET', '/query/apps');
    const apps = [];
    const re = /<app\s+id="([^"]+)"[^>]*?>([^<]*)<\/app>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      apps.push({ id: m[1], name: m[2].trim() });
    }
    return apps;
  }

  static parseFlatXml(xml) {
    const out = {};
    const re = /<([a-zA-Z0-9_-]+)>([^<]*)<\/\1>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      out[m[1]] = m[2].trim();
    }
    return out;
  }

  /**
   * SSDP M-SEARCH for Roku devices on the LAN.
   * Returns array of { host, location, usn, serialNumber? } within timeoutMs.
   */
  static discover(timeoutMs = 3000) {
    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const found = new Map();

      const message = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n'
        + 'HOST: 239.255.255.250:1900\r\n'
        + 'MAN: "ssdp:discover"\r\n'
        + 'ST: roku:ecp\r\n'
        + 'MX: 3\r\n\r\n',
      );

      socket.on('message', (msg, rinfo) => {
        const text = msg.toString();
        const locationMatch = text.match(/LOCATION:\s*(.+)/i);
        const usnMatch = text.match(/USN:\s*(.+)/i);
        if (locationMatch) {
          const location = locationMatch[1].trim();
          const hostMatch = location.match(/^https?:\/\/([^:/]+)/);
          const host = hostMatch ? hostMatch[1] : rinfo.address;
          if (!found.has(host)) {
            found.set(host, {
              host,
              location,
              usn: usnMatch ? usnMatch[1].trim() : null,
            });
          }
        }
      });

      socket.on('error', () => {
        try { socket.close(); } catch (e) { /* ignore */ }
        resolve([]);
      });

      socket.bind(0, () => {
        try {
          socket.setBroadcast(true);
          socket.send(message, 0, message.length, 1900, '239.255.255.250');
        } catch (e) {
          /* ignore */
        }
      });

      setTimeout(() => {
        try { socket.close(); } catch (e) { /* ignore */ }
        resolve(Array.from(found.values()));
      }, timeoutMs);
    });
  }
}

module.exports = RokuClient;
