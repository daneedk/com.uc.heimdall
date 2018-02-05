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
    onCapabilityHomealarmState( newState, opts, callback ) {

        // Switch Surveillance Mode is clicked
        if ( this.getData().id == "sMode" ){
           console.log('Surveillance Mode device clicked: ' + newState);
            Homey.app.setSurveillanceMode(newState, 'Mode Switch' ,function(err){
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
        this.log('setNewState: ', newState);
        this.setCapabilityValue('homealarm_state', newState)
          .catch( this.error );
        
       console.log('Surveillance Mode flow activated: ' + newState);
        Homey.app.setSurveillanceMode(newState, 'Flowcard' ,function(err){
            if( err ) return Homey.alert( err );
        });
    }
}

module.exports = Heimdall;