'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')

// Flow triggers
let triggerSurveillanceChanged = new Homey.FlowCardTrigger('SurveillanceChanged');
let triggersensorActiveAtArming = new Homey.FlowCardTrigger('sensorActiveAtArming');
let triggerAlarmActivated = new Homey.FlowCardTrigger('AlarmActivated');
let triggerAlarmDeactivated = new Homey.FlowCardTrigger('AlarmDeactivated');
let triggerDelayActivated = new Homey.FlowCardTrigger('DelayActivated');
let triggerTimeTillAlarmChanged = new Homey.FlowCardTrigger('TimeTillAlarm');
let triggerTimeTillArmedChanged = new Homey.FlowCardTrigger('TimeTillArmed');
let triggerLogLineWritten = new Homey.FlowCardTrigger('LogLineWritten');
let triggerSensorTrippedInAlarmstate = new Homey.FlowCardTrigger('SensorTrippedInAlarmstate');


// Flow conditions
const conditionSurveillanceIs = new Homey.FlowCardCondition('SurveillanceIs');
const conditionArmingCountdown = new Homey.FlowCardCondition('ArmingCountdown');
const conditionAlarmCountdown = new Homey.FlowCardCondition('AlarmCountdown');
const conditionAlarmActive = new Homey.FlowCardCondition('AlarmActive');


// Flow actions
const actionInputHistory = new Homey.FlowCardAction('SendInfo');
const actionClearHistory = new Homey.FlowCardAction('ClearHistory');
const actionActivateAlarm = new Homey.FlowCardAction('ActivateAlarm');
const actionDeactivateAlarm = new Homey.FlowCardAction('DeactivateAlarm');

var surveillance;
var alarm = false;
var heimdallSettings = [];
var defaultSettings = {
    "triggerDelay": "30",
    "delayArmingFull": false,
    "delayArmingPartial": false,
    "logArmedOnly": false,
    "logTrueOnly": false,
    "useTampering": false,
    "checkMotionAtArming": false,
    "checkContactAtArming": false,
    "checkBeforeCountdown": false,
    "spokenSmodeChange": false,
    "spokenAlarmCountdown": false,
    "spokenArmCountdown": false,
    "spokenAlarmChange": false,
    "spokenMotionTrue": false,
    "spokenTamperTrue": false,
    "spokenDoorOpen": false,
    "spokenMotionAtArming": false,
    "spokenDoorOpenAtArming": false
};
var allDevices;
var devicesMonitored = [];
var devicesMonitoredFull = [];
var devicesMonitoredPartial = [];
var devicesDelayed = [];
var devicesLogged = [];
var sModeDevice;
var aModeDevice;
var armCounterRunning = false;
var alarmCounterRunning = false;
var devicesTripped = [];

class Heimdall extends Homey.App {
    // Get API control function
    getApi() {
        if (!this.api) {
        this.api = HomeyAPI.forCurrentHomey();
        }
        return this.api;
    }

    // Get all devices function for API
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
        });
        allDevices = await api.devices.getDevices();

        for (let device in allDevices) {
            this.addDevice(allDevices[device], api)
        };

        this.log('Enumerating devices done.')
    }

	onInit() {
        this.log('init Heimdall')
        heimdallSettings = Homey.ManagerSettings.get('settings');
		if (heimdallSettings == (null || undefined)) {
			heimdallSettings = defaultSettings
		};
        getMonitoredFullDevices();
        getMonitoredPartialDevices();
        getDelayedDevices();
        getLoggedDevices();
        this.enumerateDevices();
    }

    // Add device function, only all device types with motion-, contact- and tamper capabilities are added.
    addDevice(device, api) {
        if (device.data.id === 'sMode') {
            sModeDevice = device;
            console.log('Found Mode Switch:          ' + device.name)
            console.log('Variabele:                  ' + sModeDevice.name)
        }
        if (device.data.id === 'aMode') {
            aModeDevice = device;
            console.log('Found Alarm Button          ' + device.name)
            console.log('Variabele:                  ' + aModeDevice.name)
        }
        if ('alarm_motion' in device.capabilities) {
            console.log('Found motion sensor:        ' + device.name)
            attachEventListener(device,'motion')
        }
        if ('alarm_tamper' in device.capabilities) {
            console.log('Found tamper sensor:        ' + device.name)
            attachEventListener(device,'tamper')
        }
        if ('alarm_contact' in device.capabilities) {
            console.log('Found contact sensor:       ' + device.name)
            attachEventListener(device,'contact')
        }
    }

    setSurveillanceMode(value, source) {
        console.log('setSurveillanceMode:    ' + value);
        let nu = getDateTime();
        let logLine
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        if ( value == 'disarmed' ) {
            logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodedisarmed")
            setSurveillanceValue("sd ",value, logLine)
            Homey.app.deactivateAlarm(false, "Surveillance Mode Switch")
            if ( armCounterRunning ) {
                // code to cancel an arm command during delayArming
                console.log('Need to stop arming!')
                armCounterRunning = false;
            }   
        } else {
            if ( value == 'armed' ) {
                logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodearmed")
            } else { 
                logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodepartiallyarmed")
            }
            // choose appropriate delay at Armed or Partially Armed

            // need to check for active armCounterRunning ?

            if ( (value == 'armed' && heimdallSettings.delayArmingFull) || (value == 'partially_armed' && heimdallSettings.delayArmingPartial )  ) {
                console.log('Arming is delayed:      Yes, ' + heimdallSettings.triggerDelay + ' seconds.')
                let delay = heimdallSettings.triggerDelay * 1000;
                console.log('setSurveillanceValue in:' + heimdallSettings.triggerDelay + ' seconds.')
                //speak("The Surveillance mode will be set to " + readableMode(value) + " in " + heimdallSettings.triggerDelay + " seconds.")
                speak("armCountdown", Homey.__("speech.startarmcountdown") + readableMode(value) + Homey.__("speech.in") + heimdallSettings.triggerDelay + Homey.__("speech.seconds"))
                armCounterRunning = true;
                let tta = heimdallSettings.triggerDelay;
                ttArmedCountdown(tta,"sa ", value, logLine);
                if ( value == 'armed' ) {
                    logLine = "st " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.smodedelayarmed") + heimdallSettings.triggerDelay + Homey.__("history.seconds")
                } else { 
                    logLine = "st " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.smodedelaypartiallyarmed") + heimdallSettings.triggerDelay + Homey.__("history.seconds")
                }
                writeLog(logLine)
                // check for tripped sensor before Arming Delay
                if ( heimdallSettings.checkBeforeCountdown ) {
                    Homey.app.checkDevicesState(value, nu)
                }
            } else {
                console.log('Arming is delayed:      No')
                armCounterRunning = true;
                setSurveillanceValue("sa ",value, logLine)
            }
        }
    }

    async checkDevicesState(value, nu) {
        // Get the homey object
        const api = await this.getApi();

        for (let device in allDevices) {
            this.checkDeviceState(allDevices[device], value, nu)
        };
    }

    checkDeviceState(device, value, nu) {
        let sensorState
        let sensorStateReadable
        let sensorType
        if ( 'alarm_motion' in device.capabilities && heimdallSettings.checkMotionAtArming ) {
            sensorState = device.state.alarm_motion
            sensorStateReadable = readableState(sensorState, 'motion')
            sensorType = 'motion'
        }
        if ('alarm_contact' in device.capabilities && heimdallSettings.checkContactAtArming ) {
            sensorState = device.state.alarm_contact
            sensorStateReadable = readableState(sensorState, 'contact')
            sensorType = 'contact'
        };

        if ( value == 'armed') {
            if ( isMonitoredFull(device) ) {
                if ( sensorState ) {
                    let delayText = ""
                    if ( isDelayed(device) ) {
                        delayText = Homey.__("atarming.delayText")
                    }
                    if ( sensorType == 'motion') {
                        this.alertSensorActive(value, nu, sensorType, Homey.__("atarming.warningMotion") + sensorStateReadable + Homey.__("atarming.on") + device.name + delayText)
                    } else if ( sensorType == 'contact') {
                        this.alertSensorActive(value, nu, sensorType, Homey.__("atarming.warningContact") + device.name + Homey.__("atarming.is") + sensorStateReadable + delayText) 
                    }
                }
            }
        }
        else if ( value == 'partially_armed' ) {
            if ( isMonitoredPartial(device) ) {
                if ( sensorState ) {
                    let delayText = ""
                    if ( isDelayed(device) ) {
                        delayText = Homey.__("atarming.delayText")
                    }   
                    if ( sensorType == 'motion') {
                        this.alertSensorActive(value, nu, sensorType, Homey.__("atarming.warningMotion") + sensorStateReadable + Homey.__("atarming.on") + device.name + delayText)
                    } else if ( sensorType == 'contact') {
                        this.alertSensorActive(value, nu, sensorType, Homey.__("atarming.warningContact") + device.name + Homey.__("atarming.is") + sensorStateReadable + delayText) 
                    }
                }
            }
        }
    }

    alertSensorActive(value, nu, sensorType, warningText) {
        // write log
        let color = 'm' + value.substring(0,1) + '-'
        let logLine = color + nu + readableMode(value) + " || Heimdall || " + warningText
        writeLog(logLine)
        // activate triggercard
        var tokens = { 'warning': warningText };
        triggersensorActiveAtArming.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            } );
        // tell user
        if ( sensorType == 'motion' && heimdallSettings.spokenMotionAtArming) {
            speak("sensorActive", warningText)
        } else if ( sensorType == 'contact' && heimdallSettings.spokenDoorOpenAtArming ) {
            speak("sensorActive", warningText)
        }
    }

    deactivateAlarm(value, source) {
        if ( alarm === true || source == "Flowcard") {
            let nu = getDateTime();
            alarm = false
            surveillance = Homey.ManagerSettings.get('surveillanceStatus');
            Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
                if( err ) return Homey.alert( err );
            });
            //speak("alarmChange", "The alarm is deactivated") 
            speak("alarmChange", Homey.__("speech.alarmdeactivated"))
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
            let logLine = "ao "+ nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmdeactivated") + source
            writeLog(logLine)
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
    .on('run', ( args, callback ) => {
        console.log(args)
        if ( true ) {
            callback( null, true );
        }   
        else {
            callback( null, false );
        } 
    });

triggersensorActiveAtArming
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

triggerAlarmActivated
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
    
triggerLogLineWritten
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

triggerSensorTrippedInAlarmstate
    .register()
    .on('run', ( args, callback ) => {
        console.log(args)
        if ( true ) {
            callback( null, true );
        }
        else {
            callback( null, false );
        }
    })

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

conditionArmingCountdown
    .register()
    .on('run', ( args, state, callback ) => {
        if ( armCounterRunning ) {
            callback( null, true )
        }
        else {
            callback( null, false )
        }
    });

conditionAlarmCountdown
    .register()
    .on('run', ( args, state, callback ) => {
        if ( alarmCounterRunning ) {
            callback( null, true )
        }
        else {
            callback( null, false )
        }
    });

conditionAlarmActive
    .register()
    .on('run', ( args, state, callback ) => {
        if ( alarm ) {
            callback( null, true )
        }
        else {
            callback( null, false )
        }
    });

//Flow actions functions
actionInputHistory
    .register()
    .on('run', ( args, state, callback ) => {
        let nu = getDateTime();
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        let logLine = "lh " + nu + readableMode(surveillance) + " || Flowcard || " + args.log;
        writeLog(logLine)
        callback( null, true );
    });

actionClearHistory
    .register()
    .on('run', ( args, state, callback ) => {
        Homey.ManagerSettings.set('myLog', '' );
        console.log ('actionClearHistory: The history data is cleared.');
        callback( null, true );
    }); 

actionActivateAlarm
    .register()
    .on('run', ( args, state, callback ) => {
        activateAlarm("",  "", "", "Flowcard")
        callback( null, true ); 
    });

actionDeactivateAlarm
    .register()
    .on('run', ( args, state, callback ) => {
        Homey.app.deactivateAlarm(true, "Flowcard")
        callback( null, true );
    });

Homey.ManagerSettings.on('set', (variable) => {
	if ( variable === 'settings' ) {
        heimdallSettings = Homey.ManagerSettings.get('settings')
        console.log('New settings:')
        console.log(heimdallSettings)
    }
});

// Write information to history
function writeLog(logLine) {
    console.log(logLine);
    let savedHistory = Homey.ManagerSettings.get('myLog');
    if (savedHistory != undefined) { 
        //cleanup history
        let lineCount = savedHistory.split(/\r\n|\r|\n/).length;
        if ( lineCount > 3000 ) {
            let deleteItems = parseInt( lineCount * 0.2 );
            let savedHistoryArray = savedHistory.split(/\r\n|\r|\n/);
            let cleanUp = savedHistoryArray.splice(-1*deleteItems, deleteItems, "" );
            savedHistory = savedHistoryArray.join('\n'); 
        }
        //end cleanup
        logLine = logLine+"\n"+savedHistory;
    }
    Homey.ManagerSettings.set('myLog', logLine );
}

function setSurveillanceValue(color,value, logLine) {
    let nu = getDateTime();
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
        // check the states of the sensors 
        if ( value != 'disarmed' && !heimdallSettings.checkBeforeCountdown ) {
            Homey.app.checkDevicesState(value, nu)
        }
        //
    } else {
        logLine = "sd " + nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.smodechangedisabled")
    }
    writeLog(logLine)   
    armCounterRunning = false;
}

// Get devices that should be logged function
function getLoggedDevices() {
    devicesLogged = Homey.ManagerSettings.get('loggedDevices')
}

// Get devices that should be monitored full function
function getMonitoredFullDevices() {
    devicesMonitoredFull = Homey.ManagerSettings.get('monitoredFullDevices')
}

// Get devices that should be monitored partial function
function getMonitoredPartialDevices() {
    devicesMonitoredPartial = Homey.ManagerSettings.get('monitoredPartialDevices')
}

// Get devices that have a delayed trigger function
function getDelayedDevices() {
    devicesDelayed = Homey.ManagerSettings.get('delayedDevices')
}

function speak(type, text) {
    if (type == "sModeChange" && heimdallSettings.spokenSmodeChange ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
     }
    if (type == "alarmCountdown" && heimdallSettings.spokenAlarmCountdown ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "armCountdown" && heimdallSettings.spokenArmCountdown ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "alarmChange" && heimdallSettings.spokenAlarmChange ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "motionTrue" && heimdallSettings.spokenMotionTrue ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "doorOpen" && heimdallSettings.spokenDoorOpen ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
    if (type == "tamper" && heimdallSettings.spokenTamperTrue ) {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }    
    if (type == "sensorActive") {
        console.log('Say:                    ' + text)
        Homey.ManagerSpeechOutput.say(text.toString())
    }
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
    
    switch (sensorType) {
        case "motion":
            device.on('alarm_motion', debounce(alarm_motion => { 
                stateChange(device,alarm_motion,sensorType)
            },250));
            break;

        case "contact":
            device.on('alarm_contact', debounce(alarm_contact => { 
                stateChange(device,alarm_contact,sensorType)
            },250));
            break;

        case "tamper":
            device.on('alarm_tamper', debounce(alarm_tamper => { 
                stateChange(device,alarm_tamper,sensorType)
            },250));
            break;
    }

    console.log('Attached Eventlistener:     ' + device.name + ', ' + sensorType)
    if ( isMonitoredFull(device) ) {
        console.log('Fully Monitored device:     ' + device.name)
    } 
    if ( isMonitoredPartial(device) ) {
        console.log('Partially Monitored device: ' + device.name)
    }
    if ( isLogged(device) ) {
        console.log('Logged device:              ' + device.name)
    }
}

function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

// this function gets called when a device with an attached eventlistener fires an event.
function stateChange(device,sensorState,sensorType) {
    if ( sensorType == 'tamper' && !heimdallSettings.useTampering ) {
        console.log("StateChange detected for tampering but shouldn't act on it")
        return
    }

    let nu = getDateTime();
    let sourceDeviceFull = false;
    let sourceDevicePartial = false;
    let sourceDeviceLog = false;
    let color = "   ";
    let logLine;
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
    // is the device monitored?
    if ( sourceDeviceFull || sourceDevicePartial || sourceDeviceLog ) {
        console.log('Full||Partial||Log:     Yes')
        let sensorStateReadable;
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        // get sensortype to set correct sensorState
        if (sensorType == 'motion') {
            sensorStateReadable = readableState(sensorState, 'motion')
        } else if (sensorType == 'contact') {
            sensorStateReadable = readableState(sensorState, 'contact')
        } else if (sensorType == 'tamper') {
            sensorStateReadable = readableState(sensorState, 'tamper')
        };
        console.log('sensorStateReadable:    ' + sensorStateReadable)
        // Select the desired color
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
        // Set logLine for the statechange
        logLine = color + nu + readableMode(surveillance) + " || Heimdall || " + device.name + " " + sensorType + ": " + sensorStateReadable;
        // Is sensorstate true?
        if ( sensorState ) {
            // is there no delayed trigger and Alarm state active?
            if ( !alarmCounterRunning && !alarm) {
                if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                    console.log('Alarm is triggered:     Yes')
                    logLine = "al " + nu + readableMode(surveillance) + " || Heimdall || " + device.name + " in " + device.zone.name + Homey.__("history.triggerdalarm")
                    if ( sensorType == 'motion' ) {
                        speak("motionTrue", device.name + " detected motion") 
                    }
                    if ( sensorType == 'contact' ) {
                        speak("doorOpen", device.name + " is opened") 
                    }         
                    if ( sensorType == 'tamper') {
                        speak("tamper", device.name + " detected tampering")
                    }         
                    if ( isDelayed(device) ) {   
                        // The device has a delayed trigger
                        alarmCounterRunning = true;
                        console.log('alarmCounterRunning:    true')
                        logLine = "ad "+ nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.alarmdelayed") + heimdallSettings.triggerDelay + Homey.__("history.seconds") + '\n' + logLine
                        let delay = heimdallSettings.triggerDelay * 1000;
                        // Trigger delay flow card
                        var tokens= { 'Reason': device.name + ': '+ sensorStateReadable , 'Duration': heimdallSettings.triggerDelay * 1 };
                        triggerDelayActivated.trigger(tokens, function(err, result){
                            if( err ) {
                                return Homey.error(err)} ;
                            });
                        console.log('alarmCounterRunning:    true')
                        console.log('Trigger is delayed:     Yes, ' + heimdallSettings.triggerDelay + ' seconden')
                        //speak("The alarm will go off in " + heimdallSettings.triggerDelay + " seconds.")
                        speak("alarmCountdown", Homey.__("speech.startalarmcountdown") + heimdallSettings.triggerDelay + Homey.__("speech.seconds"))
                        console.log('ttAlarmCountdown start: ' + heimdallSettings.triggerDelay)
                        // Trigger Time Till Alarm flow card
                        let tta = heimdallSettings.triggerDelay - 1;
                        ttAlarmCountdown(tta, device,sensorStateReadable);
                    } 
                    else {
                        console.log('Trigger is delayed:     No')
                        activateAlarm(device, sensorStateReadable, nu, "Heimdall");
                    }
                }
                else {
                    console.log('Alarm is triggered:     No')
                }
            
            }
            else if ( alarmCounterRunning ) {
                // Delayed trigger is active
                if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                    console.log('alarmCounterRunning:    true so sensorstate true is cancelled')
                    logLine = color + nu + readableMode(surveillance) + " || Heimdall || " + device.name + ": " + sensorStateReadable + Homey.__("history.noalarmtriggercountdown");
                }
            } 
            else if ( alarm ) {
                // Alarm state is active
                if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                    console.log('Alarmstate Ative:       The Alarm State is active so just log the sensorstate')
                    logLine = color + nu + readableMode(surveillance) + " || Heimdall || " + device.name + ": " + sensorStateReadable + Homey.__("history.noalarmtriggeralarmstate");
                
                    var tokens = {'Zone': device.zone.name, 'Device': device.name, 'State': sensorStateReadable};
                    triggerSensorTrippedInAlarmstate.trigger(tokens, function(err, result){
                        if( err ) {
                            return Homey.error(err)} ;
                        });
                }
            }
        }
        let shouldLog = true;
        console.log('logArmedOnly:           ' + heimdallSettings.logArmedOnly + ', Surveillance Mode: ' + surveillance)
        console.log('logTrueOnly:            ' + heimdallSettings.logTrueOnly + ', Sensorstate: ' + sensorState)
        if ( heimdallSettings.logArmedOnly && surveillance === 'disarmed' && !sourceDeviceLog)  {
            shouldLog = false;
            console.log('LogArmed is true and Surveillance is off, so no log line')
        }
        if ( heimdallSettings.logTrueOnly && !sensorState && !sourceDeviceLog) {
            shouldLog = false;
            console.log('logTrue is true and sensorstate is false, so no log line')
        }
        if ( shouldLog ) {
            writeLog(logLine)        
        }
        if (sourceDeviceLog) {
            // trigger the flowcard when a device with logging changes state
            var tokens = {'Device': device.name, 'State': sensorStateReadable};
            triggerLogLineWritten.trigger(tokens, function(err, result){
                if( err ) {
                    return Homey.error(err)} ;
                });
        }
    }
}

function readableState(sensorState, type) {
    if (type == 'motion') {
        if ( sensorState ) {
            return Homey.__("states.motion")
            //return 'Motion detected'
        } else {
            return Homey.__("states.nomotion")
            //return 'No motion detected'
        }
    } 
    else if (type == 'contact') {
        if ( sensorState ) {
            return Homey.__("states.open")
            //return 'Open'
        } else {
            return Homey.__("states.closed")
            //return 'Closed'
        }
    } else if (type == 'tamper') {
        if ( sensorState ) {
            return Homey.__("states.tamper")
            //return 'Tamper detected'
        } else {
            return Homey.__("states.notamper")
            //return 'No tamper detected'
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

function activateAlarm(device,sensorState,nu,source) {
    console.log('nu: '+ nu)
    if ( nu == "" ) { 
        nu = getDateTime()
    }
    console.log('nu: '+ nu)
    let logLine;
    alarm=true;
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    if ( surveillance != 'disarmed' || source == "Flowcard" ) {
        // Surveillance mode is active
        if ( source == "Heimdall") {
            var tokens= {'Reason': device.name + ': '+ sensorState , 'Zone': device.zone.name };
            logLine = "al " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmactivated") + device.name + ": " + sensorState;
        } else {
            var tokens= {'Reason': 'Flowcard' , 'Zone': "" };
            logLine = "al " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmactivatedflowcard");
        }
        triggerAlarmActivated.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            });   
        //speak("alarmChange", "The alarm is activated") 
        speak("alarmChange", Homey.__("speech.alarmactivated"))
        // save alarm status
        Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
            if( err ) return Homey.alert( err );
        });
        // Check if Alarm Off Button exists and turn on 
        if ( aModeDevice != undefined) {
            console.log("aModeDevice alarm_heimdall set")
            aModeDevice.setCapabilityValue('alarm_heimdall', true)
        }
        if ( sModeDevice != undefined) {
            sModeDevice.setCapabilityValue('alarm_heimdall', true)
        } 
    }
    else {
        // Surveillance mode is not active
        logLine = "ao " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmnotactivated")
        alarm=false;
        Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
            if( err ) return Homey.alert( err );
        });
    }  
    // write information to log
    writeLog(logLine)
}

function ttAlarmCountdown(delay,device,sensorStateReadable) {
    console.log('ttAlarmCountdown:       ' + delay)
    surveillance = Homey.ManagerSettings.get('surveillanceStatus');
    if ( surveillance != 'disarmed' ) {
        var tokens = { 'AlarmTimer': delay * 1};
        triggerTimeTillAlarmChanged.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            });
        if (delay > 9 ) {
            if (delay/5 == parseInt(delay/5)) {
                speak("alarmCountdown", delay)
            }
        } 
        else if ( delay > 0 )  {
            speak("alarmCountdown", delay)
        }
        if ( delay > 0 ) {
            setTimeout(function(){
                ttAlarmCountdown(delay-1,device,sensorStateReadable)
            }, 1000);
        } 
        else if ( delay == 0) {
            alarmCounterRunning = false
            console.log('alarmCounterRunning:    false due to reaching 0')
            activateAlarm(device, sensorStateReadable, "", "Heimdall")
        }
    }
    else {
        alarmCounterRunning = false
        console.log('alarmCounterRunning:    false')
        console.log('ttAlarmCountdown:       canceled due to disarm')
        // new
        activateAlarm(device, sensorStateReadable, "", "Heimdall")
    }
}

function ttArmedCountdown(delay, color, value, logLine) {
    console.log(' ttArmedCountdown:      ' + delay)
    if ( armCounterRunning ) {
        var tokens = { 'ArmedTimer': delay * 1};
        triggerTimeTillArmedChanged.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            });
        if (delay > 9 ) {
            if (delay/5 == parseInt(delay/5)) {
                speak("armCountdown", delay)
            }
        } 
        else if ( delay > 0 )  {
            speak("armCountdown", delay)
        }
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


