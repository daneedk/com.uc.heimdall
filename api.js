'use strict';
const Homey = require('homey')

module.exports = [
    {
        description: 'Retrieve all devices with their information',
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
        description: 'Request Alarm state and Surveillance Mode',
        method: 'GET',
        path: '/state/:type',
        fn: function(args, callback) {
            if (args.params.type === 'surveillance') {
              callback(null, Homey.ManagerSettings.get('surveillanceStatus'));
            } else if (args.params.type === 'alarm' ) {
              callback(null, Homey.ManagerSettings.get('alarmStatus'));
            } else {
              callback("not a valid status request", null);
            }
        }
    }
]
