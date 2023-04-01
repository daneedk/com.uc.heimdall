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
        //this.registerCapabilityListener('alarm_generic', value => this.setAlarmGeneric(value))
        this.registerCapabilityListener('alarm_heimdall', value => this.setAlarmHeimdall(value))
        
        this.setCapabilityValue('alarm_heimdall', false)
        if (this.hasCapability('alarm_generic') === true) {
            console.log("Remove alarm_generic from alarmOffSwitch");
            await this.removeCapability('alarm_generic')
        }
        //this.setCapabilityValue('alarm_generic', false)
    }

    // this method is called when the Device is added
    onAdded() {
        // this.log('device added');
    }

    // this method is called when the Device is deleted
    onDeleted() {
        // this.log('device deleted');
        let id = this.getData().id;
        this.homey.app.removeDevice(id);
    }

    // this method is called when the Device has requested a state change (turned on or off)
    onCapabilityBoolean( value, opts, callback ) {
        // Alarm Off Button is clicked
        if ( this.getData().id == "aMode" ){
            this.log('Alarm button clicked:      ' + value);
            this.homey.app.deactivateAlarm(false, this.homey.__("devices.alarmoff.name"));
        }
        return Promise.resolve( true );
    }

    setAlarmGeneric(value) {
        //this.setCapabilityValue('alarm_generic', value);
    }

    setAlarmHeimdall(value) {
        this.setCapabilityValue('alarm_heimdall', value);
    }
}

module.exports = Heimdall;