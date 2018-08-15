'use strict';
const Homey = require('homey')

module.exports = [
    {
        method: 'GET',
        path: '/devices',
        fn: function(args, callback) {
            Homey.app.getDevices().then(res => {
                callback(null, res);
            })
                .catch(error => callback(error, null));
        }
    },
    {
        description: 'Request alarm state and surveillance mode status',
        method: 'GET',
        path: '/status/:type',
        fn: function(args, callback) {
            if (args.params.type === 'surveillance') {
              callback(null, Homey.ManagerSettings.get('surveillanceStatus'));
            } else if (args.params.type === 'alarm' ) {
              callback(null, Homey.ManagerSettings.get('alarmStatus'));
            } else {
              callback("not a valid status request", null);
            }
        }
    },
]
