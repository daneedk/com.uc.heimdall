'use strict';

const Homey = require('homey');

class Heimdall extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        this.log('device init');
        this.log('name:', this.getName());
        this.log('class:', this.getClass());
        this.log('data:', this.getData());

        // register a capability listener
        this.registerCapabilityListener('homealarm_state', this.onCapabilityHomealarmState.bind(this))
    }

    // this method is called when the Device is added
    onAdded() {
        this.log('device added');
    }

    // this method is called when the Device is deleted
    onDeleted() {
        this.log('device deleted');
    }

    // this method is called when the Device has requested a state change (turned on or off)
    onCapabilityHomealarmState( value, opts, callback ) {

        // Switch Surveillance Mode is clicked
        if ( this.getData().id == "sMode" ){
            //console.log('Surveillance Mode device clicked: ' + value);
            Homey.app.setSurveillanceMode(value, 'Mode Switch' ,function(err){
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