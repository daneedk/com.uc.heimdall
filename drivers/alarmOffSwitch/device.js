'use strict';

const Homey = require('homey');

class Heimdall extends Homey.Device {

    // this method is called when the Device is inited
    async onInit() {
        // this.log('device init');
        // this.log('name:', this.getName());
        // this.log('class:', this.getClass());
        // this.log('data:', this.getData());

        // register a capability listener
        this.registerCapabilityListener('button', this.onCapabilityBoolean.bind(this))
        this.setCapabilityValue('alarm_heimdall', false)
        if (this.hasCapability('alarm_generic') === false) {await this.addCapability('alarm_generic')}
        this.setCapabilityValue('alarm_generic', false)
    }

    // this method is called when the Device is added
    onAdded() {
        // this.log('device added');
    }

    // this method is called when the Device is deleted
    onDeleted() {
        // this.log('device deleted');
        let id = this.getData().id;
        Homey.app.removeDevice(id);
    }

    // this method is called when the Device has requested a state change (turned on or off)
    onCapabilityBoolean( value, opts, callback ) {
        // Alarm Off Button is clicked
        if ( this.getData().id == "aMode" ){
            // this.log('Alarm button clicked:      ' + value);
            Homey.app.deactivateAlarm(false, Homey.__("devices.alarmoff.name") ,function(err){
                if( err ) return Homey.alert( err );
            });
        }
        return Promise.resolve( true );
    }

}

module.exports = Heimdall;