'use strict';

const Homey = require('homey');

class Heimdall extends Homey.Driver {

    //SDKv2
    /*
    onPairListDevices( data, callback ){
        callback( null, [
            {
                name: 'Alarm',
                data: {
                    id: 'aMode'
                }
            }
        ]);
    }
    */

    //SDKv3
    async onPairListDevices() {
        return (
            [
                {
                    name: 'Alarm',
                    data: {
                        id: 'aMode'
                    }
                }
            ]   
        )
    }
    
}

module.exports = Heimdall;