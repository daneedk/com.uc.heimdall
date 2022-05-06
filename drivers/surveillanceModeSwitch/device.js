'use strict';

const Homey = require('homey');

class Heimdall extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        // this.log('device init');
        // this.log('name:', this.getName());
        // this.log('class:', this.getClass());
        // this.log('data:', this.getData());

        // register a capability listener
        this.registerCapabilityListener('homealarm_state', this.onCapabilityHomealarmState.bind(this))
        this.registerCapabilityListener('button', this.onCapabilityBoolean.bind(this))
        this.setCapabilityValue('alarm_heimdall', false)
        if (this.hasCapability('alarm_generic') === false) {this.addCapability('alarm_generic')}
        this.setCapabilityValue('alarm_generic', false)
    }

    // this method is called when the Device is added
    onAdded() {
        // this.log('device added');
    }

    // this method is called when the Device is deleted
    onDeleted() {
        // this.log('device deleted');
    }

    // this method is called when the Device has requested a state change (turned on or off)
    onCapabilityHomealarmState( newState, opts ) {
        // Switch Surveillance Mode is clicked
        if ( this.getData().id == "sMode" ){
            this.log('Surveillance Mode Switch clicked: ' + newState);
            Homey.app.setSurveillanceMode(newState, Homey.__("devices.surveillancemode.name") ,function(err){
                if( err ) return Homey.alert( err );
            });
        }
        return Promise.resolve( true );
    }

    // this method is called from the driver by an action flowcard
    setNewState(newState) {
        // this.log('setNewState: ', newState);
        this.setCapabilityValue('homealarm_state', newState)
          .catch( this.error );
        this.log('Surveillance Mode Flow Card activated: ' + newState);
        Homey.app.setSurveillanceMode(newState, Homey.__("devices.flowcard") ,function(err){
            if( err ) return Homey.alert( err );
        });
    }

    // this method is called when the Device has requested a state change (turned on or off)
    onCapabilityBoolean( value, opts, callback ) {
        // Surveillance Mode Switch is clicked
        if ( this.getData().id == "sMode" ){
            this.log('Surveillance Mode Button clicked: ' + value);
            Homey.app.deactivateAlarm(false, Homey.__("devices.surveillancemode.name") ,function(err){
                if( err ) return Homey.alert( err );
            });
        }
        return Promise.resolve( true );
    }

}

module.exports = Heimdall;