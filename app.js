'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')
const _ = require('lodash');

// Flow triggers
let triggerSurveillanceChanged = new Homey.FlowCardTrigger('SurveillanceChanged');
let triggerAlarmActivated = new Homey.FlowCardTrigger('AlarmActivated');
let triggerDelayActivated = new Homey.FlowCardTrigger('DelayActivated');
let triggerTimeTillAlarmChanged = new Homey.FlowCardTrigger('TimeTillAlarm');
let triggerTimeTillArmedChanged = new Homey.FlowCardTrigger('TimeTillArmed');

// Flow conditions
const conditionSurveillanceIs = new Homey.FlowCardCondition('SurveillanceIs');

// Flow actions
const actionInputHistory = new Homey.FlowCardAction('SendInfo');
const actionClearHistory = new Homey.FlowCardAction('ClearHistory');
const actionActivateAlarm = new Homey.FlowCardAction('ActivateAlarm');
const actionDeactivateAlarm = new Homey.FlowCardAction('DeactivateAlarm');

var surveillance;
var alarm = false;
var allDevices;
var devicesMonitored = [];
var devicesMonitoredFull = [];
var devicesMonitoredPartial = [];
var devicesDelayed = [];
var logArmedOnly = false;
var logTrueOnly = false;
var delayArming = false;
var devicesLogged = [];
var sModeDevice;
var aModeDevice;
var triggerDelay = 30;
var armCounter = false;

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
        getMonitoredDevices();          // opruimen
        getMonitoredFullDevices();
        getMonitoredPartialDevices();
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
        if (device.data.id === 'aMode') {
            aModeDevice = device;
            console.log('Found Alarm Button      ' + device.name)
            console.log('Variabele:              ' + aModeDevice.name)
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
        console.log('setSurveillanceMode:    ' + value);
        let nu = getDateTime();
        let logNew;
        let logLine
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        
        if ( value == 'disarmed' ) {
            logNew = value + " || " + source + " || Surveillance mode is disarmed.";
            setSurveillanceValue(value, logNew)
            if ( armCounter ) {
                // code to cancel an arm command during delayArming
                console.log('Need to stop arming!')
                armCounter = false;
            }   
        } else {
            if ( value == 'armed' ) {
                logLine = value + " || " + source + " || Surveillance mode is armed.";
            } else { 
                logLine = value + " || " + source + " || Surveillance mode is partially armed.";
            }
            if ( getDelayArming() ) {
                triggerDelay = getTriggerDelay();
                console.log('Arming is delayed:      Yes, ' + triggerDelay + ' seconden')
                let delay = triggerDelay * 1000;
                console.log('setSurveillanceValue in:' + triggerDelay + ' seconds.')
                setTimeout(function(){
                    setSurveillanceValue(value, logLine)
                }, delay);
                armCounter = true;
                let tta = triggerDelay - 1;
                ttArmedCountdown(tta);

                if ( value == 'armed' ) {
                    logNew = nu + surveillance + " || " + source + " || Surveillance mode will be armed in " + triggerDelay + " seconds.";
                } else { 
                    logNew = nu + surveillance + " || " + source + " || Surveillance mode will be partially armed in " + triggerDelay + " seconds.";
                }
                console.log(logNew);
                const logOld = Homey.ManagerSettings.get('myLog');
                if (logOld != undefined) { 
                    logNew = logNew+"\n" + logOld;
                }
                Homey.ManagerSettings.set('myLog', logNew );
            } else {
                console.log('setSurveillanceValue now')
                armCounter = true;
                setSurveillanceValue(value, logLine)
            }
        }
    }

    deactivateAlarm(value, source) {
        if ( alarm === true ) {
            let nu = getDateTime();
            alarm = false
            surveillance = Homey.ManagerSettings.get('surveillanceStatus');
            Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
                if( err ) return Homey.alert( err );
            });
            // Check if Alarm Off Button exists and turn off
            if( aModeDevice != undefined) {
                aModeDevice.setCapabilityValue('alarm_heimdall', false)
            }
            let logNew = nu + surveillance + " || " + source + " || Alarm is deactivated.";
            console.log(logNew);
            const logOld = Homey.ManagerSettings.get('myLog');
            if (logOld != undefined) { 
                logNew = logNew+"\n" + logOld;
            }
            Homey.ManagerSettings.set('myLog', logNew );
        }
    }
}
module.exports = Heimdall;

surveillance = Homey.ManagerSettings.get('surveillanceStatus'); 
console.log('surveillance: ' + surveillance);
if ( surveillance == null ) {
    surveillance = true
}

// Flow triggers functions
triggerSurveillanceChanged
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

triggerDelayActivated
    .register()
    .on('run', ( args, callback ) => {
        console.log(args)
        if ( true ) {
            callback( null, true );
        }   
        else {
            callback( null, false );
        } 
    });

triggerTimeTillAlarmChanged
    .register()
    .on('run', ( args, callback ) => {
        console.log(args)
        if ( true ) {
            callback( null, true );
        }   
        else {
            callback( null, false );
        } 
    });

triggerTimeTillArmedChanged
    .register()
    .on('run', ( args, callback ) => {
        console.log(args)
        if ( true ) {
            callback( null, true );
        }   
        else {
            callback( null, false );
        } 
    });    

//Flow condition functions
conditionSurveillanceIs
    .register()
    .on('run', ( args, state, callback ) => {
        if (args.surveillance == Homey.ManagerSettings.get('surveillanceStatus')) {
            callback( null, true )
        }
        else {
            callback( null, false )
        }
    });

//Flow actions functions

actionInputHistory.register().on('run', ( args, state, callback ) => {
    let nu = getDateTime();
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    let logNew = nu + surveillance + " || Flowcard || " + args.log;
    console.log(logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    callback( null, true );
});

actionClearHistory.register().on('run', ( args, state, callback ) => {
    Homey.ManagerSettings.set('myLog', '' );
    console.log ('actionClearHistory: The history data is cleared.');
    callback( null, true );
}); 

actionActivateAlarm.register().on('run', ( args, state, callback ) => {
    let nu = getDateTime();
    let Alarm = true;
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    Homey.ManagerSettings.set('alarmStatus', Alarm, function( err ){
        if( err ) return Homey.alert( err );
    });
    let logNew = nu + surveillance + " || Flowcard || Alarm is activated.";
    console.log(logNew);
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
    console.log(logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    callback( null,true );
});

function setSurveillanceValue(value, logLine) {
    let nu = getDateTime();
    let logNew;
    logLine = nu + logLine;
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    if ( armCounter || value === 'disarmed') {
        Homey.ManagerSettings.set('surveillanceStatus', value, function( err ){
            if( err ) return Homey.alert( err );
        });
        console.log('setSurveillanceValue:   '+ value)
        var tokens = { 'mode': value };
        triggerSurveillanceChanged.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            } );
        
    } else {
        logLine = nu + surveillance + " || Heimdall || Changing Surveillance Mode is disabled due to disarming." 
    }   
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logLine+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    armCounter = false;
}

// Get devices that should be monitored function
function getMonitoredDevices() {
    devicesMonitored = Homey.ManagerSettings.get('monitoredDevices')
    //console.log('getMonitoredDevices: ' + devicesMonitored);
}

// Get devices that should be monitored full function
function getMonitoredFullDevices() {
    devicesMonitoredFull = Homey.ManagerSettings.get('monitoredFullDevices')
    //console.log('getMonitoredFullDevices: ' + devicesMonitoredFull);
}

// Get devices that should be monitored partial function
function getMonitoredPartialDevices() {
    devicesMonitoredPartial = Homey.ManagerSettings.get('monitoredPartialDevices')
    //console.log('getMonitoredPartialDevices: ' + devicesMonitoredPartial);
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

function getLogArmedOnly() {
    let newLogArmedOnly = Homey.ManagerSettings.get('logArmedOnly')
    if ( newLogArmedOnly != null ) {
        logArmedOnly = newLogArmedOnly
    }
    return logArmedOnly;
}

function getLogTrueOnly() {
    let newLogTrueOnly = Homey.ManagerSettings.get('logTrueOnly')
    if ( newLogTrueOnly != null ) {
        logTrueOnly = newLogTrueOnly
    }
    return logTrueOnly;
}

function getDelayArming() {
    let newDelayArming = Homey.ManagerSettings.get('delayArming')
    if ( newDelayArming != null ) {
        delayArming = newDelayArming
    }
    return delayArming;
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

// Should this device be monitored
function isMonitoredFull(obj) {
    getMonitoredFullDevices();
    var i;
    if ( devicesMonitoredFull !== null ) {
        for (i = 0; i < devicesMonitoredFull.length; i++) {
            if (devicesMonitoredFull[i] && devicesMonitoredFull[i].id == obj.id) {
                return true;
            }
        }
    }
    return false;
}

// Should this device be monitored
function isMonitoredPartial(obj) {
    getMonitoredPartialDevices();
    var i;
    if ( devicesMonitoredPartial !== null ) {
        for (i = 0; i < devicesMonitoredPartial.length; i++) {
            if (devicesMonitoredPartial[i] && devicesMonitoredPartial[i].id == obj.id) {
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
    let sourceDeviceFull = false;
    let sourceDevicePartial = false;
    let sourceDeviceLog = false;
    if ( isMonitoredFull(device) ) {
        sourceDeviceFull = true;    
    } 
    if ( isMonitoredPartial(device) ) {
        sourceDevicePartial = true;
    }
    if ( isLogged(device) ) {
        sourceDeviceLog = true;
    }
    console.log('stateChange:            ' + device.name)
    console.log('sourceDeviceFull:       ' + sourceDeviceFull)
    console.log('sourceDevicePartial:    ' + sourceDevicePartial)
    console.log('sourceDeviceLog:        ' + sourceDeviceLog)
    if ( sourceDeviceFull || sourceDevicePartial || sourceDeviceLog ) {
        console.log('Log/Full/Partial:       Yes')
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
        if(sensorState) {
            if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                alarm=true;
                triggerDelay = getTriggerDelay();
                console.log('Alarm is triggered:     Yes')
                logNew = nu + surveillance + " || Heimdall || " + device.name + " " + sensorType + ": " + sensorState + ' triggered Alarm.';

                if ( isDelayed(device) ) {
                    logNew = nu + surveillance + " || Heimdall || Alarmtrigger is delayed: " + triggerDelay + ' seconds.' + '\n' +logNew
                    let delay = triggerDelay * 1000;
                    // Trigger delay flow card
                    var tokens= { 'Reason': device.name + ': '+ sensorState , 'Duration': triggerDelay * 1 };
                    triggerDelayActivated.trigger(tokens, function(err, result){
                        if( err ) {
                            return Homey.error(err)} ;
                        });  
                    console.log('Trigger is delayed:     Yes, ' + triggerDelay + ' seconden')
                    setTimeout(function(){
                        triggerAlarm(device,state,sensorState)
                    }, delay);
                    // Trigger Time Till Alarm flow card
                    let tta = triggerDelay - 1;
                    ttAlarmCountdown(tta);
                }
                else {
                    console.log('Trigger is delayed:     No')
                    triggerAlarm(device,state,sensorState);
                }
            }
            else {
                console.log('Alarm is triggered:     No')
            }
        }
        let shouldLog = true;
        logArmedOnly = getLogArmedOnly();
        logTrueOnly = getLogTrueOnly();
        console.log('logArmedOnly:           ' + logArmedOnly + ', Surveillance Mode: ' + surveillance)
        console.log('logTrueOnly:            ' + logTrueOnly + ', Sensorstate: ' + sensorState)
        if ( logArmedOnly && surveillance === 'disarmed')  {
            shouldLog = false;
            console.log('LogArmed is true and Surveillance is off, so no log line')
        }
        if ( logTrueOnly && !sensorState ) {
            shouldLog = false;
            console.log('logTrue is true and sensorstate is false, so no log line')
        }
        if ( shouldLog ) {
            console.log(logNew);
        
            const logOld = Homey.ManagerSettings.get('myLog');
            if (logOld != undefined) { 
                logNew = logNew+"\n"+logOld;
            }
            Homey.ManagerSettings.set('myLog', logNew );
        }
    }
}

function triggerAlarm(device,state,sensorState) {
    let nu = getDateTime();
    let logNew;
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    if ( surveillance != 'disarmed' ) {
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
    console.log(logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n"+logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );

    // Check if Alarm Off Button exists and turn on 
    if( aModeDevice != undefined) {
        aModeDevice.setCapabilityValue('alarm_heimdall', true)
    }
}

function ttAlarmCountdown(delay) {
    console.log(' ttAlarmCountdown:      ' + delay)
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    if ( surveillance != 'disarmed' ) {
        var tokens = { 'AlarmTimer': delay * 1};
        triggerTimeTillAlarmChanged.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            });
        if ( delay > 0 ) {
            setTimeout(function(){
                ttAlarmCountdown(delay-1)
            }, 1000);
        }
    }
    else {
        console.log(' ttAlarmCountdown: canceled due to disarm')
    }
}

function ttArmedCountdown(delay) {
    console.log(' ttArmedCountdown:      ' + delay)
    if ( armCounter ) {
        var tokens = { 'ArmedTimer': delay * 1};
        triggerTimeTillArmedChanged.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            });
        if ( delay > 0 ) {
            setTimeout(function(){
                ttArmedCountdown(delay-1)
            }, 1000);
        }
    }
    else {
        console.log(' ttArmedCountdown:      armCounter = false')
    }
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


