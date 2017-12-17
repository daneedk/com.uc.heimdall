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
        method: 'GET',
        path: '/log',
        fn: function(args, callback) {
              callback(null, Homey.app.getLog());
    
        }
    },
    {
        method: 'PUT',
        path: '/devices/add',
        fn: function(args, callback) {

        }
    },
    {
        method: 'DELETE',
        path: '/devices/delete',
        fn: function(args, callback) {
            
        }
    }

]
