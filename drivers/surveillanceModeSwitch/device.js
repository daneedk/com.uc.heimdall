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
        this.registerCapabilityListener('homealarm_state', this.onCapabilityHomealarmState.bind(this))
        this.registerCapabilityListener('button', this.onCapabilityBoolean.bind(this))
        //this.registerCapabilityListener('alarm_generic', value => this.setAlarmGeneric(value))
        this.registerCapabilityListener('alarm_heimdall', value => this.setAlarmHeimdall(value))
        
        if (this.hasCapability('alarm_heimdall') === false) {await this.addCapability('alarm_heimdall')}
        this.setCapabilityValue('alarm_heimdall', false)
        if (this.hasCapability('alarm_generic') === true) {await this.removeCapability('alarm_generic')}
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
    onCapabilityHomealarmState( newState, opts ) {
        // Switch Surveillance Mode is clicked
        if ( this.getData().id == "sMode" ){
            this.log('Surveillance Mode Switch clicked: ' + newState);
            this.homey.app.setSurveillanceMode(newState, this.homey.__("devices.surveillancemode.name"));
        }
        return Promise.resolve( true );
    }

    // this method is called from the driver by an action flowcard
    setNewState(newState) {
        // this.log('setNewState: ', newState);
        this.setCapabilityValue('homealarm_state', newState)
          .catch( this.error );
        this.log('Surveillance Mode Flow Card activated: ' + newState);
        this.homey.app.setSurveillanceMode(newState, this.homey.__("devices.flowcard"))
    }

    // this method is called when the Device has requested a state change (turned on or off)
    onCapabilityBoolean( value, opts, callback ) {
        // Surveillance Mode Switch is clicked
        if ( this.getData().id == "sMode" ){
            this.log('Surveillance Mode Button clicked: ' + value);
            this.homey.app.deactivateAlarm(false, this.homey.__("devices.surveillancemode.name"));
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