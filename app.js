'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')

// Flow triggers
let triggerSurveillanceChanged = new Homey.FlowCardTrigger('SurveillanceChanged');
let triggersensorActiveAtArming = new Homey.FlowCardTrigger('sensorActiveAtArming');
let triggerAlarmActivated = new Homey.FlowCardTrigger('AlarmActivated');
let triggerAlarmDeactivated = new Homey.FlowCardTrigger('AlarmDeactivated');
let triggerAlarmDelayActivated = new Homey.FlowCardTrigger('AlarmDelayActivated');
let triggerTimeTillAlarmChanged = new Homey.FlowCardTrigger('TimeTillAlarm');
let triggerTimeTillArmedChanged = new Homey.FlowCardTrigger('TimeTillArmed');
let triggerLogLineWritten = new Homey.FlowCardTrigger('LogLineWritten');
let triggerSensorTrippedInAlarmstate = new Homey.FlowCardTrigger('SensorTrippedInAlarmstate');
let triggerNoInfoReceived = new Homey.FlowCardTrigger('noInfoReceived');

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
//const actionCheckLastCommunication = new Homey.FlowCardAction('CheckLastCommunication');


var surveillance;
var alarm = false;
var heimdallSettings = [];
var defaultSettings = {
    "armingDelay": "30",
    "alarmDelay": "30",
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
    "spokenDoorOpenAtArming": false,
    "noCommunicationTime": 24
};
var allDevices;
var sModeDevice;
var aModeDevice;
var armCounterRunning = false;
var alarmCounterRunning = false;
var lastDoor = false;
var changeTta = false;

class Heimdall extends Homey.App {

    onInit() {
        this.log('init Heimdall')

        surveillance = Homey.ManagerSettings.get('surveillanceStatus'); 
        // this.log('Surveillance Mode: ' + surveillance);
        if ( surveillance == null ) {
            surveillance = true
        };

        heimdallSettings = Homey.ManagerSettings.get('settings');
		if (heimdallSettings == (null || undefined)) {
			heimdallSettings = defaultSettings
        };

        if ( heimdallSettings.armingDelay == (null || undefined)) {
            heimdallSettings.armingDelay = heimdallSettings.triggerDelay
            heimdallSettings.alarmDelay = heimdallSettings.triggerDelay
        }

        if ( heimdallSettings.noCommunicationTime == (null || undefined) || heimdallSettings.noCommunicationTime == 12 ) {
            heimdallSettings.noCommunicationTime = 24
        }

        // this.getMonitoredFullDevices();
        // this.getMonitoredPartialDevices();
        // this.getDelayedDevices();
        // this.getLoggedDevices();
        this.enumerateDevices();
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
            this.addDevice(allDevices[device])
        };
        // this.log('Enumerating devices done.')
    }

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

    // Add device function, all device types with motion-, contact-, vibration- and tamper capabilities are added.
    addDevice(device) {
        if (device.data.id === 'sMode') {
            sModeDevice = device;
            // this.log('Found Mode Switch:          ' + device.name)
            // this.log('Variabele:                  ' + sModeDevice.name)
        }
        if (device.data.id === 'aMode') {
            aModeDevice = device;
            // this.log('Found Alarm Button          ' + device.name)
            // this.log('Variabele:                  ' + aModeDevice.name)
        }
        if ('alarm_motion' in device.capabilities) {
            // this.log('Found motion sensor:        ' + device.name)
            this.attachEventListener(device,'motion')
        }
        if ('alarm_contact' in device.capabilities) {
            // this.log('Found contact sensor:       ' + device.name)
            this.attachEventListener(device,'contact')
        }
        if ('alarm_vibration' in device.capabilities) {
            // this.log('Found vibration sensor:     ' + device.name)
            this.attachEventListener(device,'vibration')
        }
        if ('alarm_tamper' in device.capabilities) {
            // this.log('Found tamper sensor:        ' + device.name)
            this.attachEventListener(device,'tamper')
        }
    }

    attachEventListener(device,sensorType) {
        switch (sensorType) {
            case "motion":
                device.on('alarm_motion', this.debounce(alarm_motion => { 
                    this.stateChange(device,alarm_motion,sensorType)
                },250));
                break;
            case "contact":
                device.on('alarm_contact', this.debounce(alarm_contact => { 
                    this.stateChange(device,alarm_contact,sensorType)
                },250));
                break;
            case "vibration":
                device.on('alarm_vibration', this.debounce(alarm_vibration => { 
                    this.stateChange(device,alarm_vibration,sensorType)
                },250));
                break;
            case "tamper":
                device.on('alarm_tamper', this.debounce(alarm_tamper => { 
                    this.stateChange(device,alarm_tamper,sensorType)
                },250));
                break;
        }
    
        // this.log('Attached Eventlistener:     ' + device.name + ', ' + sensorType)
        if ( isMonitoredFull(device) ) {
            // this.log('Fully Monitored device:     ' + device.name)
        } 
        if ( isMonitoredPartial(device) ) {
            // this.log('Partially Monitored device: ' + device.name)
        }
        if ( isLogged(device) ) {
            // this.log('Logged device:              ' + device.name)
        }
    }

    //
    debounce(func, wait, immediate) {
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
        }
    }

    // this function gets called when a device with an attached eventlistener fires an event.
    stateChange(device,sensorState,sensorType) {
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
            } else if (sensorType == 'vibration') {
                sensorStateReadable = readableState(sensorState, 'vibration')
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
            // Is sensorState true?
            if ( sensorState ) {
                if (sensorType='contact' && isDelayed(device) && armCounterRunning) {
                    // a Doorsensor with a delay is opened while the arming countdown is running
                    console.log('lastDoor:               Opened')
                    lastDoor = true;
                }
                // is there no delayed trigger and Alarm state active?
                if ( !alarmCounterRunning && !alarm) {
                    if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                        console.log('Alarm is triggered:     Yes')
                        logLine = "al " + nu + readableMode(surveillance) + " || Heimdall || " + device.name + " in " + device.zone.name + Homey.__("history.triggerdalarm")
                        if ( sensorType == 'motion' ) {
                            this.speak("motionTrue", device.name + " detected motion") 
                        }
                        if ( sensorType == 'contact' ) {
                            this.speak("doorOpen", device.name + " is opened") 
                        }         
                        if ( sensorType == 'tamper') {
                            this.speak("tamper", device.name + " detected tampering")
                        }         
                        if ( isDelayed(device) ) {   
                            // The device has a delayed trigger
                            alarmCounterRunning = true;
                            console.log('alarmCounterRunning:    true')
                            logLine = "ad "+ nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.alarmdelayed") + heimdallSettings.alarmDelay + Homey.__("history.seconds") + '\n' + logLine
                            let delay = heimdallSettings.alarmDelay * 1000;
                            // Trigger delay flow card
                            var tokens= { 'Reason': device.name + ': '+ sensorStateReadable , 'Duration': heimdallSettings.alarmDelay * 1 };
                            triggerAlarmDelayActivated.trigger(tokens, function(err, result){
                                if( err ) {
                                    return Homey.error(err)} ;
                                });
                            console.log('alarmCounterRunning:    true')
                            console.log('alarm is delayed:       Yes, ' + heimdallSettings.alarmDelay + ' seconden')
                            //speak("The alarm will go off in " + heimdallSettings.alarmDelay + " seconds.")
                            this.speak("alarmCountdown", Homey.__("speech.startalarmcountdown") + heimdallSettings.alarmDelay + Homey.__("speech.seconds"))
                            console.log('ttAlarmCountdown start: ' + heimdallSettings.alarmDelay)
                            // Trigger Time Till Alarm flow card
                            let tta = heimdallSettings.alarmDelay - 1;
                            this.ttAlarmCountdown(tta, device,sensorStateReadable);
                        } 
                        else {
                            console.log('Trigger is delayed:     No')
                            this.activateAlarm(device, sensorStateReadable, nu, "Heimdall");
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
            else {
            // sensorState is false    
                if (sensorType='contact' && isDelayed(device) && armCounterRunning && lastDoor) {
                    // a Doorsensor with a delay is opened and closed while the arming countdown is running
                    console.log('lastDoor:               Closed, countdown will be lowered')
                    changeTta = true;
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
                this.writeLog(logLine)        
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

    // sets Surveillance Mode, called from Surveillance Mode Device, will call setSurveillanceValue after evaluating conditions.
    setSurveillanceMode(value, source) {
        // // this.log('setSurveillanceMode:    ' + value);
        let nu = getDateTime();
        let logLine
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        if ( value == 'disarmed' ) {
            logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodedisarmed")
            this.setSurveillanceValue("sd ",value, logLine)
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
            if ( (value == 'armed' && heimdallSettings.delayArmingFull) || (value == 'partially_armed' && heimdallSettings.delayArmingPartial )  ) {
                // this.log('Arming is delayed:      Yes, ' + heimdallSettings.armingDelay + ' seconds.')
                let delay = heimdallSettings.armingDelay * 1000;
                // this.log('setSurveillanceValue in:' + heimdallSettings.armingDelay + ' seconds.')
                //speak("The Surveillance mode will be set to " + readableMode(value) + " in " + heimdallSettings.armingDelay + " seconds.")
                this.speak("armCountdown", Homey.__("speech.startarmcountdown") + readableMode(value) + Homey.__("speech.in") + heimdallSettings.armingDelay + Homey.__("speech.seconds"))
                armCounterRunning = true;
                let tta = heimdallSettings.armingDelay;
                this.ttArmedCountdown(tta,"sa ", value, logLine);
                if ( value == 'armed' ) {
                    logLine = "st " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.smodedelayarmed") + heimdallSettings.armingDelay + Homey.__("history.seconds")
                } else { 
                    logLine = "st " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.smodedelaypartiallyarmed") + heimdallSettings.armingDelay + Homey.__("history.seconds")
                }
                this.writeLog(logLine)
                // check for tripped sensor before Arming Delay
                if ( heimdallSettings.checkBeforeCountdown ) {
                    Homey.app.checkDevicesState(value, nu)
                }
            } else {
                // this.log('Arming is delayed:      No')
                armCounterRunning = true;
                this.setSurveillanceValue("sa ",value, logLine)
            }
            if ( value === 'armed' || value === 'partially_armed' ) {
                Homey.app.checkDevicesLastCom(value)
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
        if ( 'alarm_contact' in device.capabilities && heimdallSettings.checkContactAtArming ) {
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
                    if ( sensorType == 'motion' ) {
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
                    if ( sensorType == 'motion' ) {
                        this.alertSensorActive(value, nu, sensorType, Homey.__("atarming.warningMotion") + sensorStateReadable + Homey.__("atarming.on") + device.name + delayText)
                    } else if ( sensorType == 'contact' ) {
                        this.alertSensorActive(value, nu, sensorType, Homey.__("atarming.warningContact") + device.name + Homey.__("atarming.is") + sensorStateReadable + delayText) 
                    }
                }
            }
        }
    }

    async checkDevicesLastCom(value) {

        this.getDevices()

        for (let device in allDevices) {
            this.checkDeviceLastCom(allDevices[device], value)
        };  
    }

    checkDeviceLastCom(device, value) {
        if ( isMonitoredFull(device) || isMonitoredPartial(device) ) {
            let nu = getDateTime();
            let nuEpoch = Date.now();

            if ( 'alarm_motion' in device.capabilities || 'alarm_contact' in device.capabilities ) {
                let mostRecentComE = 0
                
                for ( let lastUpdate in device.lastUpdated ) {
                    if ( Date.parse(device.lastUpdated[lastUpdate]) > mostRecentComE  ) {
                        mostRecentComE = Date.parse(device.lastUpdated[lastUpdate])
                    }
                };
                let mostRecentComH = new Date( mostRecentComE )
                let verschil = (nuEpoch - mostRecentComE)/1000
                
                if ( verschil > heimdallSettings.noCommunicationTime * 3600 ) {
                    let d = new Date(0);
                    d.setUTCSeconds(Date.parse(mostRecentComH)/1000);
                    let lastUpdateTime = d.toLocaleString();

                    let tempColor = 'mp-'
                    let tempLogLine = tempColor + nu + readableMode(value) + " || Heimdall || " + device.name + " in " + device.zone.name + Homey.__("history.noreport") + heimdallSettings.noCommunicationTime + Homey.__("history.lastreport") + lastUpdateTime
                    this.writeLog(tempLogLine)

                    var tokens = {'Zone': device.zone.name, 'Device': device.name, 'LastUpdate': lastUpdateTime, 'Duration': heimdallSettings.noCommunicationTime};
                    triggerNoInfoReceived.trigger(tokens, function(err, result){
                        if( err ) {
                            return Homey.error(err)} ;
                        });
                }
            }
        }
    }

    // Actually sets the Surveillance Mode 
    setSurveillanceValue(color,value, logLine) {
        let nu = getDateTime();
        logLine = color + nu + logLine;
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        lastDoor = false;
        changeTta = false;

        if ( armCounterRunning || value === 'disarmed') {
            Homey.ManagerSettings.set('surveillanceStatus', value, function( err ){
                if( err ) return Homey.alert( err );
            });
            //speak("sModeChange", "The surveillance mode is set to " + readableMode(value)) 
            this.speak("sModeChange", Homey.__("speech.smodeset") + readableMode(value))
            // this.log('setSurveillanceValue:   '+ value)
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
        this.writeLog(logLine)   
        armCounterRunning = false;
    }

    activateAlarm(device,sensorState,nu,source) {
        // // this.log('nu: '+ nu)
        if ( nu == "" ) { 
            nu = getDateTime()
        }
        // // this.log('nu: '+ nu)
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
            // speak("alarmChange", "The alarm is activated") 
            this.speak("alarmChange", Homey.__("speech.alarmactivated"))
            // save alarm status
            Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
                if( err ) return Homey.alert( err );
            });
            // Check if Alarm Off Button exists and turn on 
            if ( aModeDevice != undefined) {
                // this.log("aModeDevice alarm_heimdall set")
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
        this.writeLog(logLine)
    }

    alertSensorActive(value, nu, sensorType, warningText) {
        // write log
        let color = 'm' + value.substring(0,1) + '-'
        let logLine = color + nu + readableMode(value) + " || Heimdall || " + warningText
        this.writeLog(logLine)
        // activate triggercard
        var tokens = { 'warning': warningText };
        triggersensorActiveAtArming.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            } );
        // tell user
        if ( sensorType == 'motion' && heimdallSettings.spokenMotionAtArming) {
            this.speak("sensorActive", warningText)
        } else if ( sensorType == 'contact' && heimdallSettings.spokenDoorOpenAtArming ) {
            this.speak("sensorActive", warningText)
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
            // speak("alarmChange", "The alarm is deactivated") 
            this.speak("alarmChange", Homey.__("speech.alarmdeactivated"))
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
            this.writeLog(logLine)
        }
    }

    // Write information to history and cleanup 20% when history above 2000 lines
    async writeLog(logLine) {
        console.log(logLine);
        let savedHistory = Homey.ManagerSettings.get('myLog');
        if (savedHistory != undefined) { 
            // cleanup history
            let lineCount = savedHistory.split(/\r\n|\r|\n/).length;
            if ( lineCount > 2000 ) {
                let deleteItems = parseInt( lineCount * 0.2 );
                let savedHistoryArray = savedHistory.split(/\r\n|\r|\n/);
                let cleanUp = savedHistoryArray.splice(-1*deleteItems, deleteItems, "" );
                savedHistory = savedHistoryArray.join('\n'); 
            }
            // end cleanup
            logLine = logLine+"\n"+savedHistory;
        }
        Homey.ManagerSettings.set('myLog', logLine );
    }

    async speak(type, text) {
        if (type == "sModeChange" && heimdallSettings.spokenSmodeChange ) {
            // this.log('Say:                    ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
         }
        if (type == "alarmCountdown" && heimdallSettings.spokenAlarmCountdown ) {
            // this.log('Say:                    ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "armCountdown" && heimdallSettings.spokenArmCountdown ) {
            // this.log('Say:                    ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "alarmChange" && heimdallSettings.spokenAlarmChange ) {
            // this.log('Say:                    ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "motionTrue" && heimdallSettings.spokenMotionTrue ) {
            // this.log('Say:                    ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "doorOpen" && heimdallSettings.spokenDoorOpen ) {
            // this.log('Say:                    ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "tamper" && heimdallSettings.spokenTamperTrue ) {
            // this.log('Say:                    ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }    
        if (type == "sensorActive") {
            // this.log('Say:                    ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
    }

    ttArmedCountdown(delay, color, value, logLine) {
        // this.log(' ttArmedCountdown:      ' + delay)
        if ( armCounterRunning ) {
            if (changeTta && delay > 9 ) {
                delay = 10;
                changeTta = false
                var prevLogLine = logLine      
                logLine = "st " + getDateTime() + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.smodedelaychanged")
                this.writeLog(logLine)
                logLine = prevLogLine
            }
            var tokens = { 'ArmedTimer': delay * 1};
            triggerTimeTillArmedChanged.trigger(tokens, function(err, result){
                if( err ) {
                    return Homey.error(err)} ;
                });
            if (delay > 9 ) {
                if (delay/5 == parseInt(delay/5)) {
                    this.speak("armCountdown", delay)
                }
            } 
            else if ( delay > 0 )  {
                this.speak("armCountdown", delay)
            }
            if ( delay > 0 ) {
                setTimeout(function(){
                    Homey.app.ttArmedCountdown(delay-1, color, value, logLine)
                }, 1000);
            }
            else if ( delay == 0) {
                this.setSurveillanceValue(color, value, logLine)
            }
        }
        else {
            console.log('ttArmedCountdown:       armCounterRunning = false')
            this.setSurveillanceValue(color, value, logLine)
        }
    }
    
    ttAlarmCountdown(delay,device,sensorStateReadable) {
        // this.log('ttAlarmCountdown:       ' + delay)
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        if ( surveillance != 'disarmed' ) {
            var tokens = { 'AlarmTimer': delay * 1};
            triggerTimeTillAlarmChanged.trigger(tokens, function(err, result){
                if( err ) {
                    return Homey.error(err)} ;
                });
            if (delay > 9 ) {
                if (delay/5 == parseInt(delay/5)) {
                    this.speak("alarmCountdown", delay)
                }
            } 
            else if ( delay > 0 )  {
                this.speak("alarmCountdown", delay)
            }
            if ( delay > 0 ) {
                setTimeout(function(){
                    Homey.app.ttAlarmCountdown(delay-1,device,sensorStateReadable)
                }, 1000);
            } 
            else if ( delay == 0) {
                alarmCounterRunning = false
                // this.log('alarmCounterRunning:    false due to reaching 0')
                this.activateAlarm(device, sensorStateReadable, "", "Heimdall")
            }
        }
        else {
            alarmCounterRunning = false
            // this.log('alarmCounterRunning:    false')
            // this.log('ttAlarmCountdown:       canceled due to disarm')
            this.activateAlarm(device, sensorStateReadable, "", "Heimdall")
        }
    }
}
module.exports = Heimdall;

Homey.ManagerSettings.on('set', (variable) => {
    if ( variable === 'settings' ) {
        heimdallSettings = Homey.ManagerSettings.get('settings')
        console.log('New settings:')
        console.log(heimdallSettings)
    }
});

// Flow card functions //////////////////////////////////////////////////////
// Flow triggers functions
triggerSurveillanceChanged
    .register()
    .on('run', ( args, callback ) => {
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
        if ( true ) {
            callback( null, true );
        }   
        else {
            callback( null, false );
        } 
    });

triggerAlarmDelayActivated
    .register()
    .on('run', ( args, callback ) => {
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
        if ( true ) {
            callback( null, true );
        }
        else {
            callback( null, false );
        }
    })

triggerNoInfoReceived
    .register()
    .on('run', ( args, callback ) => {
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
        Homey.app.writeLog(logLine)
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
        Homey.app.activateAlarm("",  "", "", "Flowcard")
        callback( null, true ); 
    });

actionDeactivateAlarm
    .register()
    .on('run', ( args, state, callback ) => {
        Homey.app.deactivateAlarm(true, "Flowcard")
        callback( null, true );
    });

/*
actionCheckLastCommunication
    .register()
    .on('run', ( args, state, callback ) => {
        Homey.app.checkDevicesLastCom(Homey.ManagerSettings.get('surveillanceStatus'))
        callback( null, true );
    });
*/

//  //////////////////////////////////////////////////////
// Should this device be logged
function isLogged(obj) {
    let devicesLogged = Homey.ManagerSettings.get('loggedDevices')
    let i;
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
    //Homey.app.getMonitoredFullDevices();
    let devicesMonitoredFull = Homey.ManagerSettings.get('monitoredFullDevices')
    let i;
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
    //Homey.app.getMonitoredPartialDevices();
    let devicesMonitoredPartial = Homey.ManagerSettings.get('monitoredPartialDevices')
    let i;
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
    //Homey.app.getDelayedDevices();
    let devicesDelayed = Homey.ManagerSettings.get('delayedDevices')
    let i;
    if ( devicesDelayed !== null) {
        for (i = 0; i < devicesDelayed.length; i++) {
            if (devicesDelayed[i] && devicesDelayed[i].id == obj.id) {
                return true;
            }
        }
    }
    return false;
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
    } else if (type == 'contact') {
        if ( sensorState ) {
            return Homey.__("states.open")
            //return 'Open'
        } else {
            return Homey.__("states.closed")
            //return 'Closed'
        }
    } else if (type == 'vibration') {
        if ( sensorState ) {
            return Homey.__("states.vibration")
            //return 'Vibration detected'
        } else {
            return Homey.__("states.novibration")
            //return 'No Vibration detected'
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

function getDateTime() {
    let date = new Date();
    let hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    let min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    let sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    let msec = ("00" + date.getMilliseconds()).slice(-3)
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    let day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return day + "-" + month + "-" + year + "  ||  " + hour + ":" + min + ":" + sec + "." + msec + "  ||  ";
}