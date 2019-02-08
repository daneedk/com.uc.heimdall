'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')
const delay = time => new Promise(res=>setTimeout(res,time));

// Flow triggers
let triggerSurveillanceChanged = new Homey.FlowCardTrigger('SurveillanceChanged');
let triggerSensorActiveAtArming = new Homey.FlowCardTrigger('sensorActiveAtArming');
let triggerSensorActive = new Homey.FlowCardTrigger('sensorActiveAtSensorCheck');
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
const actionCheckLastCommunication = new Homey.FlowCardAction('CheckLastCommunication');
const actionAllDevicesStateCheck = new Homey.FlowCardAction('DevicesStateCheck');
const actionInputNotification = new Homey.FlowCardAction('SendNotification');

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
    "notificationSmodeChange": false,
    "notificationAlarmChange": false,
    "notificationNoCommunicationMotion": false,
    "notificationNoCommunicationContact": false,
    "noCommunicationTime": 24
};
var sModeDevice;
var aModeDevice;
var armCounterRunning = false;
var alarmCounterRunning = false;
var lastDoor = false;
var changeTta = false;

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
        return await this.api.devices.getDevices();
    }

    async getZones() {
        const api = await this.getApi();
        return await this.api.zones.getZones();
    }

    async getZone(zoneId) {
        var result = "unknown";
        let allZones = await this.getZones();
        
        for (let zone in allZones) {
            if ( allZones[zone].id == zoneId ) {
                result = allZones[zone].name;
            }
        };
        return result;
    }

    async onInit() {
        this.log('init Heimdall')
        let nu = getDateTime();
        this.api = await this.getApi();

        surveillance = Homey.ManagerSettings.get('surveillanceStatus'); 
        this.log('Surveillance Mode:          ' + surveillance);
        let logLine = "ao " + nu + readableMode(surveillance) + " || Heimdall || Heimdall start"
        this.writeLog(logLine)
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
        };

        if ( heimdallSettings.noCommunicationTime == (null || undefined) || heimdallSettings.noCommunicationTime == 12 ) {
            heimdallSettings.noCommunicationTime = 24
        };
        this.enumerateDevices();
    }

    // Get all devices and add them
    async enumerateDevices() {
        // Get the homey object
        const api = await this.getApi();

        api.devices.on('device.create', async(id) => {
            await this.log('New device found!')
            var device = await this.waitForDevice(id)
            await this.addDevice(device);
        });

        api.devices.on('device.delete', async(id) => {
            await this.log('Device deleted!: ')
        });
        let allDevices = await this.getDevices();

        for (let id in allDevices) {
            var device = await this.waitForDevice(allDevices[id],0)
            if ( device ) {
                await this.addDevice(device);
            } 
        };
        this.log('Enumerating devices:        done.')
    }

    // Yolo function courtesy of Robert Klep ;)
    async waitForDevice(id, addCounter) {
        const device = await this.api.devices.getDevice({ id: id.id });
        if (device.ready) {
          return device;
        }
        await delay(1000);
        addCounter++;
        if ( addCounter < 10 ) {
            return this.waitForDevice(id,addCounter);
        } else {
            this.log("Found Device, not ready:    " + device.name)
            let nu = getDateTime();
            // let logLine = "al " + nu + readableMode(surveillance) + " || Enumerate Devices || " + device.name + " is not ready at Enumerating Devices"
            let logLine = "al " + nu + readableMode(surveillance) + " || " + Homey.__("enumerate.source") + " || " + device.name + Homey.__("enumerate.warning")
            this.writeLog(logLine)
            return false
        }
    }

    // Add device function, all device types with motion-, contact-, vibration- and tamper capabilities are added.
    addDevice(device) {
        // Find Surveillance Mode Switch
        if ( device.data.id === 'sMode' ) {
            sModeDevice = device;
            this.log('Found Mode Switch named:    ' + device.name)
        }
        // Find Alarm Off Button
        if ( device.data.id === 'aMode' ) { 
            aModeDevice = device;
            this.log('Found Alarm Button named:   ' + device.name)
        }
        if ( 'alarm_motion' in device.capabilitiesObj ) {
            this.log('Found motion sensor:        ' + device.name)
            this.attachEventListener(device,'motion')
        }
        if ( 'alarm_contact' in device.capabilitiesObj ) {
            this.log('Found contact sensor:       ' + device.name)
            this.attachEventListener(device,'contact')
        }
        if ( 'alarm_vibration' in device.capabilitiesObj ) {
            this.log('Found vibration sensor:     ' + device.name)
            this.attachEventListener(device,'vibration')
        }
        if ( 'alarm_tamper' in device.capabilitiesObj ) {
            this.log('Found tamper sensor:        ' + device.name)
            this.attachEventListener(device,'tamper')
        }
    }

    attachEventListener(device,sensorType) {
        switch (sensorType) {
            case "motion":
                device.makeCapabilityInstance('alarm_motion',function(device, state) {
                    this.stateChange(device,state,sensorType)
                }.bind(this, device));
                break;
            case "contact":
                device.makeCapabilityInstance('alarm_contact',function(device, state) {
                    this.stateChange(device,state,sensorType)
                }.bind(this, device));
                break;
            case "vibration":
                device.makeCapabilityInstance('alarm_vibration',function(device, state) {
                    this.stateChange(device,state,sensorType)
                }.bind(this, device));
                break;
            case "tamper": 
                device.makeCapabilityInstance('alarm_tamper',function(device, state) {
                    this.stateChange(device,state,sensorType)
                }.bind(this, device));
                break;
        }
    
        let monFull = "", monPartial = "", monLogged = ""
        if ( isMonitoredFull(device) ) {
            monFull = ", Fully Monitored"
        } 
        if ( isMonitoredPartial(device) ) {
            monPartial = ", Partially Monitored"
        }
        if ( isLogged(device) ) {
            monLogged = ", Logged"
        }
        this.log('Attached Eventlistener to:  ' + device.name + ': ' + sensorType + monFull + monPartial + monLogged)
    }

    // this function gets called when a device with an attached eventlistener fires an event.
    async stateChange(device,sensorState,sensorType) {
        if ( sensorType == 'tamper' && !heimdallSettings.useTampering ) {
            this.log("StateChange detected for tampering but shouldn't act on it")
            return
        }
        let nu = getDateTime();
        let color = "   ";
        let logLine;
        let sourceDeviceFull = isMonitoredFull(device)
        let sourceDevicePartial = isMonitoredPartial(device)
        let sourceDeviceLog = isLogged(device)

        console.log('-----------------------------------------------')
        this.log('stateChange:                ' + device.name)
        this.log('sourceDeviceFull:           ' + sourceDeviceFull)
        this.log('sourceDevicePartial:        ' + sourceDevicePartial)
        this.log('sourceDeviceLog:            ' + sourceDeviceLog)
        // is the device monitored?
        if ( sourceDeviceFull || sourceDevicePartial || sourceDeviceLog ) {
            this.log('Full||Partial||Log:         Yes')
            let sensorStateReadable;
            surveillance = Homey.ManagerSettings.get('surveillanceStatus');
            sensorStateReadable = readableState(sensorState, sensorType)
            this.log('sensorStateReadable:        ' + sensorStateReadable)

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
                    this.log('lastDoor:               Opened')
                    lastDoor = true;
                }
                // is there no delayed trigger and Alarm state active?
                if ( !alarmCounterRunning && !alarm) {
                    if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                        this.log('Alarm is triggered:         Yes')
                        let zone = await this.getZone(device.zone)
                        logLine = "al " + nu + readableMode(surveillance) + " || Heimdall || " + device.name + " in " + zone + Homey.__("history.triggerdalarm")

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
                            this.log('alarmCounterRunning:        true')
                            logLine = "ad "+ nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.alarmdelayed") + heimdallSettings.alarmDelay + Homey.__("history.seconds") + '\n' + logLine
                            let delay = heimdallSettings.alarmDelay * 1000;
                            // Trigger delay flow card
                            var tokens= { 'Reason': device.name + ': '+ sensorStateReadable , 'Duration': heimdallSettings.alarmDelay * 1 };
                            triggerAlarmDelayActivated.trigger(tokens, function(err, result){
                                if( err ) {
                                    return Homey.error(err)} ;
                                });
                            this.log('alarmCounterRunning:        true')
                            this.log('alarm is delayed:           Yes, ' + heimdallSettings.alarmDelay + ' seconden')
                            //speak("The alarm will go off in " + heimdallSettings.alarmDelay + " seconds.")
                            this.speak("alarmCountdown", Homey.__("speech.startalarmcountdown") + heimdallSettings.alarmDelay + Homey.__("speech.seconds"))
                            this.log('ttAlarmCountdown start:     ' + heimdallSettings.alarmDelay)
                            // Trigger Time Till Alarm flow card
                            let tta = heimdallSettings.alarmDelay - 1;
                            this.ttAlarmCountdown(tta, device,sensorStateReadable);
                        } 
                        else {
                            this.log('Trigger is delayed:         No')
                            this.activateAlarm(device, sensorStateReadable, nu, "Heimdall");
                        }
                    }
                    else {
                        this.log('Alarm is triggered:         No')
                    }
                
                }
                else if ( alarmCounterRunning ) {
                    // Delayed trigger is active
                    if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                        this.log('alarmCounterRunning:        true so sensorstate true is cancelled')
                        logLine = color + nu + readableMode(surveillance) + " || Heimdall || " + device.name + ": " + sensorStateReadable + Homey.__("history.noalarmtriggercountdown");
                    }
                } 
                else if ( alarm ) {
                    // Alarm state is active
                    if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                        this.log('Alarmstate Active:          The Alarm State is active so just log the sensorstate')
                        logLine = color + nu + readableMode(surveillance) + " || Heimdall || " + device.name + ": " + sensorStateReadable + Homey.__("history.noalarmtriggeralarmstate");
                        let zone = await this.getZone(device.zone)
                        var tokens = {'Zone': zone, 'Device': device.name, 'State': sensorStateReadable};
                        triggerSensorTrippedInAlarmstate.trigger(tokens, function(err, result){
                            if( err ) {
                                return Homey.error(err)} ;
                            });
                    }
                }
            } 
            else {
            // sensorState is false    
                if ( sensorType='contact' && isDelayed(device) && armCounterRunning && lastDoor ) {
                    // a Doorsensor with a delay is opened and closed while the arming countdown is running
                    this.log('lastDoor:                   Closed, countdown will be lowered')
                    changeTta = true;
                }
            }

            let shouldLog = true;
            this.log('logArmedOnly:               ' + heimdallSettings.logArmedOnly + ', Surveillance Mode: ' + surveillance)
            this.log('logTrueOnly:                ' + heimdallSettings.logTrueOnly + ', Sensorstate: ' + sensorState)
            if ( heimdallSettings.logArmedOnly && surveillance === 'disarmed' && !sourceDeviceLog)  {
                shouldLog = false;
                this.log('LogArmedOnly is true and Surveillance is off, so no log line')
            }
            if ( heimdallSettings.logTrueOnly && !sensorState && !sourceDeviceLog ) {
                shouldLog = false;
                this.log('logTrueOnly is true and sensorstate is false, so no log line')
            }
            if ( shouldLog ) {
                this.writeLog(logLine)        
            }
            if ( sourceDeviceLog ) {
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
        this.log('setSurveillanceMode:        ' + value);
        let nu = getDateTime();
        let logLine
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        if ( value == 'disarmed' ) {
            logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodedisarmed")
            this.setSurveillanceValue("sd ",value, logLine)
            Homey.app.deactivateAlarm(false, Homey.__("devices.surveillancemode.name"))
            if ( armCounterRunning ) {
                // code to cancel an arm command during delayArming
                this.log('Need to stop arming!')
                armCounterRunning = false;
            }
        } else {
            if ( value == 'armed' ) {
                logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodearmed")
            } else { 
                logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodepartiallyarmed")
            }
            if ( (value == 'armed' && heimdallSettings.delayArmingFull) || (value == 'partially_armed' && heimdallSettings.delayArmingPartial )  ) {
                this.log('Arming is delayed:          Yes, ' + heimdallSettings.armingDelay + ' seconds.')
                if ( armCounterRunning ) {
                    this.log('Armingdelay already active: Not starting a new one')
                    return
                }
                let delay = heimdallSettings.armingDelay * 1000;
                this.log('setSurveillanceValue in:' + heimdallSettings.armingDelay + ' seconds.')
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
                this.log('Arming is delayed:          No')
                armCounterRunning = true;
                this.setSurveillanceValue("sa ",value, logLine)
            }
            if ( value === 'armed' || value === 'partially_armed' ) {
                Homey.app.checkDevicesLastCom(value)
            }
        }
    }

    async checkDevicesState(value, nu) {
        let allDevices = await this.getDevices()
        for (let device in allDevices) {
            this.checkDeviceState(allDevices[device], value, nu)
        };
    }

    async checkDevicesLastCom(value) {
        let allDevices = await this.getDevices()
        for (let device in allDevices) {
            this.checkDeviceLastCom(allDevices[device], value)
        };
    }

    async checkAllDevicesState() {
        let allDevices = await this.getDevices()
        for (let device in allDevices) {
            this.checkAllDeviceState(allDevices[device])
        };
    }

    checkDeviceState(device, value, nu) {
        let sensorState
        let sensorStateReadable
        let sensorType
        if ( 'alarm_motion' in device.capabilitiesObj && heimdallSettings.checkMotionAtArming ) {
            sensorState = device.capabilitiesObj.alarm_motion.value
            sensorStateReadable = readableState(sensorState, 'motion')
            sensorType = 'motion'
            this.log("checkDeviceState:           " + device.name + " - " + sensorType + ": " + sensorStateReadable)
        }
        if ( 'alarm_contact' in device.capabilitiesObj && heimdallSettings.checkContactAtArming ) {
            sensorState = device.capabilitiesObj.alarm_contact.value
            sensorStateReadable = readableState(sensorState, 'contact')
            sensorType = 'contact'
            this.log("checkDeviceState:           " + device.name + " - " + sensorType + ": " + sensorStateReadable)
        };
        if ( value == 'armed') {
            if ( isMonitoredFull(device) ) {
                if ( sensorState ) {
                    let delayText = ""
                    if ( isDelayed(device) ) {
                        delayText = Homey.__("atarming.delayText")
                    }
                    if ( sensorType == 'motion' ) {
                        this.alertSensorActiveAtArming(value, nu, sensorType, Homey.__("atarming.warningMotion") + sensorStateReadable + Homey.__("atarming.on") + device.name + delayText)
                    } else if ( sensorType == 'contact') {
                        this.alertSensorActiveAtArming(value, nu, sensorType, Homey.__("atarming.warningContact") + device.name + Homey.__("atarming.is") + sensorStateReadable + delayText) 
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
                        this.alertSensorActiveAtArming(value, nu, sensorType, Homey.__("atarming.warningMotion") + sensorStateReadable + Homey.__("atarming.on") + device.name + delayText)
                    } else if ( sensorType == 'contact' ) {
                        this.alertSensorActiveAtArming(value, nu, sensorType, Homey.__("atarming.warningContact") + device.name + Homey.__("atarming.is") + sensorStateReadable + delayText) 
                    }
                }
            }
        }
    }

    async checkDeviceLastCom(device, value) {
        if ( isMonitoredFull(device) || isMonitoredPartial(device) ) {
            let nu = getDateTime();
            let nuEpoch = Date.now();

            // this.log("checkDeviceLastCom:         " + device.name)

            if ( 'alarm_motion' in device.capabilitiesObj || 'alarm_contact' in device.capabilitiesObj ) {
                let mostRecentComE = 0

                for ( let capability in device.capabilitiesObj ) {
                    //console.log("datum: " + device.capabilitiesObj[capability].lastUpdated)
                    let lu = Date.parse(device.capabilitiesObj[capability].lastUpdated)

                    if ( lu > mostRecentComE  ) {
                        mostRecentComE = lu
                    }
                    //console.log(mostRecentComE)
                }

                let mostRecentComH = new Date( mostRecentComE )
                let verschil = Math.round((nuEpoch - mostRecentComE)/1000)
                
                // console.log("resultaat: " + nuEpoch)
                // console.log("resultaat: " + mostRecentComE)
                // console.log("resultaat: " + verschil)
                // console.log("resultaat: " + verschil*1000)
                // console.log("resultaat: " + heimdallSettings.noCommunicationTime * 3600)
                
                if ( verschil > heimdallSettings.noCommunicationTime * 3600 ) {
                    let d = new Date(0);
                    d.setUTCSeconds(Date.parse(mostRecentComH)/1000);
                    let lastUpdateTime = d.toLocaleString();

                    let tempColor = 'mp-'
                    let zone = await this.getZone(device.zone)
                    let tempLogLine = tempColor + nu + readableMode(value) + " || Heimdall || " + device.name + " in " + zone + Homey.__("history.noreport") + heimdallSettings.noCommunicationTime + Homey.__("history.lastreport") + lastUpdateTime
                    this.writeLog(tempLogLine)
                    this.log("checkDeviceLastCom:         " + device.name + " - did not communicate in last 24 hours")
                    if ( heimdallSettings.notificationNoCommunicationMotion && 'alarm_motion' in device.capabilitiesObj ) {
                        let message = '**' + device.name + '** in ' + zone + Homey.__("history.noreport") + heimdallSettings.noCommunicationTime + Homey.__("history.lastreport") + lastUpdateTime
                        this.writeNotification(message)
                    }
                    if ( heimdallSettings.notificationNoCommunicationContact && 'alarm_contact' in device.capabilitiesObj ) {
                        let message = '**' + device.name + '** in ' + zone + Homey.__("history.noreport") + heimdallSettings.noCommunicationTime + Homey.__("history.lastreport") + lastUpdateTime
                        this.writeNotification(message)
                    }

                    var tokens = {'Zone': zone, 'Device': device.name, 'LastUpdate': lastUpdateTime, 'Duration': heimdallSettings.noCommunicationTime};
                    triggerNoInfoReceived.trigger(tokens, function(err, result){
                        if( err ) {
                            return Homey.error(err)} ;
                        });
                } else {
                    this.log("checkDeviceLastCom:         " + device.name + " - communicated in last 24 hours")
                }
            }
        }
    }

    checkAllDeviceState(device) {
        let sensorState = false
        let sensorStateReadable
        let sensorType
        if ( 'alarm_motion' in device.capabilitiesObj ) {
            sensorState = device.capabilitiesObj.alarm_motion.value
            sensorStateReadable = readableState(sensorState, 'motion')
            sensorType = 'Motion'
            this.log("checkAllDeviceState:        " + device.name + " - " + sensorType + ": " + sensorStateReadable)
        }
        if ( 'alarm_contact' in device.capabilitiesObj ) {
            sensorState = device.capabilitiesObj.alarm_contact.value
            sensorStateReadable = readableState(sensorState, 'contact')
            sensorType = 'Contact'
            this.log("checkAllDeviceState:        " + device.name + " - " + sensorType + ": " + sensorStateReadable)
        };
        if ( sensorState ) {
            this.alertSensorActive (device, sensorType, sensorStateReadable)
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
            this.logRealtime("Surveillance Mode", value)
            //speak("sModeChange", "The surveillance mode is set to " + readableMode(value)) 
            this.speak("sModeChange", Homey.__("speech.smodeset") + readableMode(value))
            this.log('setSurveillanceValue:       '+ value)
            if ( heimdallSettings.notificationSmodeChange ) {
                let message = '**Surveillance Mode** set to ' + readableMode(value)
                this.writeNotification(message)
            }
            var tokens = { 'mode': readableMode(value) };
            triggerSurveillanceChanged.trigger(tokens, function(err, result){
                if( err ) {
                    return Homey.error(err)} ;
                } );
            // check the states of the sensors 
            if ( value != 'disarmed' && !heimdallSettings.checkBeforeCountdown ) {
                Homey.app.checkDevicesState(value, nu)
            }
        } else {
            logLine = "sd " + nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.smodechangedisabled")
        }
        this.writeLog(logLine)   
        armCounterRunning = false;
    }

    async activateAlarm(device,sensorState,nu,source) {
        if ( nu == "" ) { 
            nu = getDateTime()
        }
        let logLine;
        alarm=true;
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        if ( surveillance != 'disarmed' || source == "Flowcard" ) {
            // Surveillance mode is active
            let zone = await this.getZone(device.zone)
            if ( source == "Heimdall") {
                // let zone = await this.getZone(device.zone)
                var tokens= {'Reason': device.name + ': '+ sensorState , 'Zone': zone };
                logLine = "al " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmactivated") + device.name + ": " + sensorState;
            } else {
                var tokens= {'Reason': 'Flowcard' , 'Zone': "" };
                logLine = "al " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmactivatedflowcard");
            }
            triggerAlarmActivated.trigger(tokens, function(err, result){
                if( err ) {
                    return Homey.error(err)} ;
                });
            if ( heimdallSettings.notificationAlarmChange  ) {
                let message = '**'+device.name+'** in '+ zone + Homey.__("history.triggerdalarm")
                this.writeNotification(message)
            }

            // speak("alarmChange", "The alarm is activated") 
            this.speak("alarmChange", Homey.__("speech.alarmactivated"))
            // save alarm status
            Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
                if( err ) return Homey.alert( err );
            });
            // Check if Alarm Off Button exists and turn on 
            if ( aModeDevice != undefined) {
                this.log("aModeDevice alarm_heimdall: activated")
                aModeDevice.setCapabilityValue('alarm_heimdall', true)
            }
            if ( sModeDevice != undefined) {
                this.log("sModeDevice alarm_heimdall: activated")
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
        this.logRealtime("Alarm Status", alarm)
    }

    alertSensorActiveAtArming ( value, nu, sensorType, warningText ) {
        // write log
        let color = 'm' + value.substring(0,1) + '-'
        let logLine = color + nu + readableMode(value) + " || Heimdall || " + warningText
        this.writeLog(logLine)
        // activate triggercard
        var tokens = { 'warning': warningText };
        triggerSensorActiveAtArming.trigger(tokens, function(err, result){
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

    async alertSensorActive ( device, sensorType, sensorstateReadable ) {
        let zone = await this.getZone(device.zone)
        var tokens = { 'Device': device.name, 'Device type': sensorType, 'Zone': zone, 'State': sensorstateReadable}
        triggerSensorActive.trigger(tokens, function(err, result){
            if( err ) {
                return Homey.error(err)} ;
            } );
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
                if ( err ) {
                    return Homey.error(err)} ;
                }); 
            let logLine = "ao "+ nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmdeactivated") + source
            this.writeLog(logLine)
            if ( heimdallSettings.notificationAlarmChange ) {
                let message = Homey.__("history.alarmdeactivated") + '**' + source + '**'
                this.writeNotification(message)
            }
        }
    }

    // Write information to history and cleanup 20% when history above 2000 lines
    async writeLog(logLine) {
        // console.log(logLine);
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
        logLine = "";
    }

    async writeNotification(message) {
        var notification = new Homey.Notification({ excerpt: message });
        notification.register();
    }

    async speak(type, text) {
        if (type == "sModeChange" && heimdallSettings.spokenSmodeChange ) {
            this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
         }
        if (type == "alarmCountdown" && heimdallSettings.spokenAlarmCountdown ) {
            this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "armCountdown" && heimdallSettings.spokenArmCountdown ) {
            this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "alarmChange" && heimdallSettings.spokenAlarmChange ) {
            this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "motionTrue" && heimdallSettings.spokenMotionTrue ) {
            this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "doorOpen" && heimdallSettings.spokenDoorOpen ) {
            this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "tamper" && heimdallSettings.spokenTamperTrue ) {
            this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }    
        if (type == "sensorActive") {
            this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
    }

    ttArmedCountdown(delay, color, value, logLine) {
        this.log('ttArmedCountdown:           ' + delay)
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
            this.log('ttArmedCountdown:           armCounterRunning = false')
            this.setSurveillanceValue(color, value, logLine)
        }
    }
    
    ttAlarmCountdown(delay,device,sensorStateReadable) {
        this.log('ttAlarmCountdown:       ' + delay)
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
                this.log('alarmCounterRunning:    false due to reaching 0')
                this.activateAlarm(device, sensorStateReadable, "", "Heimdall")
            }
        }
        else {
            alarmCounterRunning = false
            this.log('alarmCounterRunning:    false')
            this.log('ttAlarmCountdown:       canceled due to disarm')
            this.activateAlarm(device, sensorStateReadable, "", "Heimdall")
        }
    }

    logRealtime(event, details)
    {
        Homey.ManagerApi.realtime(event, details)
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

triggerSensorActiveAtArming
    .register()
    .on('run', ( args, callback ) => {
        if ( true ) {
            callback( null, true );
        }   
        else {
            callback( null, false );
        } 
    });

triggerSensorActive
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
        // console.log('actionClearHistory: The history data is cleared.');
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

actionCheckLastCommunication
    .register()
    .on('run', ( args, state, callback ) => {
        Homey.app.checkDevicesLastCom(Homey.ManagerSettings.get('surveillanceStatus'))
        callback( null, true );
    });

actionAllDevicesStateCheck
    .register()
    .on('run', ( args, state, callback ) => {
        Homey.app.checkAllDevicesState()
        callback( null, true );
    });

//Flow actions functions
actionInputNotification
    .register()
    .on('run', ( args, state, callback ) => {
        Homey.app.writeNotification(args.message)
        callback( null, true );
    });

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