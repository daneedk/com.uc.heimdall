'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')
const delay = time => new Promise(res=>setTimeout(res,time));

// Flow triggers
let triggerSurveillanceChanged = new Homey.FlowCardTrigger('SurveillanceChanged');
// let triggerSurveillanceChanged = this.homey.flow.getDeviceTriggerCard('SurveillanceChanged');

let triggerSensorActiveAtArming = new Homey.FlowCardTrigger('sensorActiveAtArming');
let triggerSensorActive = new Homey.FlowCardTrigger('sensorActiveAtSensorCheck');
let triggerAlarmActivated = new Homey.FlowCardTrigger('AlarmActivated');
let triggerAlarmDeactivated = new Homey.FlowCardTrigger('AlarmDeactivated');
let triggerAlarmDelayActivated = new Homey.FlowCardTrigger('AlarmDelayActivated');
let triggerArmDelayActivated = new Homey.FlowCardTrigger('ArmDelayActivated');
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
const conditionIsDelayedDevice = new Homey.FlowCardCondition('IsDelayedDevice');
const conditionIsLoggedDevice = new Homey.FlowCardCondition('IsLoggedDevice');
const conditionIsFullDevice = new Homey.FlowCardCondition('IsFullDevice');
const conditionIsPartialDevice = new Homey.FlowCardCondition('IsPartialDevice');

// Flow actions
const actionInputHistory = new Homey.FlowCardAction('SendInfo');
const actionClearHistory = new Homey.FlowCardAction('ClearHistory');
const actionActivateAlarm = new Homey.FlowCardAction('ActivateAlarm');
const actionDeactivateAlarm = new Homey.FlowCardAction('DeactivateAlarm');
const actionCheckLastCommunication = new Homey.FlowCardAction('CheckLastCommunication');
const actionAllDevicesStateCheck = new Homey.FlowCardAction('DevicesStateCheck');
const actionInputNotification = new Homey.FlowCardAction('SendNotification');
const actionAddDelayToDevice = new Homey.FlowCardAction('AddDelayToDevice');
const actionRemoveDelayFromDevice = new Homey.FlowCardAction('RemoveDelayFromDevice');
const actionAddLoggingToDevice = new Homey.FlowCardAction('AddLoggingToDevice');
const actionRemoveLoggingFromDevice = new Homey.FlowCardAction('RemoveLoggingFromDevice');
const actionAddDeviceToPartial = new Homey.FlowCardAction('AddDeviceToPartial');
const actionRemoveDeviceFromPartial = new Homey.FlowCardAction('RemoveDeviceFromPartial');
const actionAddDeviceToFull = new Homey.FlowCardAction('AddDeviceToFull');
const actionRemoveDeviceFromFull = new Homey.FlowCardAction('RemoveDeviceFromFull');

/* // SDKv3 
this.actionInputNotification = this.homey.flow.getActionCard('SendNotification');
this.actionInputNotification
  .registerRunListener( async(args, state ) => {
      this.writeNotification(args.message)
      return Promise.resolve( true );
  })
*/

var surveillance;
var alarm = false;
var heimdallSettings = [];
var defaultSettings = {
    "armingDelay": "30",
    "alarmDelay": "30",
    "delayArmingFull": false,
    "delayArmingPartial": false,
    "alarmWhileDelayed": false,
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
var devicesNotReadyAtStart = [];
var devicesNotReady = [];

var testUsers = [
    { "id":0, "name": "Danee1", "pincode": "123456", "admin": true, "valid": true },
    { "id":1, "name": "Danee2", "pincode": "654321", "admin": false, "valid": false },
    { "id":2, "name": "Danee3", "pincode": "000000", "admin": false, "valid": true }
];

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
        return await api.devices.getDevices();
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

    async processKeypadCommands(post,type) {
        if ( checkAPIKEY(post.body.APIKEY) ) {
            let nu = getDateTime();
            let logLine = "";

            if ( type == "action") {
                let userObject = this.getUserInfo(post.body.value, this.users);
                if ( userObject["valid"]) {
                    logLine = "   " + nu + readableMode(surveillance) + " || " + post.body.diagnostics.sourceApp + " || " +userObject["name"] + " entered a valid code and pressed " + post.body.actionReadable + " on " + post.body.diagnostics.sourceDevice;
                    this.writeLog(logLine);
                    if ( post.body.action == "armed" || post.body.action == "disarmed" || post.body.action == "partially_armed" ) {
                        this.setSurveillanceMode(post.body.action, post.body.diagnostics.sourceDevice);
                        return "Found user, changed Surveillance Mode to " + post.body.action
                    } else if ( post.body.action == "enter" ) {
                        // TODO

                        return "Found user, action is Enter"
                    } else if ( post.body.action == "cancel") {
                        // TODO

                        return "Found user, action is Cancel"
                    } else {
                        return "Found user, action " + post.body.action + " is unknown"
                    }
                    
                } else {
                    logLine = "ad " + nu + readableMode(surveillance) + " || " + post.body.diagnostics.sourceApp + " || an invalid code was entered before pressing " + post.body.actionReadable + " on " + post.body.diagnostics.sourceDevice;
                    this.writeLog(logLine);

                    this.log("Invalid code entered: " + userObject["pincode"])
                    if ( post.body.value.length > 0 ) {
                        return "Invalid code entered. Logline written, no further action"
                    } else {
                        return "No code entered. Logline written, no further action"
                    }
                }
            } else if ( type == "battery") {

            }
            
        } else {
            return "Heimdall: APIKEY error"
        }
    }

    async onInit() {
        this.log(`${Homey.manifest.id} ${Homey.manifest.version} initialising --------------`)
        let nu = getDateTime();
        this.api = await this.getApi();

    //  // test test test test
    this.users = testUsers
    //  // /test test test test

        Homey.ManagerSettings.on('set', (key) => {
            if (key === 'codeString') {
                
                let codeString = Homey.ManagerSettings.get('codeString');
                if (codeString == null) return
                let result = this.getUserInfo(codeString, this.users);
                if ( result.admin ){
                    result = this.users;
                } else if ( !result.valid ) {
                    result = null;
                } else {
                    console.log("single user");
                    result = [result];
                };
                Homey.ManagerSettings.set('transferUsers', result, function( err ){
                    if ( err ) return Homey.alert( err );
                });
                Homey.ManagerSettings.set('codeString', null, function( err ){
                    if ( err ) return Homey.alert( err );
                });
            }
        });

        surveillance = Homey.ManagerSettings.get('surveillanceStatus'); 
        this.log('Surveillance Mode:          ' + surveillance);
        let logLine = "ao " + nu + readableMode(surveillance) + " || Heimdall || Heimdall start"
        this.writeLog(logLine)
        if ( surveillance == null ) {
            surveillance = 'disarmed'
        };

        this.log('Reading settings:           start')
        
        heimdallSettings = Homey.ManagerSettings.get('settings');
		if ( heimdallSettings == (null || undefined) ) {
			heimdallSettings = defaultSettings
        };

        if ( heimdallSettings.armingDelay == (null || undefined) ) {
            heimdallSettings.armingDelay = heimdallSettings.triggerDelay
            heimdallSettings.alarmDelay = heimdallSettings.triggerDelay
        };

        if ( heimdallSettings.noCommunicationTime == (null || undefined) || heimdallSettings.noCommunicationTime == 12 ) {
            heimdallSettings.noCommunicationTime = 24
        };

        if ( heimdallSettings.alarmWhileDelayed == (null || undefined) ) {
            heimdallSettings.alarmWhileDelayed = false
        };

        let language = Homey.ManagerI18n.getLanguage()
        Homey.ManagerSettings.set('language', language, function( err ){
            if ( err ) return Homey.alert( err );
        });

        this.log('Reading settings:           done')

        this.enumerateDevices();
    }

    // Get all devices and add them
    async enumerateDevices() {

        this.log('Enumerating devices:        start')

        // Get the homey object
        const api = await this.getApi();

        api.devices.on('device.create', async(id) => {
            this.log('New device found!')
            var device = await this.waitForDevice(id,0)
            if ( device ) {
                await this.addDevice(device);
            }
        });

        api.devices.on('device.delete', async(id) => {
            // await this.log('Device deleted!: ')
        });

        let allDevices = await this.getDevices();

        for (let id in allDevices) {
            var device = await this.waitForDevice(allDevices[id],0)
            if ( device ) {
                await this.addDevice(device);
            } 
        };
        this.log('Enumerating devices:        done')
        this.log('Heimdall ready for action   ----------------------')
    }

    // Yolo function courtesy of Robert Klep ;)
    async waitForDevice(id, addCounter) {
        const device = await this.api.devices.getDevice({ id: id.id });
        if (device.ready) {
          return device;
        }
        await delay(1000);
        addCounter++;
        if ( addCounter < 12 ) {
            return this.waitForDevice(id,addCounter);
        } else {
            this.log("Found Device, not ready:    " + device.name)
            devicesNotReadyAtStart.push(device.name)
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
        // this.log('Attached Eventlistener to:  ' + device.name + ': ' + sensorType + monFull + monPartial + monLogged)
    }

    // this returns the devices that can be used as sensors
    // Motion, Contact and Vibration
    async getUsableDevices () {
        var usableDevices = []
        let allDevices = await this.getDevices();

        for (let id in allDevices) {
            var device = allDevices[id]
            for ( let cap in device.capabilities ) {
                if ( [ "alarm_motion", "alarm_contact", "alarm_vibration" ].includes( device.capabilities[cap] ) ) {                    
                    // var temp = {'name':device.zoneName + " - " + device.name}
                    usableDevices.push(device)
                }
            }   
        };
        return usableDevices
    }

    // this function gets called when a device with an attached eventlistener fires an event.
    async stateChange(device,sensorState,sensorType) {
        if ( sensorType == 'tamper' && !heimdallSettings.useTampering ) {
            this.log("StateChange detected for tampering but shouldn't act on it")
            return
        }
        let nu = getDateTime();
        let color = "   ";
        let logLine = "";
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
            this.log('sensorState:                '+ sensorState)
            // Is sensorState true?
            if ( sensorState ) {
                if (sensorType='contact' && isDelayed(device) && armCounterRunning) {
                    // a Doorsensor with a delay is opened while the arming countdown is running
                    this.log('lastDoor:               Opened')
                    lastDoor = true;
                }
                // Is there no Alarm state active and no delayed trigger?
                // or
                // is there no Alarm state active, but a delayed trigger is true and heimdallSettings.alarmWhileDelayed is true
                if ( (!alarm && !alarmCounterRunning) || (!alarm && alarmCounterRunning && heimdallSettings.alarmWhileDelayed ) ) {
                // if ( !alarm && !alarmCounterRunning ) {
                    if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                        this.log('Alarm is triggered:         Yes')
                        // let zone = await this.getZone(device.zone)
                        let delayOverruled = ".";
                        if ( alarmCounterRunning && !isDelayed(device) ) {
                            this.log('Alarm counter active:       Yes');
                            alarmCounterRunning = false;
                            delayOverruled = Homey.__("history.delayoverruled");
                        } 

                        logLine = "al " + nu + readableMode(surveillance) + " || Heimdall || " + device.name + " in " + device.zoneName + Homey.__("history.triggerdalarm") + delayOverruled

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
                            if ( alarmCounterRunning ) {
                                this.log("Device is delayed and there is already an Alarm Counter active.")
                                return
                            }
                            // The device has a delayed trigger
                            alarmCounterRunning = true;
                            this.log('alarmCounterRunning:        true')
                            logLine = "ad "+ nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.alarmdelayed") + heimdallSettings.alarmDelay + Homey.__("history.seconds") + '\n' + logLine
                            let delay = heimdallSettings.alarmDelay * 1000;
                            // Trigger delay flow card
                            var tokens= { 'Reason': device.name + ': '+ sensorStateReadable , 'Duration': heimdallSettings.alarmDelay * 1 };
                            triggerAlarmDelayActivated.trigger(tokens)
                                .catch(this.error)
                                .then()

                            this.log('alarmCounterRunning:        true')
                            this.log('alarm is delayed:           Yes, ' + heimdallSettings.alarmDelay + ' seconden')
                            //speak("The alarm will go off in " + heimdallSettings.alarmDelay + " seconds.")
                            this.speak("alarmCountdown", Homey.__("speech.startalarmcountdown") + heimdallSettings.alarmDelay + Homey.__("speech.seconds"))
                            this.log('ttAlarmCountdown start:     ' + heimdallSettings.alarmDelay)
                            // Trigger Time Till Alarm flow card
                            let tta = heimdallSettings.alarmDelay - 1;
                            this.ttAlarmCountdown(tta, device,sensorStateReadable);
                            // Generate Homey wide event for starting the Alarm Delay
                            this.logRealtime("Alarm Delay", tta + 1);
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
                        this.log('alarmCounterRunning:        True so sensorstate true is cancelled')
                        logLine = color + nu + readableMode(surveillance) + " || Heimdall || " + device.name + ": " + sensorStateReadable + Homey.__("history.noalarmtriggercountdown");
                    }
                } 
                else if ( alarm ) {
                    // Alarm state is active
                    if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                        this.log('Alarmstate Active:          The Alarm State is active so just log the sensorstate')
                        logLine = color + nu + readableMode(surveillance) + " || Heimdall || " + device.name + ": " + sensorStateReadable + Homey.__("history.noalarmtriggeralarmstate");
                        // let zone = await this.getZone(device.zone)
                        var tokens = {'Zone': device.zoneName, 'Device': device.name, 'State': sensorStateReadable};
                        triggerSensorTrippedInAlarmstate.trigger(tokens)
                            .catch(this.error)
                            .then()
                    }
                }
            } 
            else {
            // sensorState is false    
                if ( sensorType='contact' && isDelayed(device) && armCounterRunning && lastDoor ) {
                    // a Doorsensor with a delay is opened and closed while the arming countdown is running
                    this.log('lastDoor:                   Closed, countdown will be lowered')
                    changeTta = true;
                    // Generate Homey wide event for Last Door Function
                    this.logRealtime( "Last Door function","Activated" );
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
                // let zone = await this.getZone(device.zone)
                var tokens = {'Zone': device.zoneName, 'Device': device.name, 'State': sensorStateReadable};
                triggerLogLineWritten.trigger(tokens)
                    .catch(this.error)
                    .then()
            }
        }
    }

    // sets Surveillance Mode, called from Surveillance Mode Device, will call setSurveillanceValue after evaluating conditions.
    setSurveillanceMode(value, source) {
        this.log('setSurveillanceMode:        ' + value);
        let nu = getDateTime();
        let logLine = "";
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        if ( value === 'disarmed' ) {
            logLine = readableMode(value) + " || " + source + " || " + Homey.__("history.smodedisarmed")
            this.setSurveillanceValue("sd ",value, logLine, false)
            Homey.app.deactivateAlarm(false, Homey.__("devices.surveillancemode.name"))
            if ( armCounterRunning ) {
                // code to cancel an arm command during delayArming
                this.log('Need to stop arming!')
                armCounterRunning = false;
            }
        } else {
            if ( value === 'armed' ) {
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
                this.log('setSurveillanceValue in:    ' + heimdallSettings.armingDelay + ' seconds.')
                this.speak("armCountdown", Homey.__("speech.startarmcountdown") + readableMode(value) + Homey.__("speech.in") + heimdallSettings.armingDelay + Homey.__("speech.seconds"))
                armCounterRunning = true;
                let tta = heimdallSettings.armingDelay;
                this.ttArmedCountdown(tta,"sa ", value, logLine);

                var tokens= { 'Duration': heimdallSettings.armingDelay * 1 };
                triggerArmDelayActivated.trigger(tokens)
                    .catch(this.error)
                    .then()
                
                // Generate Homey wide event for starting the Arming Delay
                this.logRealtime("Arming Delay", tta);

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
                this.setSurveillanceValue("sa ",value, logLine, true)
            }
            if ( value === 'armed' || value === 'partially_armed' ) {
                Homey.app.checkDevicesLastCom(value)
            }
        }
    }

    // Actually sets the Surveillance Mode 
    setSurveillanceValue(color,value, logLine, deviceCheck) {
        let nu = getDateTime();
        logLine = color + nu + logLine;
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        lastDoor = false;
        changeTta = false;

        if ( armCounterRunning || value === 'disarmed') {
            Homey.ManagerSettings.set('surveillanceStatus', value, function( err ){
                if ( err ) return Homey.alert( err );
            });
            // Generate Homey wide event for setting the Surveillance Mode
            this.logRealtime("Surveillance Mode", value)
            this.speak("sModeChange", Homey.__("speech.smodeset") + readableMode(value))
            this.log('setSurveillanceValue:       '+ value)
            if ( heimdallSettings.notificationSmodeChange ) {
                let message = Homey.__("notification.smodeset1") + readableMode(value) + Homey.__("notification.smodeset2")
                this.writeNotification(message)
            }
            var tokens = { 'mode': readableMode(value) };
            triggerSurveillanceChanged.trigger(tokens)
                .catch(this.error)
                .then()

            // check the states of the sensors 
            if ( deviceCheck ) {
                Homey.app.checkDevicesState(value, nu)
            }
        } else {
            logLine = "sd " + nu + readableMode(surveillance) + " || Heimdall || " + Homey.__("history.smodechangedisabled")
        }
        this.writeLog(logLine)   
        armCounterRunning = false;
    }

    // Check the status of the devices triggered by setting a Surveillance Mode
    async checkDevicesState(value, nu) {
        let allDevices = await this.getDevices()
        for (let device in allDevices) {
            this.checkDeviceState(allDevices[device], value, nu)
        };
    }

    // Check the last communication of a device at setting a Surveillance Mode or from a flow
    async checkDevicesLastCom(value) {
        let allDevices = await this.getDevices()
        for (let device in allDevices) {
            this.checkDeviceLastCom(allDevices[device], value)
        };
    }

    // Check the status of the devices triggered by a flow
    async checkAllDevicesState() {
        let allDevices = await this.getDevices()
        for (let device in allDevices) {
            this.checkAllDeviceState(allDevices[device])
        };
    }

    async checkDeviceState(device, value, nu) {
        if ( await this.checkReadyState(device) ) return
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
        if ( !device.ready ) return
        if ( isMonitoredFull(device) || isMonitoredPartial(device) ) {
            let nu = getDateTime();
            let nuEpoch = Date.now();

            if ( 'alarm_motion' in device.capabilitiesObj || 'alarm_contact' in device.capabilitiesObj ) {
                let mostRecentComE = 0

                for ( let capability in device.capabilitiesObj ) {
                    let lu = Date.parse(device.capabilitiesObj[capability].lastUpdated)

                    if ( lu > mostRecentComE  ) {
                        mostRecentComE = lu
                    }
                    //console.log(mostRecentComE)
                }

                let mostRecentComH = new Date( mostRecentComE )
                let verschil = Math.round((nuEpoch - mostRecentComE)/1000)
                
                if ( verschil > heimdallSettings.noCommunicationTime * 3600 ) {
                    let d = new Date(0);
                    d.setUTCSeconds(Date.parse(mostRecentComH)/1000);
                    let lastUpdateTime = d.toLocaleString();

                    let tempColor = 'mp-'
                    // let zone = await this.getZone(device.zone)
                    let tempLogLine = tempColor + nu + readableMode(value) + " || Heimdall || " + device.name + " in " + device.zoneName + Homey.__("history.noreport") + heimdallSettings.noCommunicationTime + Homey.__("history.lastreport") + lastUpdateTime
                    this.writeLog(tempLogLine)
                    this.log("checkDeviceLastCom:         " + device.name + " - did not communicate in last 24 hours")
                    if ( heimdallSettings.notificationNoCommunicationMotion && 'alarm_motion' in device.capabilitiesObj ) {
                        let message = '**' + device.name + '** in ' + device.zoneName + Homey.__("history.noreport") + heimdallSettings.noCommunicationTime + Homey.__("history.lastreport") + lastUpdateTime
                        this.writeNotification(message)
                    }
                    if ( heimdallSettings.notificationNoCommunicationContact && 'alarm_contact' in device.capabilitiesObj ) {
                        let message = '**' + device.name + '** in ' + device.zoneName + Homey.__("history.noreport") + heimdallSettings.noCommunicationTime + Homey.__("history.lastreport") + lastUpdateTime
                        this.writeNotification(message)
                    }

                    var tokens = {'Zone': device.zoneName, 'Device': device.name, 'LastUpdate': lastUpdateTime, 'Duration': heimdallSettings.noCommunicationTime};
                    triggerNoInfoReceived.trigger(tokens)
                        .catch(this.error)
                        .then()
                } else {
                    this.log("checkDeviceLastCom:         " + device.name + " - communicated in last 24 hours")
                }
            }
        }
    }

    async checkAllDeviceState(device) {
        if ( await this.checkReadyState(device) ) return
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

    async checkReadyState(device) {
        if ( !device.ready ) {
            // The device is not ready
            // Check if the device is in the devicesNotReadyAtStart list
            for (let deviceNotReady in devicesNotReadyAtStart) {
                if ( device.name == devicesNotReadyAtStart[deviceNotReady] ) {
                    // The device has not been ready yet, no action
                    return true
                }
            }
            // The device is not in the devicesNotReadyAtStart list so it has been ready
            // Add to the devicesNotReady list
            devicesNotReady.push(device.name)
            // And log this
            this.log("Device no longer ready:     " + device.name)
            let nu = getDateTime();
            let logLine = "al " + nu + readableMode(surveillance) + " || " + Homey.__("devicecheck.source") + " || " + device.name + Homey.__("devicecheck.warning")
            this.writeLog(logLine)
            return true
        } else {
            // The device is ready
            // Check if the device is in the devicesNotReadyAtStart list
            for (let deviceNotReady in devicesNotReadyAtStart) {
                if ( device.name == devicesNotReadyAtStart[deviceNotReady] ) {
                    // The device has not been ready yet
                    // So add the device
                    await this.addDevice(device);
                    // Remove device from devicesNotReadyAtStart list
                    let x = devicesNotReadyAtStart.splice(deviceNotReady,1)
                    devicesNotReadyAtStart = devicesNotReadyAtStart.splice(deviceNotReady,1)
                    // And log it
                    this.log("Device now ready:           " + device.name)
                    let nu = getDateTime();
                    let logLine = "ao " + nu + readableMode(surveillance) + " || " + Homey.__("devicecheck.source") + " || " + device.name + Homey.__("devicecheck.ready")
                    this.writeLog(logLine)
                    return false
                }
            }
            // Check if the device is in the devicesNotReady list
            for (let deviceReady in devicesNotReady) {
                if ( device.name == devicesNotReady[deviceReady] ) {
                    // The device has been ready, was unready and is ready again
                    // Log this
                    this.log("Device became ready again:  " + device.name)
                    let nu = getDateTime();
                    let logLine = "ao " + nu + readableMode(surveillance) + " || " + Homey.__("devicecheck.source") + " || " + device.name + Homey.__("devicecheck.readyagain")
                    this.writeLog(logLine)
                    // Remove the device from deviceNotReady list
                    let x = devicesNotReady.splice( deviceReady, 1 )
                    devicesNotReady = devicesNotReady.splice( deviceReady, 1 )
                    return false
                }
            }
            return false
        }
    }

    async activateAlarm(device,sensorState,nu,source) {
        if ( nu == "" ) { 
            nu = getDateTime()
        }
        let logLine = ""
        alarm=true
        this.log("Alarm status:               activated")
        surveillance = Homey.ManagerSettings.get('surveillanceStatus')
        if ( surveillance != 'disarmed' || source == "Flowcard" ) {
            // Surveillance mode is active
            // let zone = await this.getZone(device.zone)
            if ( source == "Heimdall") {
                // let zone = await this.getZone(device.zone)
                var tokens= {'Reason': device.name + ': '+ sensorState , 'Zone': device.zoneName };
                logLine = "al " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmactivated") + device.name + ": " + sensorState;
            } else {
                var tokens= {'Reason': 'Flowcard' , 'Zone': "" };
                logLine = "al " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmactivatedflowcard");
            }
            triggerAlarmActivated.trigger(tokens)
                .catch(this.error)
                .then()

            if ( heimdallSettings.notificationAlarmChange  ) {
                let message = '**'+device.name+'** in '+ device.zoneName + Homey.__("history.triggerdalarm")
                this.writeNotification(message)
            }

            this.speak("alarmChange", Homey.__("speech.alarmactivated"))
            // save alarm status
            Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
                if ( err ) return Homey.alert( err );
            });
            // Check if Alarm Off Button exists and turn on 
            if ( aModeDevice != undefined) {
                aModeDevice.setCapabilityValue('alarm_heimdall', true)
                aModeDevice.setCapabilityValue('alarm_generic', true)
            }
            if ( sModeDevice != undefined) {
                sModeDevice.setCapabilityValue('alarm_heimdall', true)
                sModeDevice.setCapabilityValue('alarm_generic', true)
            } 
        }
        else {
            // Surveillance mode is not active
            logLine = "ao " + nu + readableMode(surveillance) + " || " + source + " || " + Homey.__("history.alarmnotactivated")
            alarm=false;
            Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
                if ( err ) return Homey.alert( err );
            });
        }  
        // write information to log
        this.writeLog(logLine)
        // Generate Homey wide event for setting the Alarm Status
        this.logRealtime("Alarm Status", alarm)
    }

    alertSensorActiveAtArming ( value, nu, sensorType, warningText ) {
        // write log
        let color = 'm' + value.substring(0,1) + '-'
        let logLine = color + nu + readableMode(value) + " || Heimdall || " + warningText
        this.writeLog(logLine)
        // activate triggercard
        var tokens = { 'warning': warningText };
    
        triggerSensorActiveAtArming.trigger(tokens)
            .catch(this.error)
            .then()

        // Generate Homey wide event for an active sensor at arming
        this.logRealtime( "Sensor State at Arming","Active" );

        // tell user
        if ( sensorType == 'motion' && heimdallSettings.spokenMotionAtArming) {
            this.speak("sensorActive", warningText)
        } else if ( sensorType == 'contact' && heimdallSettings.spokenDoorOpenAtArming ) {
            this.speak("sensorActive", warningText)
        }
    }

    async alertSensorActive ( device, sensorType, sensorstateReadable ) {
        // let zone = await this.getZone(device.zone)
        var tokens = { 'Zone': device.zoneName, 'Device': device.name, 'Device type': sensorType, 'State': sensorstateReadable }
        triggerSensorActive.trigger(tokens)
            .catch(this.error)
            .then()
    }

    deactivateAlarm(value, source) {
        if ( alarm === true || source == "Flowcard") {
            let nu = getDateTime();
            alarm = false
            this.log("Alarm status:               deactivated")
            surveillance = Homey.ManagerSettings.get('surveillanceStatus');
            Homey.ManagerSettings.set('alarmStatus', alarm, function( err ){
                if ( err ) return Homey.alert( err );
            });
            this.speak("alarmChange", Homey.__("speech.alarmdeactivated"))
            // Check if Alarm Off Button exists and turn off
            if ( aModeDevice != undefined) {
                aModeDevice.setCapabilityValue('alarm_heimdall', false)
                aModeDevice.setCapabilityValue('alarm_generic', false)
            }
            if ( sModeDevice != undefined) {
                sModeDevice.setCapabilityValue('alarm_heimdall', false)
                sModeDevice.setCapabilityValue('alarm_generic', false)
            }
            var tokens = { 'Source': source }
            triggerAlarmDeactivated.trigger(tokens)
                .catch(this.error)
                .then() 

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
            // this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
         }
        if (type == "alarmCountdown" && heimdallSettings.spokenAlarmCountdown ) {
            // this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "armCountdown" && heimdallSettings.spokenArmCountdown ) {
            // this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "alarmChange" && heimdallSettings.spokenAlarmChange ) {
            // this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "motionTrue" && heimdallSettings.spokenMotionTrue ) {
            // this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "doorOpen" && heimdallSettings.spokenDoorOpen ) {
            // this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }
        if (type == "tamper" && heimdallSettings.spokenTamperTrue ) {
            // this.log('Say:                        ' + text)
            Homey.ManagerSpeechOutput.say(text.toString())
        }    
        if (type == "sensorActive") {
            // this.log('Say:                        ' + text)
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
            triggerTimeTillArmedChanged.trigger(tokens)
                .catch(this.error)
                .then()

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
                if ( heimdallSettings.checkBeforeCountdown ) {
                    this.setSurveillanceValue(color, value, logLine, false)
                } else {
                    this.setSurveillanceValue(color, value, logLine, true)
                }
            }
        }
        else {
            this.log('ttArmedCountdown:           armCounterRunning = false')
            if ( heimdallSettings.checkBeforeCountdown ) {
                this.setSurveillanceValue(color, value, logLine, false)
            } else {
                this.setSurveillanceValue(color, value, logLine, true)
            }
        }
    }
    
    ttAlarmCountdown(delay,device,sensorStateReadable) {
        if ( !alarmCounterRunning ) {
            this.log('Alarm counter active:       Yes, break off delayed alarm')
            return
        }
        this.log('ttAlarmCountdown:       ' + delay)
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        if ( surveillance != 'disarmed' ) {
            var tokens = { 'AlarmTimer': delay * 1};
            triggerTimeTillAlarmChanged.trigger(tokens)
                .catch(this.error)
                .then()
                
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
                this.log('alarmCounterRunning:        false due to reaching 0')
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

    // Generate Homey wide event
    logRealtime(event, details)
    {
        Homey.ManagerApi.realtime(event, details)
    }

    getUserInfo(codeString, userList) {
        if ( codeString.length > 3 ) {
            let userObject = userList.find( record => record.pincode === codeString);
            if ( userObject ) {
                return userObject
            } else {
                return { "name": "null", "pincode": codeString, "admin": null, "valid": false }
            }   
        } else {
            return { "name": "null", "pincode": codeString, "admin": null, "valid": false }
        }
    }
}
module.exports = Heimdall;

Homey.ManagerSettings.on('set', (variable) => {
    if ( variable === 'settings' ) {
        heimdallSettings = Homey.ManagerSettings.get('settings')
        // console.log('New settings:')
        // console.log(heimdallSettings)
    }
});

// Flow card functions //////////////////////////////////////////////////////
// Flow triggers functions
triggerSurveillanceChanged
    .register()

triggerSensorActiveAtArming
    .register()

triggerSensorActive
    .register()

triggerAlarmActivated
    .register()

triggerAlarmDeactivated
    .register()

triggerAlarmDelayActivated
    .register()

triggerArmDelayActivated
    .register()

triggerTimeTillAlarmChanged
    .register()

triggerTimeTillArmedChanged
    .register() 
    
triggerLogLineWritten
    .register()

triggerSensorTrippedInAlarmstate
    .register()

triggerNoInfoReceived
    .register()

//Flow condition functions
conditionSurveillanceIs
    .register()
    .registerRunListener(( args, state ) => {
        let result = args.surveillance == Homey.ManagerSettings.get('surveillanceStatus') ? true : false
        return Promise.resolve( result );
    })

conditionArmingCountdown
    .register()
    .registerRunListener(( args, state ) => {
        return Promise.resolve( armCounterRunning );
    })

conditionAlarmCountdown
    .register()
    .registerRunListener(( args, state ) => {
        return Promise.resolve( alarmCounterRunning );
    })

conditionAlarmActive
    .register()
    .registerRunListener(( args, state ) => {
        return Promise.resolve( alarm );
    })

conditionIsDelayedDevice
    .register()
    .registerRunListener(( args, state ) => {
        return Promise.resolve( isDelayed(args.device) );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve( Homey.app.getUsableDevices() )
    });

conditionIsLoggedDevice
    .register()
    .registerRunListener(( args, state ) => {
        return Promise.resolve( isLogged(args.device) );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve( Homey.app.getUsableDevices() )
});

conditionIsFullDevice
    .register()
    .registerRunListener(( args, state ) => {
        return Promise.resolve( isMonitoredFull(args.device) );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve( Homey.app.getUsableDevices() )
});

conditionIsPartialDevice
    .register()
    .registerRunListener(( args, state ) => {
        return Promise.resolve( isMonitoredPartial(args.device) );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve( Homey.app.getUsableDevices() )
});

//Flow actions functions
actionInputHistory
    .register()
    .registerRunListener(( args, state ) => {
        let nu = getDateTime();
        surveillance = Homey.ManagerSettings.get('surveillanceStatus');
        let logLine = "lh " + nu + readableMode(surveillance) + " || Flowcard || " + args.log;
        Homey.app.writeLog(logLine)
        return Promise.resolve( true );
    })

actionClearHistory
    .register()
    .registerRunListener(( args, state ) => {
        Homey.ManagerSettings.set('myLog', '' );
        return Promise.resolve( true );
    })

actionActivateAlarm
    .register()
    .registerRunListener(( args, state ) => {
        Homey.app.activateAlarm("",  "", "", "Flowcard")
        return Promise.resolve( true );
    })

actionDeactivateAlarm
    .register()
    .registerRunListener(( args, state ) => {
        Homey.app.deactivateAlarm(true, "Flowcard")
        return Promise.resolve( true );
    })

actionCheckLastCommunication
    .register()
    .registerRunListener(( args, state ) => {
        Homey.app.checkDevicesLastCom(Homey.ManagerSettings.get('surveillanceStatus'))
        return Promise.resolve( true );
    })

actionAllDevicesStateCheck
    .register()
    .registerRunListener(( args, state ) => {
        Homey.app.checkAllDevicesState()
        return Promise.resolve( true );
    })

actionInputNotification
    .register()
    .registerRunListener(( args, state ) => {
        Homey.app.writeNotification(args.message)
        return Promise.resolve( true );
    })

actionAddDelayToDevice
    .register()
    .registerRunListener(( args, state ) => {
        addDelayTo(args.device)
        return Promise.resolve( true );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve(
            Homey.app.getUsableDevices()
        )
    })

actionRemoveDelayFromDevice
    .register()
    .registerRunListener(( args, state ) => {
        removeDelayFrom(args.device)
        return Promise.resolve( true );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve(
            Homey.app.getUsableDevices()
        )
    })

actionAddLoggingToDevice
    .register()
    .registerRunListener(( args, state ) => {
        addLoggingTo(args.device)
        return Promise.resolve( true );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve(
            Homey.app.getUsableDevices()
        )
    })

actionRemoveLoggingFromDevice
    .register()
    .registerRunListener(( args, state ) => {
        removeLoggingFrom(args.device)
        return Promise.resolve( true );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve(
            Homey.app.getUsableDevices()
        )
    })

actionAddDeviceToPartial
    .register()
    .registerRunListener(( args, state ) => {
        addMonitorPartialTo(args.device)
        return Promise.resolve( true );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve(
            Homey.app.getUsableDevices()
        )
    })

actionRemoveDeviceFromPartial
    .register()
    .registerRunListener(( args, state ) => {
        removeMonitorPartialFrom(args.device)
        return Promise.resolve( true );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve(
            Homey.app.getUsableDevices()
        )
    })

actionAddDeviceToFull
    .register()
    .registerRunListener(( args, state ) => {
        addMonitorFullTo(args.device)
        return Promise.resolve( true );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve(
            Homey.app.getUsableDevices()
        )
    })

actionRemoveDeviceFromFull
    .register()
    .registerRunListener(( args, state ) => {
        removeMonitorFullFrom(args.device)
        return Promise.resolve( true );
    })
    .getArgument('device')
    .registerAutocompleteListener((query, args) => {
        return Promise.resolve(
            Homey.app.getUsableDevices()
        )
    })

// End Flow card functions //////////////////////////////////////////////////

// Sensor settings functions ////////////////////////////////////////////////

// Should this device be logged
function isLogged(device) {
    let devicesLogged = Homey.ManagerSettings.get('loggedDevices')
    let i;
    if ( devicesLogged !== null ) {
        for (i = 0; i < devicesLogged.length; i++) {
            if (devicesLogged[i] && devicesLogged[i].id == device.id) {
                return true;
            }
        }
    }
    return false;
}

// add Logging to Device
function addLoggingTo(device) {
    if ( !isLogged(device) ) {
        let devicesLogged = Homey.ManagerSettings.get('loggedDevices')
        devicesLogged.push(device)
        Homey.ManagerSettings.set('loggedDevices',devicesLogged)
        removeMonitorFullFrom(device)
        removeMonitorPartialFrom(device)
        removeDelayFrom(device)
    }
}

// Remove Logging from Device
function removeLoggingFrom(device) {
    if ( isLogged(device) ) {
        let devicesLogged = Homey.ManagerSettings.get('loggedDevices')
        if ( devicesLogged !== null ) {
            let i;
            for (i = 0; i < devicesLogged.length; i++) {
                if (devicesLogged[i] && devicesLogged[i].id == device.id) {
                    devicesLogged.splice(i, 1);
                }
            }
            Homey.ManagerSettings.set('loggedDevices',devicesLogged)
        }
    }
}

// Should this device be monitored
function isMonitoredFull(device) {
    let devicesMonitoredFull = Homey.ManagerSettings.get('monitoredFullDevices')
    let i;
    if ( devicesMonitoredFull !== null ) {
        for (i = 0; i < devicesMonitoredFull.length; i++) {
            if (devicesMonitoredFull[i] && devicesMonitoredFull[i].id == device.id) {
                return true;
            }
        }
    }
    return false;
}

// add Monitor Full to Device
function addMonitorFullTo(device) {
    if ( !isMonitoredFull(device) ) {
        let devicesMonitoredFull = Homey.ManagerSettings.get('monitoredFullDevices')
        devicesMonitoredFull.push(device)
        Homey.ManagerSettings.set('monitoredFullDevices',devicesMonitoredFull)
        if ( isLogged(device) ) {
            removeLoggingFrom(device)
        }
    }
}

// remove Monitor Full from Device
function removeMonitorFullFrom(device) {
    if ( isMonitoredFull(device) ) {
        let devicesMonitoredFull = Homey.ManagerSettings.get('monitoredFullDevices')
        if ( devicesMonitoredFull !== null) {
            let i;
            for (i = 0; i < devicesMonitoredFull.length; i++) {
                if (devicesMonitoredFull[i] && devicesMonitoredFull[i].id == device.id) {
                    devicesMonitoredFull.splice(i, 1);
                }
            }
            Homey.ManagerSettings.set('monitoredFullDevices',devicesMonitoredFull)
        }
        if ( !isMonitoredPartial(device) ) {
            removeDelayFrom(device)
        }
    } 
}

// Should this device be monitored
function isMonitoredPartial(device) {
    let devicesMonitoredPartial = Homey.ManagerSettings.get('monitoredPartialDevices')
    let i;
    if ( devicesMonitoredPartial !== null ) {
        for (i = 0; i < devicesMonitoredPartial.length; i++) {
            if (devicesMonitoredPartial[i] && devicesMonitoredPartial[i].id == device.id) {
                return true;
            }
        }
    }
    return false;
}

// add Monitor Partial to Device
function addMonitorPartialTo(device) {
    if ( !isMonitoredPartial(device) ) {
        let devicesMonitoredPartial = Homey.ManagerSettings.get('monitoredPartialDevices')
        devicesMonitoredPartial.push(device)
        Homey.ManagerSettings.set('monitoredPartialDevices',devicesMonitoredPartial)
        if ( isLogged(device) ) {
            removeLoggingFrom(device)
        }
    }
}

// remove Monitor Partial from Device
function removeMonitorPartialFrom(device) {
    if ( isMonitoredPartial(device) ) {
        let devicesMonitoredPartial = Homey.ManagerSettings.get('monitoredPartialDevices')
        if ( devicesMonitoredPartial !== null) {
            let i;
            for (i = 0; i < devicesMonitoredPartial.length; i++) {
                if (devicesMonitoredPartial[i] && devicesMonitoredPartial[i].id == device.id) {
                    devicesMonitoredPartial.splice(i, 1);
                }
            }
            Homey.ManagerSettings.set('monitoredPartialDevices',devicesMonitoredPartial)
        }
        if ( !isMonitoredFull(device) ) {
            removeDelayFrom(device)
        }

    } 
}

// Should this trigger be delayed
function isDelayed(device) {
    let devicesDelayed = Homey.ManagerSettings.get('delayedDevices')
    let i;
    if ( devicesDelayed !== null) {
        for (i = 0; i < devicesDelayed.length; i++) {
            if (devicesDelayed[i] && devicesDelayed[i].id == device.id) {
                return true;
            }
        }
    }
    return false;
}

// add Delay to Device
async function addDelayTo(device) {
    if ( !isDelayed(device) ) {
        let devicesDelayed = Homey.ManagerSettings.get('delayedDevices')
        devicesDelayed.push(device)
        Homey.ManagerSettings.set('delayedDevices',devicesDelayed)
        if ( !isMonitoredFull(device) && !isMonitoredPartial(device) ) {
            await addMonitorFullTo(device)
            if ( isLogged(device) ) {
                removeLoggingFrom(device)
            }
        }
    } 
}

// remove Delay from device
function removeDelayFrom(device) {
    if ( isDelayed(device) ) {
        let devicesDelayed = Homey.ManagerSettings.get('delayedDevices')
        if ( devicesDelayed !== null) {
            let i;
            for (i = 0; i < devicesDelayed.length; i++) {
                if (devicesDelayed[i] && devicesDelayed[i].id == device.id) {
                    devicesDelayed.splice(i, 1);
                }
            }
            Homey.ManagerSettings.set('delayedDevices',devicesDelayed)
        }
    }
}

// End Sensor settings functions ////////////////////////////////////////////

function checkAPIKEY(APIKEY) {
    if ( APIKEY == Homey.env.APIKEY1 || APIKEY == Homey.env.APIKEY2 || APIKEY == Homey.env.APIKEY3 || APIKEY == Homey.env.APIKEY4 || APIKEY == Homey.env.APIKEY5 ) {
        return true
    } else {
        return false
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