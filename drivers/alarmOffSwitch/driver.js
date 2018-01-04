'use strict';

const Homey = require('homey');

class Heimdall extends Homey.Driver {

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

}

module.exports = Heimdall;