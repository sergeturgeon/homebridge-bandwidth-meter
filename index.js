var Service;
var Characteristic;
var snmp = require('snmp-native');

module.exports = function (homebridge)
{
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-bandwidth-meter", "BandwidthMeter", BandwidthMeterAccessory);
}

function BandwidthMeterAccessory(log, config)
{
  this.log = log;
  this.accessoryLabel = config['accessory'];
  this.name = config['name'];
  this.bridgeUpdateIntervalInSec = config['bridge_update_interval_in_sec'];

  this.movingAverageIntervals = config['moving_average_intervals'];

  // Valid moving average intervals range is 1 to 10
  if (!this.movingAverageIntervals ||
      this.movingAverageIntervals < 1 ||
      this.movingAverageIntervals > 10) {
      this.movingAverageIntervals = 3;
  }

  this.snmpIpAddress = config['snmp_ip_address'];
  this.snmpCommunity = config['snmp_community'];
  this.snmpOid = config['snmp_oid'];
  this.snmpQueryIntervalInSec = config['snmp_query_interval_in_sec'];

  this.iftttApiKey = config['ifttt_api_key'];
  this.iftttEvent = config['ifttt_event'];
  this.iftttThresholdMbps = config['ifttt_threshold_mbps'];
  this.iftttMaximumNotificationIntervalInSec = config['ifttt_maximum_notification_interval_in_sec'];

  this.useFahrenheitConversion = config['locale_uses_fahrenheit'];
  if (this.useFahrenheitConversion === undefined) {
    this.useFahrenheitConversion = false;
  }
  this.verbose = config['verbose'];
  if (this.verbose === undefined) {
    this.verbose = false;
  }

  this.log("bridge update interval in sec " + this.bridgeUpdateIntervalInSec);
  this.log("moving average intervals " + this.movingAverageIntervals);
  this.log("snmp ip address " + this.snmpIpAddress);
  this.log("snmp community " + this.snmpCommunity);
  this.log("snmp oid " + this.snmpOid);
  this.log("snmp query interval in sec " + this.snmpQueryIntervalInSec);
  this.log("ifttt api key " + this.iftttApiKey);
  this.log("ifttt event " + this.iftttEvent);
  this.log("ifttt threshold mbps " + this.iftttThresholdMbps);
  this.log("ifttt maximum notification interval in sec " + this.iftttMaximumNotificationIntervalInSec);
  this.log("locale uses fahrenheit (use conversion) " + this.useFahrenheitConversion)

  this.lastOctets = [];
  for (var interval = 0; interval < this.movingAverageIntervals; interval++) {
    this.lastOctets[interval] = 0;
  }

  this.loopCounter = 0;
  this.throughputInMbps = 0;
  this.lastUpdate = 0;
  this.highWatermark = 0;
  this.iftttUpdateDelay = 0;

  this.session = new snmp.Session({ host: this.snmpIpAddress, community: this.snmpCommunity });

  this.SendNotificationToIFTTT = function()
  {
    this.log('SendNotificattionToIFTTT ' + Number(this.throughputInMbps).toFixed(1) + ' Mbps');

    var IFTTTMaker = require('iftttmaker')(this.iftttApiKey);

    var request = {
      event: this.iftttEvent,
      values: {
        value1: this.accessoryLabel,
        value2: this.name,
        value3: this.throughputInMbps.toFixed(1),
      }
    }

    IFTTTMaker.send(request, function (error) {
      if (error) {
        this.log('The request could not be sent:', error);
      }
    });
  }

  this.UpdateBandwidthFromSnmp = function() {
     var that = this;

     this.session.get({ oid: that.snmpOid }, function (error, varbinds) {
        if (error) {
          that.log('Fail : cant get snmpOid ' + that.snmpOid);
        } else {
           var counter = varbinds[0].value;

           // Calculated moving overage of last intervals
           var lastOctets = that.lastOctets[that.movingAverageIntervals - 1];
           var octetPerSec = (counter - lastOctets) / (that.snmpQueryIntervalInSec * that.movingAverageIntervals);

           // update counters for last intervals
           if (that.movingAverageIntervals > 1) {
             for (var interval = that.movingAverageIntervals - 1; interval > 0; interval--) {
               that.lastOctets[interval] = that.lastOctets[interval-1];
             }
           }
           that.lastOctets[0] = counter;

           // Don't make any updates until after 3rd interval so we have valid average
           that.loopCounter++;
           if (that.loopCounter > that.movingAverageIntervals) {
             that.throughputInMbps = (octetPerSec * 8) / 1000000;

             if (that.verbose) {
               that.log('loop ' + that.loopCounter + ' ' + that.name + ' Bandwidth ' + Number(that.throughputInMbps).toFixed(3) + ' Mbps' + ' high watermark ' + Number(that.highWatermark).toFixed(3));
             }

             // Keep highwater mark - future functionality
             if (that.throughputInMbps > that.highWatermark) {
               that.highWatermark = that.throughputInMbps;
             }

             // Send notification via IFFTT if threshold reached
             if (that.iftttApiKey) {
               if (that.iftttUpdateDelay == 0 &&
                   (that.throughputInMbps > that.iftttThresholdMbps)) {
                 that.SendNotificationToIFTTT();
                 that.iftttUpdateDelay  = 1;
                 setTimeout(function() {that.iftttUpdateDelay = 0; }, that.iftttMaximumNotificationIntervalInSec * 1000);
               }
             }
           }
        }
     });

     setTimeout(function() { that.UpdateBandwidthFromSnmp(); }, this.snmpQueryIntervalInSec * 1000);
  }

  this.UpdateHomebridge = function() {
    var update = Math.round(this.throughputInMbps);
    if (this.verbose) {
      this.log('loopCounter ' + this.loopCounter + ' update ' + update + ' lastUpdate ' + this.lastUpdate);
    }
    if (this.useFahrenheitConversion) {
      update = (update-32)*5/9;
    }
    if (update != this.lastUpdate) {
      this.service.setCharacteristic(this.sensor, update);
      if (this.verbose) {
        this.log('setCharacteristic ' + update);
      }
      this.lastUpdate = update;
    }

    var that = this;
    setTimeout(function() {that.UpdateHomebridge(); }, this.bridgeUpdateIntervalInSec * 1000);
  };
}


BandwidthMeterAccessory.prototype =
{
  getState: function (callback)
  {
    var update = Math.round(this.throughputInMbps);
    this.service.setCharacteristic(this.sensor, update);
    this.lastUpdate = update;
    if (this.verbose) {
      this.log('getState '  + update +  ' Mbps');
    }
    callback(null, update);
  },

  identify: function (callback)
  {
    this.log("Identify requested!");
    callback();
  },

  getServices: function ()
  {
    var informationService = new Service.AccessoryInformation();

    var pkginfo = require('pkginfo')(module);

    informationService
      .setCharacteristic(Characteristic.Manufacturer, module.exports.author.name)
      .setCharacteristic(Characteristic.Model, this.accessoryLabel)
      .setCharacteristic(Characteristic.SerialNumber, 'Version ' + module.exports.version);

    this.service = new Service.TemperatureSensor(this.name);

    this.sensor = Characteristic.CurrentTemperature;

    this.service
      .getCharacteristic(this.sensor)
      .on('get', this.getState.bind(this));

    var minValue = 0;
    if (this.useFahrenheitConversion) {
      minValue = -18;
    }
    this.service
      .getCharacteristic(this.sensor)
      .setProps({minValue: minValue});

    var maxValue = 1000;
    if (this.useFahrenheitConversion) {
      maxValue = 538;
    }
    this.service
      .getCharacteristic(this.sensor)
      .setProps({maxValue: maxValue});

    /* Polling of snmp device to get bandwidth value */
    this.UpdateBandwidthFromSnmp();

    /* Update of bandwidth value to homebridge */
    this.UpdateHomebridge();

    return [informationService, this.service];
  }
};
