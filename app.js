'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')
const _ = require('lodash');

// Flow triggers
let triggerAlarmActivated = new Homey.FlowCardTrigger('Alarm_Activated');
let triggerSurveillanceActivated = new Homey.FlowCardTrigger('Surveillance_Activated');
let triggerSurveillanceDeactivated = new Homey.FlowCardTrigger('Surveillance_Deactivated');

// Flow conditions
const conditionSurveillanceActivated = new Homey.FlowCardCondition('SurveillanceActivated');
 
// Flow actions
const actionInputLog = new Homey.FlowCardAction('Send_Info');
const actionClearLog = new Homey.FlowCardAction('Clear_Log');
const actionActivateSurveillance = new Homey.FlowCardAction('Activate_Surveillance');
const actionDeactivateSurveillance = new Homey.FlowCardAction('Deactivate_Surveillance');
const actionActivateAlarm = new Homey.FlowCardAction('Activate_Alarm');
const actionDeactivateAlarm = new Homey.FlowCardAction('Deactivate_Alarm');

var surveillance = true;
var alarm = false;
var allDevices;
var devicesMonitored = [];
var devicesDelayed = [];
var devicesLogged = [];
var sModeDevice;
var triggerDelay = 30;

class Heimdall extends Homey.App {
    // Get API control function
    getApi() {
        if (!this.api) {
        this.api = HomeyAPI.forCurrentHomey();
        }
        return this.api;
    }

    // Get all devices function
    async getDevices() {
        const api = await this.getApi();
        allDevices = await api.devices.getDevices();
        return allDevices;
    }

    // Get all devices and add them
    async enumerateDevices() {
        
        // Get the homey object
        const api = await this.getApi();
        // Subscribe to realtime events and set all devices global
        await api.devices.subscribe();
        api.devices.on('device.create', async(id) => {
            await console.log('New device found!')
            const device = await api.devices.getDevice({
                id: id
            })
            await this.addDevice(device);
        });
        api.devices.on('device.delete', async(id) => {
            await console.log('Device deleted!: ')
            // how to determine which device is deleted....
        });
        allDevices = await api.devices.getDevices();

        // Loop devices
        _.forEach(allDevices, (device) => {
            this.addDevice(device, api);
        });
        this.log('Enumerating devices done.')
    }
    
	onInit() {
        getMonitoredDevices();
        getDelayedDevices();
        getLoggedDevices();
        getTriggerDelay();
        this.enumerateDevices();
        this.log('init Heimdall')
    }

    // Add device function, only motion- and contact sensors are added
    addDevice(device, api) {
        if (device.data.id === 'sMode') {
            sModeDevice = device;
            console.log('Found Mode Switch:      ' + device.name)
            console.log('Variabele:              ' + sModeDevice.name)
        }
        else if (device.class === 'sensor' && 'alarm_motion' in device.capabilities) {
            console.log('Found motion sensor:    ' + device.name)
            attachEventListener(device,'motion')
        } 
        else if (device.class === 'sensor' && 'alarm_contact' in device.capabilities) {
            console.log('Found contact sensor:   ' + device.name)
            attachEventListener(device,'contact')
            }
        else {
            //console.log('No matching class found for: ' + ' - ' + device.name)
        }
    }

    setSurveillanceMode(value, source) {
        //console.log('setSurveilanceMode: ' + value);
        let nu = getDateTime();
        let logNew;
        Homey.ManagerSettings.set('surveillanceStatus', value, function( err ){
            if( err ) return Homey.alert( err );
        });
        if (value) {
            logNew = nu + value + " || " + source + " || Surveillance mode is activated.";
            triggerSurveillanceActivated.trigger( function(err, result){
                if( err ) {
                    return Homey.error(err)} ;
                } );
        }
        else {
            logNew = nu + value + " || " + source + " || Surveillance mode is deactivated.";
            triggerSurveillanceDeactivated.trigger( function(err, result){
                if( err ) {
                    return Homey.error(err)} ;
                } );
        }
        console.log('Logging: ' + logNew);
        const logOld = Homey.ManagerSettings.get('myLog');
        if (logOld != undefined) { 
            logNew = logNew+"\n" + logOld;
        }
        Homey.ManagerSettings.set('myLog', logNew );
    }
}
module.exports = Heimdall;

surveillance = Homey.ManagerSettings.get('surveillanceStatus'); 
console.log('surveillance: ' + surveillance);
if ( surveillance == null ) {
    surveillance = true
}

// Flow triggers functions
triggerAlarmActivated
    .register()
    .on('run', ( args, state, callback ) => {
        console.log(args)
        if ( true ) {
            callback( null, true );
        }   
        else {
            callback( null, false );
        } 
    });

triggerSurveillanceActivated
    .register()
    .on('run', ( args, state, callback ) => {
        console.log(args)
        if ( true ) {
            callback( null, true );
        }   
        else {
            callback( null, false );
        } 
    });

triggerSurveillanceDeactivated
    .register()
    .on('run', ( args, state, callback ) => {
        console.log(args)
        if ( true ) {
            callback( null, true );
        }   
        else {
            callback( null, false );
        } 
    });

//Flow condition functions
conditionSurveillanceActivated
    .register()
    .on('run', ( args, state, callback ) => {
        if (Homey.ManagerSettings.get('surveillanceStatus')) {
            callback( null, true )
        }
        else {
            callback( null, false )
        }
    });

//Flow actions functions
actionInputLog.register().on('run', ( args, state, callback ) => {
    let nu = getDateTime();
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    let logNew = nu + surveillance + " || Flowcard || " + args.log;
    console.log('Logging: ' + logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    callback( null, true );
});

actionClearLog.register().on('run', ( args, state, callback ) => {
    Homey.ManagerSettings.set('myLog', '' );
    console.log (' Action.Clear_log: The log data is cleared.');
    callback( null, true );
}); 

actionActivateSurveillance.register().on('run', ( args, state, callback ) => {
    let nu = getDateTime();
    let surveillance = true;
    Homey.ManagerSettings.set('surveillanceStatus', surveillance, function( err ){
        if( err ) return Homey.alert( err );
    });
    if ( sModeDevice ) {
        sModeDevice.setCapabilityValue('onoff', surveillance) 
            .catch(this.error);
    }
    let logNew = nu + surveillance + " || Flowcard || Surveillance mode is activated.";
    console.log('Logging: ' + logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    callback( null,true ); 
});

actionDeactivateSurveillance.register().on('run', ( args, state, callback ) => {
    let nu = getDateTime();
    let surveillance = false;
    Homey.ManagerSettings.set('surveillanceStatus', surveillance, function( err ){
        if( err ) return Homey.alert( err );
    });
    if ( sModeDevice ) {
        sModeDevice.setCapabilityValue('onoff', surveillance) 
            .catch(this.error);
    }
    let logNew = nu + surveillance + " || Flowcard || Surveillance mode is deactivated.";
    console.log('Logging: ' + logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    callback( null,true );
});

actionActivateAlarm.register().on('run', ( args, state, callback ) => {
    let nu = getDateTime();
    let Alarm = true;
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    Homey.ManagerSettings.set('alarmStatus', Alarm, function( err ){
        if( err ) return Homey.alert( err );
    });
    let logNew = nu + surveillance + " || Flowcard || Alarm is activated.";
    console.log('Logging: ' + logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    callback( null,true ); 
});

actionDeactivateAlarm.register().on('run', ( args, state, callback ) => {
    let nu = getDateTime();
    let Alarm = false;
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    Homey.ManagerSettings.set('alarmStatus', Alarm, function( err ){
        if( err ) return Homey.alert( err );
    });
    let logNew = nu + surveillance + " || Flowcard || Alarm is deactivated.";
    console.log('Logging: ' + logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    callback( null,true );
});

// Get devices that should be monitored function
function getMonitoredDevices() {
    devicesMonitored = Homey.ManagerSettings.get('monitoredDevices')
    //console.log('getMonitoredDevices: ' + devicesMonitored);
}

// Get devices that have a delayed trigger function
function getDelayedDevices() {
    devicesDelayed = Homey.ManagerSettings.get('delayedDevices')
    //console.log('getDelayedDevices: ' + devicesDelayed);
}

// Get devices that should be logged function
function getLoggedDevices() {
    devicesLogged = Homey.ManagerSettings.get('loggedDevices')
    //console.log('getLoggedDevices: ' + devicesLogged);
}

// Get the duration of the trigger delay
function getTriggerDelay() {
    let newTriggerDelay = Homey.ManagerSettings.get('triggerDelay')
    if ( newTriggerDelay != null ) {
        triggerDelay = newTriggerDelay
    }
    return triggerDelay;
}

// Should this device be monitored
function isMonitored(obj) {
    getMonitoredDevices();
    var i;
    if ( devicesMonitored !== null ) {
        for (i = 0; i < devicesMonitored.length; i++) {
            if (devicesMonitored[i] && devicesMonitored[i].id == obj.id) {
                return true;
            }
        }
    }
    return false;
}

// Should this device be logged
function isLogged(obj) {
    getLoggedDevices();
    var i;
    if ( devicesLogged !== null ) {
        for (i = 0; i < devicesLogged.length; i++) {
            if (devicesLogged[i] && devicesLogged[i].id == obj.id) {
                return true;
            }
        }
    }
    return false;
}

// Should this trigger be delayed
function isDelayed(obj) {
    getDelayedDevices();
    var i;
    if ( devicesDelayed !== null) {
        for (i = 0; i < devicesDelayed.length; i++) {
            if (devicesDelayed[i] && devicesDelayed[i].id == obj.id) {
                return true;
            }
        }
    }
    return false;
}

// this function attaches en eventlistener to a device
function attachEventListener(device,sensorType) {
    device.on('$state', _.debounce(state => { 
        stateChange(device,state,sensorType)
    }));
    console.log('Attached Eventlistener: ' + device.name)
    if ( isMonitored(device) ) {
        console.log('Monitored device:       ' + device.name)
    } 
    else if ( isLogged(device) ) {
        console.log('Logged device:          ' + device.name)
    }
}

// this function gets called when a device with an attached eventlistener fires an event.
function stateChange(device,state,sensorType) {
    let nu = getDateTime();
    //console.log('stateChange: ' + device.name)
    //console.log('isMonitored: ' + isMonitored(device))
    //console.log('isLogged:    ' + isLogged(device))
    if ( isMonitored(device) || isLogged(device) ) {
        let sensorState;
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        // get sensortype to set correct sensorState
        if (sensorType == 'motion') {
            sensorState = state.alarm_motion
        } else if (sensorType == 'contact') {
            sensorState = state.alarm_contact
        };
        // set logline for the statechange
        let logNew = nu + surveillance + " || Heimdall || " + device.name + " " + sensorType + ": " + sensorState;
        // if surveillance state is activate and sensorstate is true and the device is monitored:
        //     - set other logline, check for delay
        //     - trigger alarm en send info to function
        if (surveillance == true && sensorState == true && isMonitored(device) == true) {
            console.log('Alarm is triggered')
            alarm=true;
            triggerDelay = getTriggerDelay();
            console.log('delay: ' + triggerDelay)
            logNew = nu + surveillance + " || Heimdall || " + device.name + " " + sensorType + ": " + sensorState + ' triggered Alarm.';

            if ( isDelayed(device) ) {
                logNew = nu + surveillance + " || Heimdall || Alarmtrigger is delayed: " + triggerDelay + ' seconds.' + '\n' +logNew
                let delay = triggerDelay * 1000;
                console.log('Trigger is delayed')
                setTimeout(function(){
                    triggerAlarm(device,state,sensorState)
                }, delay);
            }
            else {
                console.log('Trigger is not delayed')
                triggerAlarm(device,state,sensorState);
            }

        }
        console.log(logNew);
        const logOld = Homey.ManagerSettings.get('myLog');
        if (logOld != undefined) { 
            logNew = logNew+"\n"+logOld;
        }
        Homey.ManagerSettings.set('myLog', logNew );
    }
}

function triggerAlarm(device,state,sensorState) {
    let nu = getDateTime();
    let logNew;
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    if ( surveillance ) {
        // Surveillance mode is active
        logNew = nu + surveillance + " || Heimdall || Alarm is activated: " + device.name + ": " + sensorState;
        var tokens= {'Reason': device.name + ': '+ sensorState };
        triggerAlarmActivated.trigger(tokens, state, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            });        
    }
    else {
        // Surveillance mode is not active
        logNew = nu + surveillance + " || Heimdall || Alarm is not activated."
        alarm=false;
        Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
            if( err ) return Homey.alert( err );
        });
    }  
    // save alarm status
    Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
        if( err ) return Homey.alert( err );
    });
    // write information to log
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n"+logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    // Add code to check if AlarmOff device exists en switch accordingly


    
}

function getDateTime() {
    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var msec = ("00" + date.getMilliseconds()).slice(-3)

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return day + "-" + month + "-" + year + "  ||  " + hour + ":" + min + ":" + sec + "." + msec + "  ||  ";
}


