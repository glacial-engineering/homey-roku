'use strict';

const Homey = require('homey');

class RokuApp extends Homey.App {
  async onInit() {
    this.log('Roku app initialized');
  }
}

module.exports = RokuApp;
