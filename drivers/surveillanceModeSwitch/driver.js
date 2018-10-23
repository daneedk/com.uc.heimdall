'use strict';

const Homey = require('homey');

class Heimdall extends Homey.Driver {

    onInit() {

        new Homey.FlowCardAction('SetSurveillance')
          .register()
          .registerRunListener(( args, state ) => {
            let device = args.device;
            let newState = args.surveillance;
            // this.log('Actioncard: ' + device.getName() + ' :: ' + newState ) 
    
            device.setNewState(newState);

            return Promise.resolve( true );
          })

    }

    onPairListDevices( data, callback ){

        callback( null, [
            {
                name: 'Surveillance',
                data: {
                    id: 'sMode'
                }
            }
        ]);

    }
}

module.exports = Heimdall;