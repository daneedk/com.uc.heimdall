// 'use strict';
// const Homey = require('homey')

module.exports =  {    
        async getDevices({ homey, query }){
            const result = await homey.app.getDevices();
            
            return result;
        },
    
        async getZones({ homey, query }) {
            const result = await homey.app.getZones();

            return result;
        },
    
        async getStatus({ homey, params, query }) {
            if (params.type === 'surveillance') {
                const result = this.homey.settings.get('surveillanceStatus');
                
                return result;
            } else if (params.type === 'alarm' ) {
                const result = this.homey.settings.get('alarmStatus');

                return result
            } else {
                return "not a valid status request";
            }
        },
        
        async getUsers({ homey, params, query }) {
            const result = await homey.app.getUsers(params.pin)

            return result
        },
    
        async processUsers({ homey, params, body }) {
            return homey.app.processUsers(body, params.action);
        },
    
        async processKeypadCommands({ homey, params, body }) {
            return homey.app.processKeypadCommands(body, params.type)
        }

    }
