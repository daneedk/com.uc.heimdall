'use strict';

const Homey = require('homey');

class Heimdall extends Homey.Driver {

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