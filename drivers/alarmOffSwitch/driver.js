'use strict';

const Homey = require('homey');

class Heimdall extends Homey.Driver {

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