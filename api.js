module.exports =  {    
    async getDevices({ homey }){
        return homey.app.getDevices();
    },
    
    async getZones({ homey, query }) {
        return homey.app.getZones();
    },

    async getStatus({ homey, params, query }) {
        if (params.type === 'surveillance') {
            return this.homey.settings.get('surveillanceStatus');
        } else if (params.type === 'alarm' ) {
            return this.homey.settings.get('alarmStatus');
        } else {
            return "not a valid status request";
        }
    },
    
    async getUsers({ homey, params, query }) {
        return homey.app.getUsers(params.pin)
    },

    async processUsers({ homey, params, body }) {
        return homey.app.processUsers(body, params.action);
    },

    async processKeypadCommands({ homey, params, body }) {
        return homey.app.processKeypadCommands(body, params.type)
    }

}
