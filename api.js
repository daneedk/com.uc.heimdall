'use strict';
const Homey = require('homey')

module.exports = [
    {
        description: 'Retrieve all devices with their information',
        method: 'GET',
        path: '/devices',
        fn: function(args, callback) {
            Homey.app.getDevices()
                .then(res => {callback(null, res);})
                .catch(error => callback(error, null));
        }
    },
    {
        description: 'Retrieve all zones with their information',
        method: 'GET',
        path: '/zones',
        fn: function(args, callback) {
            Homey.app.getZones()
                .then(res => {callback(null, res);})
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
    },
    {
        description: 'Retrieve users after entering a valid PIN',
        method: 'GET',
        path: '/users/:pin',
        fn: function(args, callback) {
            Homey.app.getUsers(args.params.pin)
                .then(res => callback(null, res) )
                .catch(error => callback(error, null));
        }
    },
    {
        description: 'Return user',
        method: 'post',
        path: '/users/:action',
        fn: function(args, callback) {
            Homey.app.processUsers(args, args.params.action)
                .then(res => callback(null, res) )
                .catch(error => callback(error, null));
        }
    },
    {
        description: 'Receive information from external keypad',
        method: 'post',
        path: '/keypad/:type',
        fn: function(args, callback) {
            Homey.app.processKeypadCommands(args, args.params.type)
                .then(res => callback(null, res) )
                .catch(error => callback(error, null));
        }
    }
]