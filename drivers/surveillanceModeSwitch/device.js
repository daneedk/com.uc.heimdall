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
    onCapabilityHomealarmState( newState, opts, callback ) {
        // Switch Surveillance Mode is clicked
        if ( this.getData().id == "sMode" ){
            // this.log('Surveillance Mode device clicked: ' + newState);
            // Homey.app.setSurveillanceMode(newState, 'Surveillance Mode Switch' ,function(err){
            Homey.app.setSurveillanceMode(newState, Homey.__("devices.surveillancemode.name") ,function(err){
                if( err ) return Homey.alert( err );
            });
        }
        // Then, emit a callback ( err, result )
        callback( null );
        // or, return a Promise
        return Promise.reject( new Error('Switching the device failed!') );
    }

    // this method is called from the driver by an action flowcard
    setNewState(newState) {
        // this.log('setNewState: ', newState);
        this.setCapabilityValue('homealarm_state', newState)
          .catch( this.error );
        // this.log('Surveillance Mode flow activated: ' + newState);
        Homey.app.setSurveillanceMode(newState, Homey.__("devices.flowcard") ,function(err){
            if( err ) return Homey.alert( err );
        });
    }

    // this method is called when the Device has requested a state change (turned on or off)
    onCapabilityBoolean( value, opts, callback ) {
        // Surveillance Mode Switch is clicked
        if ( this.getData().id == "sMode" ){
            //this.log('Surveillance Mode clicked: ' + value);
            Homey.app.deactivateAlarm(false, Homey.__("devices.surveillancemode.name") ,function(err){
                if( err ) return Homey.alert( err );
            });
        }
        // Then, emit a callback ( err, result )
        callback( null );
        // or, return a Promise
        return Promise.reject( new Error('Switching the device failed!') );
    }

}

module.exports = Heimdall;