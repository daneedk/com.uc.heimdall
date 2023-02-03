'use strict';

const Homey = require('homey');

class Heimdall extends Homey.Driver {

    onInit() {

        const SetSurveillance = this.homey.flow.getActionCard('SetSurveillance')
        SetSurveillance
            .registerRunListener(( args, state ) => {
                let device = args.device;
                let newState = args.surveillance;
                // this.log('Actioncard: ' + device.getName() + ' :: ' + newState ) 
                device.setNewState(newState);

                return Promise.resolve( true );
            })
    }

    async onPairListDevices() {
        return (
            [
                {
                    name: 'Surveillance',
                    data: {
                        id: 'sMode'
                    }
                }
            ]   
        )
    }


}

module.exports = Heimdall;