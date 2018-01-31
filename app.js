'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')
const _ = require('lodash');

// Flow triggers
let triggerSurveillanceChanged = new Homey.FlowCardTrigger('SurveillanceChanged');
let triggerAlarmActivated = new Homey.FlowCardTrigger('AlarmActivated');
let triggerAlarmDeactivated = new Homey.FlowCardTrigger('AlarmDeactivated');
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
//var spokenCountdown = false;
var devicesLogged = [];
var sModeDevice;
var aModeDevice;
var triggerDelay = 30;
var armCounterRunning = false;
var alarmCounterRunning = false;

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
        //getMonitoredDevices();          // opruimen
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
            //logNew = value + " || " + source + " || Surveillance mode is disarmed.";
            logNew = readableMode(value) + " || " + source + " || " + Homey.__("history.smodedisarmed")
            setSurveillanceValue("sd ",value, logNew)
            Homey.app.deactivateAlarm(false, "Surveillance Mode Switch")
            if ( armCounterRunning ) {
                // code to cancel an arm command during delayArming
                console.log('Need to stop arming!')
                armCounterRunning = false;
            }   
        } else {
            if ( value == 'armed' ) {
                //logLine = value + " || " + source + " || Surveillance mode is armed.";
                logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodearmed")
            } else { 
                //logLine = value + " || " + source + " || Surveillance mode is partially armed.";
                logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodepartiallyarmed")
            }
            if ( getDelayArming() ) {
                triggerDelay = getTriggerDelay();
                console.log('Arming is delayed:      Yes, ' + triggerDelay + ' seconds.')
                let delay = triggerDelay * 1000;
                console.log('setSurveillanceValue in:' + triggerDelay + ' seconds.')
                /* delayed steSurveillanceValue moved to ttArmedCountdown
                setTimeout(function(){
                    setSurveillanceValue("sa ",value, logLine)
                }, delay);
                */
                //speak("The Surveillance mode will be set to " + readableMode(value) + " in " + triggerDelay + " seconds.")
                speak("armCountdown", Homey.__("speech.startarmcountdown") + readableMode(value) + Homey.__("speech.in") + triggerDelay + Homey.__("speech.seconds"))

                armCounterRunning = true;
                let tta = triggerDelay;
                ttArmedCountdown(tta,"sa ", value, logLine);

                if ( value == 'armed' ) {
                    //logNew = "st " + nu + surveillance + " || " + source + " || Surveillance mode will be armed in " + triggerDelay + " seconds.";
                    //logNew = "st " + nu + surveillance + " || " + source + " || " + Homey.__("history.smodedelayarmed") + triggerDelay + Homey.__("history.seconds")
                    logNew = "st " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.smodedelayarmed") + triggerDelay + Homey.__("history.seconds")
                } else { 
                    //logNew = "st " + nu + surveillance + " || " + source + " || Surveillance mode will be partially armed in " + triggerDelay + " seconds.";
                    //logNew = "st " + nu + surveillance + " || " + source + " || " + Homey.__("history.smodedelaypartiallyarmed") + triggerDelay + Homey.__("history.seconds")
                    logNew = "st " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.smodedelaypartiallyarmed") + triggerDelay + Homey.__("history.seconds")
                }
                console.log(logNew);
                const logOld = Homey.ManagerSettings.get('myLog');
                if (logOld != undefined) { 
                    logNew = logNew+"\n" + logOld;
                }
                Homey.ManagerSettings.set('myLog', logNew );
            } else {
                console.log('setSurveillanceValue now')
                armCounterRunning = true;
                setSurveillanceValue("sa ",value, logLine)
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
            // speech

            //speak("alarmChange", "The alarm is deactivated") 
            speak("alarmChange", Homey.__("speech.alarmdeactivated"))
            
            // end speech
            // Check if Alarm Off Button exists and turn off
            if ( aModeDevice != undefined) {
                aModeDevice.setCapabilityValue('alarm_heimdall', false)
            }
            if ( sModeDevice != undefined) {
                sModeDevice.setCapabilityValue('alarm_heimdall', false)
            }
            var tokens = { 'Source': source }
            triggerAlarmDeactivated.trigger(tokens, function(err, result){
                if( err ) {
                    return Homey.error(err)} ;
                }); 
            //let logNew = "ao "+ nu + surveillance + " || " + source + " || Alarm is deactivated.";
            //let logNew = "ao "+ nu + surveillance + " || " + source + " || " + Homey.__("history.alarmdeactivated")
            let logNew = "ao "+ nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmdeactivated")
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

triggerAlarmDeactivated
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
    //let logNew = "lh " + nu + surveillance + " || Flowcard || " + args.log;
    let logNew = "lh " + nu + readableMode(surveillance) + " || Flowcard || " + args.log;
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
    //let logNew = "al " + nu + surveillance + " || Flowcard || Alarm is activated.";
    //let logNew = "al " + nu + surveillance + " || Flowcard || " + Homey.__("history.alarmactivated")
    let logNew = "al " + nu + readableMode(surveillance) + " || Flowcard || " + Homey.__("history.alarmactivated")
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
    var tokens = { 'Source': 'Flowcard' }
    triggerAlarmDeactivated.trigger(tokens, function(err, result){
        if( err ) {
            return Homey.error(err)} ;
        }); 
    let logNew = "ao " + nu + readableMode(surveillance) + " || Flowcard || " + Homey.__("history.alarmdeactivated")
    console.log(logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    callback( null,true );
});

function setSurveillanceValue(color,value, logLine) {
    let nu = getDateTime();
    let logNew;
    logLine = color + nu + logLine;
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    if ( armCounterRunning || value === 'disarmed') {
        Homey.ManagerSettings.set('surveillanceStatus', value, function( err ){
            if( err ) return Homey.alert( err );
        });
        //speak("sModeChange", "The surveillance mode is set to " + readableMode(value)) 
        speak("sModeChange", Homey.__("speech.smodeset") + readableMode(value))
        console.log('setSurveillanceValue:   '+ value)
        var tokens = { 'mode': readableMode(value) };
        triggerSurveillanceChanged.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            } );
        
    } else {
        //logLine = color + nu + surveillance + " || Heimdall || Changing Surveillance Mode is disabled due to disarming." 
        //logLine = color + nu + surveillance + " || " + Homey.__("history.smodechangedisable")
        logLine = color + nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.smodechangedisabled")
    }   
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logLine+"\n" + logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );
    armCounterRunning = false;
}

// Get devices that should be monitored function
/*
function getMonitoredDevices() {
    devicesMonitored = Homey.ManagerSettings.get('monitoredDevices')
    //console.log('getMonitoredDevices: ' + devicesMonitored);
}
*/

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

function getSpokenYN(type) {
    let SpokenYN = Homey.ManagerSettings.get(type)
    if ( SpokenYN != null ) {
        return SpokenYN
    }
    else {
        return false;
    }
}

function speak(type, text) {
    if (type == "alarmCountdown" && getSpokenYN("spokenAlarmCountdown") ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "armCountdown" && getSpokenYN("spokenArmCountdown") ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "sModeChange" && getSpokenYN("spokenSmodeChange") ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "alarmChange" && getSpokenYN("spokenAlarmChange") ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "motionTrue" && getSpokenYN("spokenMotionTrue") ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "doorOpen" && getSpokenYN("spokenDoorOpene") ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
}

// Should this device be monitored
/*
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
*/

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
    if ( isMonitoredFull(device) ) {
        console.log('Fully Monitored device: ' + device.name)
    } 
    else if ( isMonitoredPartial(device) ) {
        console.log('Partially Monitored device:' + device.name)
    }
    else if ( isLogged(device) ) {
        console.log('Logged device:          ' + device.name)
    }
    else {
        console.log('not monitored')
    }
}

// this function gets called when a device with an attached eventlistener fires an event.
function stateChange(device,state,sensorType) {
    let nu = getDateTime();
    let sourceDeviceFull = false;
    let sourceDevicePartial = false;
    let sourceDeviceLog = false;
    let color = "   ";
    if ( isMonitoredFull(device) ) {
        sourceDeviceFull = true;    
    } 
    if ( isMonitoredPartial(device) ) {
        sourceDevicePartial = true;
    }
    if ( isLogged(device) ) {
        sourceDeviceLog = true;
    }
    console.log('-----------------------------------------------')
    console.log('stateChange:            ' + device.name)
    console.log('sourceDeviceFull:       ' + sourceDeviceFull)
    console.log('sourceDevicePartial:    ' + sourceDevicePartial)
    console.log('sourceDeviceLog:        ' + sourceDeviceLog)
    if ( sourceDeviceFull || sourceDevicePartial || sourceDeviceLog ) {
        console.log('Log/Full/Partial:       Yes')
        let sensorState;
        let sensorStateReadable;
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        // get sensortype to set correct sensorState
        if (sensorType == 'motion') {
            sensorState = state.alarm_motion
            sensorStateReadable = readableState(sensorState, 'motion')
        } else if (sensorType == 'contact') {
            sensorState = state.alarm_contact
            sensorStateReadable = readableState(sensorState, 'contact')
        };
        console.log('sensorStateReadable:    ' + sensorStateReadable)
        // set logline for the statechange
        if ( surveillance == "disarmed" ) {
            color = "md-"
        } 
        else if ( surveillance == "armed" ) {
            color = "ma-"
        }
        else if ( surveillance == "partially_armed" ) {
            color = "mp-"
        }
        if ( sourceDeviceLog ) {
            color = "l- "
        }
        let logNew = color + nu + readableMode(surveillance) + " || Heimdall || " + device.name + " " + sensorType + ": " + sensorStateReadable;
        // if surveillance state is activate and sensorstate is true and the device is monitored:
        //     - set other logline, check for delay
        //     - trigger alarm en send info to function
        if ( sensorState ) {
            if ( !alarmCounterRunning ) {
                if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                    alarm=true;
                    // Moved next line due to: https://github.com/daneedk/com.uc.heimdall/issues/8
                    //alarmCounterRunning = true;
                    triggerDelay = getTriggerDelay();
                    console.log('Alarm is triggered:     Yes')
                    //logNew = "al " + nu + surveillance + " || Heimdall || " + device.name + " " + sensorType + " triggered Alarm.";
                    logNew = "al " + nu + readableMode(surveillance) + " || Heimdall || " + device.name + " " + sensorType + Homey.__("history.triggerdalarm")

                    // speech
                    if ( sensorType == 'motion' ) {
                        speak("motionTrue", device.name + " detected motion") 
                        //speak("alarmChange", Homey.__("speech.alarmdeactivated")
                    }
                    if ( sensorType == 'contact' ){
                        speak("doorOpen", device.name + " is opened") 
                        //speak("alarmChange", Homey.__("speech.alarmdeactivated")
                    }

                    // end speech

                    if ( isDelayed(device) ) {
                        //
                        alarmCounterRunning = true;
                        console.log('alarmCounterRunning:    true')
                        //logNew = "ad "+ nu + surveillance + " || Heimdall || Alarmtrigger is delayed: " + triggerDelay + ' seconds.' + '\n' +logNew
                        logNew = "ad "+ nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.alarmdelayed") + triggerDelay + Homey.__("history.seconds") + '\n' +logNew
                        let delay = triggerDelay * 1000;
                        // Trigger delay flow card
                        var tokens= { 'Reason': device.name + ': '+ sensorStateReadable , 'Duration': triggerDelay * 1 };
                        triggerDelayActivated.trigger(tokens, function(err, result){
                            if( err ) {
                                return Homey.error(err)} ;
                            });
                        console.log('alarmCounterRunning:    true')
                        console.log('Trigger is delayed:     Yes, ' + triggerDelay + ' seconden')
                        /* delayed triggerAlarm moved to ttAlarmCountdown
                        setTimeout(function(){
                            triggerAlarm(device,state,sensorStateReadable)
                        }, delay);
                        */
                        //speak("The alarm will go off in " + triggerDelay + " seconds.")
                        speak("alarmCountdown", Homey.__("speech.startalarmcountdown") + triggerDelay + Homey.__("speech.seconds"))
                                                
                        console.log('ttAlarmCountdown start: ' + triggerDelay)
                        // Trigger Time Till Alarm flow card
                        let tta = triggerDelay - 1;
                        ttAlarmCountdown(tta, device,state,sensorStateReadable);
                    } 
                    else {
                        console.log('Trigger is delayed:     No')
                        triggerAlarm(device,state,sensorStateReadable);
                    }
                }
                else {
                    console.log('Alarm is triggered:     No')
                }
            
            }
            else {
                console.log('alarmCounterRunning:    true so sensorstate true is cancelled')
                logNew = color + nu + readableMode(surveillance) + " || Heimdall || " + device.name + ": " + sensorStateReadable + ", no alarm trigger due to running delay countdown";
            }

        }
        let shouldLog = true;
        logArmedOnly = getLogArmedOnly();
        logTrueOnly = getLogTrueOnly();
        console.log('logArmedOnly:           ' + logArmedOnly + ', Surveillance Mode: ' + surveillance)
        console.log('logTrueOnly:            ' + logTrueOnly + ', Sensorstate: ' + sensorState)
        if ( logArmedOnly && surveillance === 'disarmed' && !sourceDeviceLog)  {
            shouldLog = false;
            console.log('LogArmed is true and Surveillance is off, so no log line')
        }
        if ( logTrueOnly && !sensorState && !sourceDeviceLog) {
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

function readableState(state, type) {
    if (type == 'motion') {
        if ( state ) {
            return Homey.__("states.motion")
            //return 'Motion detected'
        } else {
            return Homey.__("states.nomotion")
            //return 'No motion detected'
        }
    } 
    else if (type == 'contact') {
        if ( state ) {
            return Homey.__("states.open")
            //return 'Open'
        } else {
            return Homey.__("states.closed")
            //return 'Closed'
        }
    } 
    else {
        return 'unknown'
    }
}

function readableMode(mode) {
    if (mode == 'armed') {
        return Homey.__("modes.armed")
    }
    else if (mode == 'partially_armed') {
        return Homey.__("modes.partiallyarmed")
    } 
    else if (mode == 'disarmed') {
        return Homey.__("modes.disarmed")
    }
    else {
        return 'unknown'
    }
}

function triggerAlarm(device,state,sensorState) {
    let nu = getDateTime();
    let logNew;
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    if ( surveillance != 'disarmed' ) {
        // Surveillance mode is active
        //logNew = "al " + nu + surveillance + " || Heimdall || Alarm is activated: " + device.name + ": " + sensorState;
        logNew = "al " + nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.alarmactivated") + device.name + ": " + sensorState;
        var tokens= {'Reason': device.name + ': '+ sensorState };
        triggerAlarmActivated.trigger(tokens, state, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            });   
        // speech

        //speak("alarmChange", "The alarm is activated") 
        speak("alarmChange", Homey.__("speech.alarmactivated"))
        
        // end speech
        // save alarm status
        Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
            if( err ) return Homey.alert( err );
        });
        // Check if Alarm Off Button exists and turn on 
        if ( aModeDevice != undefined) {
            aModeDevice.setCapabilityValue('alarm_heimdall', true)
        }
        if ( sModeDevice != undefined) {
            sModeDevice.setCapabilityValue('alarm_heimdall', true)
        } 
    }
    else {
        // Surveillance mode is not active
        // logNew = "ao " + nu + surveillance + " || Heimdall || Alarm is not activated."
        logNew = "ao " + nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.alarmnotactivated")
        alarm=false;
        Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
            if( err ) return Homey.alert( err );
        });
    }  

    // write information to log
    console.log(logNew);
    const logOld = Homey.ManagerSettings.get('myLog');
    if (logOld != undefined) { 
        logNew = logNew+"\n"+logOld;
    }
    Homey.ManagerSettings.set('myLog', logNew );

}

function ttAlarmCountdown(delay,device,state,sensorStateReadable) {
    //console.log('ttAlarmCountdown:       ' + delay)
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    if ( surveillance != 'disarmed' ) {
        var tokens = { 'AlarmTimer': delay * 1};
        triggerTimeTillAlarmChanged.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            });
        // Speech
        if (delay > 9 ) {
            if (delay/5 == parseInt(delay/5)) {
                speak("alarmCountdown", delay)
            }
        } 
        else if ( delay > 0 )  {
            speak("alarmCountdown", delay)
        }
        // end speech
        if ( delay > 0 ) {
            setTimeout(function(){
                ttAlarmCountdown(delay-1,device,state,sensorStateReadable)
            }, 1000);
        } 
        else if ( delay == 0) {
            alarmCounterRunning = false
            console.log('alarmCounterRunning:    false due to reaching 0')
            triggerAlarm(device,state,sensorStateReadable)
        }
    }
    else {
        alarmCounterRunning = false
        console.log('alarmCounterRunning:    false')
        console.log('ttAlarmCountdown:       canceled due to disarm')
    }
}

function ttArmedCountdown(delay, color, value, logLine) {
    //console.log(' ttArmedCountdown:      ' + delay)
    if ( armCounterRunning ) {
        var tokens = { 'ArmedTimer': delay * 1};
        triggerTimeTillArmedChanged.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            });
        // Speech
        if (delay > 9 ) {
            if (delay/5 == parseInt(delay/5)) {
                speak("armCountdown", delay)
            }
        } 
        else if ( delay > 0 )  {
            speak("armCountdown", delay)
        }
        // end speech
        if ( delay > 0 ) {
            setTimeout(function(){
                ttArmedCountdown(delay-1, color, value, logLine)
            }, 1000);
        }
        else if ( delay == 0) {
            setSurveillanceValue(color, value, logLine)
        }
    }
    else {
        console.log('ttArmedCountdown:       armCounterRunning = false')
        setSurveillanceValue(color, value, logLine)
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


