'use strict';

const Homey = require('homey');
//const { HomeyAPIApp } = require('homey-api');
const { HomeyAPI } = require('./homey-api'); // 3.0.0-rc.18 01-04-2023

const delay = time => new Promise(res=>setTimeout(res,time));

var surveillance;
var alarm = false;
var heimdallSettings = [];
var defaultSettings = {
    "armingDelay": "30",
    "alarmDelay": "30",
    "delayArmingFull": false,
    "delayArmingPartial": false,
    "alarmWhileDelayed": false,
    "logArmedOnly": true,
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
var devicesAdded = [];
var timeout = 100;
var zones = {};

module.exports = class Heimdall extends Homey.App {

    async onInit() {
        this.log(`${Homey.manifest.id} ${Homey.manifest.version} initialising --------------`)
        this.log('Platform:                  ', this.homey.platform);
        this.log('PlatformVersion:           ', this.homey.platformVersion);
        // this.log('SoftwareVersion:           ', this.homey.softwareVersion);
        let timezone = this.homey.clock.getTimezone()
        let localDate = new Date(new Date().toLocaleString("en-US", {timeZone: timezone}));
        this.log('Timezone:                  ', timezone)
        this.log('Local Time:                ', localDate)
        
        //this.log('Preparing flow cards:       start');
        this.initializeFlowCards();

        //this.log('Reading settings:           start')
        this.initializeSettings();

        //this.log('Connecting webapi:          start')
        await this.initializeWebApi();

        //this.log('Attach events to devices:   start')
        this.attachDeviceEvents();

        //this.log('Enumerating devices:        start')
        this.enumerateDevices().catch(this.error);
        this.log('Heimdall ready for action   ----------------------')
    }

    async initializeFlowCards() {
        // Flow triggers 
        this.homey.flow.getTriggerCard('SurveillanceChanged');
        this.homey.flow.getTriggerCard('sensorActiveAtArming');
        this.homey.flow.getTriggerCard('sensorActiveAtSensorCheck');
        this.homey.flow.getTriggerCard('AlarmActivated');
        this.homey.flow.getTriggerCard('AlarmDeactivated');
        this.homey.flow.getTriggerCard('AlarmDelayActivated');
        this.homey.flow.getTriggerCard('ArmDelayActivated');
        this.homey.flow.getTriggerCard('TimeTillAlarm');
        this.homey.flow.getTriggerCard('TimeTillArmed');
        this.homey.flow.getTriggerCard('LogLineWritten');
        this.homey.flow.getTriggerCard('SensorTrippedInAlarmstate');
        this.homey.flow.getTriggerCard('noInfoReceived');

        // Flow conditions
        const conditionSurveillanceIs = this.homey.flow.getConditionCard('SurveillanceIs');
        const conditionArmingCountdown = this.homey.flow.getConditionCard('ArmingCountdown');   
        const conditionAlarmCountdown = this.homey.flow.getConditionCard('AlarmCountdown');     
        const conditionAlarmActive = this.homey.flow.getConditionCard('AlarmActive');           
        const conditionIsDelayedDevice = this.homey.flow.getConditionCard('IsDelayedDevice');
        const conditionIsLoggedDevice = this.homey.flow.getConditionCard('IsLoggedDevice');
        const conditionIsFullDevice = this.homey.flow.getConditionCard('IsFullDevice');
        const conditionIsPartialDevice = this.homey.flow.getConditionCard('IsPartialDevice');
        
        // Flow actions
        const actionInputHistory = this.homey.flow.getActionCard('SendInfo');                           
        const actionClearHistory = this.homey.flow.getActionCard('ClearHistory');                       
        const actionActivateAlarm = this.homey.flow.getActionCard('ActivateAlarm');                     
        const actionDeactivateAlarm = this.homey.flow.getActionCard('DeactivateAlarm');                 
        const actionCheckLastCommunication = this.homey.flow.getActionCard('CheckLastCommunication');   
        const actionAllDevicesStateCheck = this.homey.flow.getActionCard('DevicesStateCheck');          
        const actionInputNotification = this.homey.flow.getActionCard('SendNotification');              
        const actionAddDelayToDevice = this.homey.flow.getActionCard('AddDelayToDevice');               
        const actionRemoveDelayFromDevice = this.homey.flow.getActionCard('RemoveDelayFromDevice');     
        const actionAddLoggingToDevice = this.homey.flow.getActionCard('AddLoggingToDevice');           
        const actionRemoveLoggingFromDevice = this.homey.flow.getActionCard('RemoveLoggingFromDevice'); 
        const actionAddDeviceToPartial = this.homey.flow.getActionCard('AddDeviceToPartial');           
        const actionRemoveDeviceFromPartial = this.homey.flow.getActionCard('RemoveDeviceFromPartial'); 
        const actionAddDeviceToFull = this.homey.flow.getActionCard('AddDeviceToFull');                 
        const actionRemoveDeviceFromFull = this.homey.flow.getActionCard('RemoveDeviceFromFull');       
                
        // Flow Condition functions
        conditionSurveillanceIs
            .registerRunListener(( args, state ) => {
                let result = args.surveillance == this.homey.settings.get('surveillanceStatus') ? true : false
                return Promise.resolve( result );
            });
        
        conditionArmingCountdown
            .registerRunListener(( args, state ) => {
                return Promise.resolve( armCounterRunning );
            });
        
        conditionAlarmCountdown
            .registerRunListener(( args, state ) => {
                return Promise.resolve( alarmCounterRunning );
            });
        
        conditionAlarmActive
            .registerRunListener(( args, state ) => {
                return Promise.resolve( alarm );
            });

        conditionIsDelayedDevice
            .registerRunListener(( args, state ) => {
                return Promise.resolve( this.isDelayed(args.device) );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve( this.getUsableDevices() )
            });

        conditionIsLoggedDevice
            .registerRunListener(( args, state ) => {
                return Promise.resolve( this.isLogged(args.device) );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve( this.getUsableDevices() )
            });

        conditionIsFullDevice
            .registerRunListener(( args, state ) => {
                return Promise.resolve( this.isMonitoredFull(args.device) );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve( this.getUsableDevices() )
            });

        conditionIsPartialDevice
            .registerRunListener(( args, state ) => {
                return Promise.resolve( this.isMonitoredPartial(args.device) );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve( this.getUsableDevices() )
            });

        // Flow Action functions
        actionInputHistory
            .registerRunListener(( args, state ) => {
                let nu =this.getDateTime();
                surveillance = this.homey.settings.get('surveillanceStatus');
                let logLine = "lh " + nu + this.readableMode(surveillance) + " || Flowcard || " + args.log;
                this.homey.app.writeLog(logLine)
                return Promise.resolve( true );
            })

        actionClearHistory
            .registerRunListener(( args, state ) => {
                this.homey.settings.set('myLog', '' );
                return Promise.resolve( true );
            })

        actionActivateAlarm
            .registerRunListener(( args, state ) => {
                this.homey.app.activateAlarm("",  "", "", "Flowcard")
                return Promise.resolve( true );
            })

        actionDeactivateAlarm
            .registerRunListener(( args, state ) => {
                this.homey.app.deactivateAlarm(true, "Flowcard")
                return Promise.resolve( true );
            })

        actionCheckLastCommunication
            .registerRunListener(( args, state ) => {
                this.homey.app.checkDevicesLastCom(this.homey.settings.get('surveillanceStatus'))
                return Promise.resolve( true );
            })

        actionAllDevicesStateCheck
            .registerRunListener(( args, state ) => {
                this.homey.app.checkAllDevicesState()
                return Promise.resolve( true );
            })

        actionInputNotification
            .registerRunListener(( args, state ) => {
                this.homey.app.writeNotification(args.message)
                return Promise.resolve( true );
            })

        actionAddDelayToDevice
            .registerRunListener(( args, state ) => {
                this.addDelayTo(args.device)
                return Promise.resolve( true );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    this.getUsableDevices()
                )
            })

        actionRemoveDelayFromDevice
            .registerRunListener(( args, state ) => {
                this.removeDelayFrom(args.device)
                return Promise.resolve( true );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    this.getUsableDevices()
                )
            })

        actionAddLoggingToDevice
            .registerRunListener(( args, state ) => {
                this.addLoggingTo(args.device)
                return Promise.resolve( true );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    this.getUsableDevices()
                )
            })

        actionRemoveLoggingFromDevice
            .registerRunListener(( args, state ) => {
                this.removeLoggingFrom(args.device)
                return Promise.resolve( true );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    this.getUsableDevices()
                )
            })

        actionAddDeviceToPartial
            .registerRunListener(( args, state ) => {
                this.addMonitorPartialTo(args.device)
                return Promise.resolve( true );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    this.getUsableDevices()
                )
            })

        actionRemoveDeviceFromPartial
            .registerRunListener(( args, state ) => {
                this.removeMonitorPartialFrom(args.device)
                return Promise.resolve( true );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    this.getUsableDevices()
                )
            })

        actionAddDeviceToFull
            .registerRunListener(( args, state ) => {
                this.addMonitorFullTo(args.device)
                return Promise.resolve( true );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    this.getUsableDevices()
                )
            })

        actionRemoveDeviceFromFull
            .registerRunListener(( args, state ) => {
                this.removeMonitorFullFrom(args.device)
                return Promise.resolve( true );
            })
            .getArgument('device')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    this.getUsableDevices()
                )
            })

        this.log('Preparing flow cards:       done');
    }

    async initializeSettings() {
        this.users = this.homey.settings.get('users');
        
        // Uncomment next line to print users to the log when pincode is lost.
        // this.log(this.users);
        // Uncomment next line, run the app once and comment the line again to start fresh.
        // this.homey.settings.unset('users');
        if ( this.users === undefined || this.users === null || this.users.length === 0 ) {
            this.homey.settings.set('nousers', true)
        }

        let nu =this.getDateTime();
        surveillance = this.homey.settings.get('surveillanceStatus');
        this.log(' Surveillance Mode:         ' + surveillance);
        if ( surveillance == null ) {
            surveillance = 'disarmed'
            this.homey.settings.set('surveillanceStatus', 'disarmed');
        };        
        let logLine = "ao " + nu + this.readableMode(surveillance) + " || Heimdall || Heimdall start"
        this.writeLog(logLine)

        heimdallSettings = this.homey.settings.get('settings');
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

        let language = this.homey.i18n.getLanguage();
        this.log(' Language:                  ' + language);
        this.homey.settings.set('language', language);

        this.homey.settings.set('platformVersion', this.homey.platformVersion);

        this.homey.settings.on('set', (variable) => {
            if ( variable === 'settings' ) {
                heimdallSettings = this.homey.settings.get('settings')
            }
        });

        //this.homey.on('memwarn', async (data) => await this.onMemwarn(data));
        this.log('Reading settings:           done')
    }

    async initializeWebApi() {
        this.homeyApi = await HomeyAPI.createAppAPI({ homey: this.homey });

        await this.homeyApi.devices.connect();

        zones = await this.homeyApi.zones.getZones();

        this.log('Connecting webapi:          done')
    }

    async attachDeviceEvents() {
        this.homeyApi.devices.on('device.create', async(device) => {
            this.log('device.create:            ',device.name, 'state:', device.ready);
            //var device = await this.waitForDevice(id,0)
            if ( device.ready && device.capabilitiesObj ) {
                this.addDevice(device);
            }
        });

        this.homeyApi.devices.on('device.delete', async(device) => {
            this.log('device.delete:             ',device);
        });

        this.homeyApi.devices.on('device.update', async(device) => {
            if ( device.ready && device.capabilitiesObj ) {
                for ( let cap in device.capabilities ) {
                    if ( [ "alarm_motion", "alarm_contact", "alarm_vibration", "alarm_tamper", "alarm_heimdall" ].includes( device.capabilities[cap] ) ) {
                        this.log('device.update: Ready now:  ',device.name, 'state:', device.ready);
                        this.addDevice(device);
                    }
                }
            } else {
                this.log('device.update: Not ready:  ',device.name, 'state:', device.ready);

            }
        });

        this.log('Attach events to devices:   done')
    }

    // Get all devices and run them through the functions to add 
    // makeCapabilityInstance('capability', ) functions for the desired capabilities.
    // addDevice() -> attachEventListener()
    async enumerateDevices() {
        let allDevices = await this.getDevices();

        if (Object.keys(zones).length==0) {
            console.log('No zones found earlier, getting them now for you');
            zones = await this.homeyApi.zones.getZones();
            console.log(Object.keys(zones).length);
        }

        for (let id in allDevices) {
            var device = await this.checkReadyStateAtStart(allDevices[id],0)
            //var device = allDevices[id];
            if ( device.ready && device.capabilitiesObj ) {
                this.addDevice(device);
            } 
        };

        this.log('Enumerating devices:        done')
    }

    // Check if a device is ready return it when ready. If ready return false, 
    // log to the log and add the device ID to the devicesNotReadyAtStart array
    // - Called from enumerateDevices()
    async checkReadyStateAtStart(id, addCounter) {
        const device = await this.homeyApi.devices.getDevice({ id: id.id });
        if ( device.ready && device.capabilitiesObj ) {
            return device;
        }
        if ( device.data.id == "sMode" || device.data.id == "aMode" ) {
            return false
        }
        this.log(" Found Device, not ready:   " + device.name)
        devicesNotReadyAtStart.push(device.id)
        for ( let cap in device.capabilities ) {
            if ( [ "alarm_motion", "alarm_contact", "alarm_vibration" ].includes( device.capabilities[cap] ) ) {                    
                let nu =this.getDateTime();
                // let logLine = "al " + nu + this.readableMode(surveillance) + " || Enumerate Devices || " + device.name + " is not ready at Enumerating Devices"
                let logLine = "al " + nu + this.readableMode(surveillance) + " || " + this.homey.__("enumerate.source") + " || " + device.name + this.homey.__("enumerate.warning")
                this.writeLog(logLine)        
            }
        }
        return false
    }

    // Add device function, all device types with motion-, contact-, vibration- and tamper 
    // capabilities are run through the attachEventListener() function to add
    // makeCapabilityInstance('capability', ) to the capability of a device.
    // - Called from enumerateDevices()
    async addDevice(device) {
        // newly created devices are not passed as instance anymore Thanks Athom!
        if (! device.makeCapabilityInstance) {
            device = await this.homeyApi.devices.getDevice({ id : device.id });
        }
        for (let deviceItem in devicesAdded) {
            if ( device.id == devicesAdded[deviceItem] ) {
                // The device has been through this function before, exit
                this.log('addDevice: Already added:  ',device.name);
                return;
            }
        }
        devicesAdded.push(device.id);

        device.zoneName = zones[device.zone].name;


        // Find Surveillance Mode Switch
        if ( device.data.id === 'sMode' ) {
            sModeDevice = device;
            this.log(' Found Mode Switch named:   ' + device.name);
        }
        // Find Alarm Off Button
        if ( device.data.id === 'aMode' ) { 
            aModeDevice = device;
            this.log(' Found Alarm Button named:  ' + device.name);
        }
        if ( !device.capabilitiesObj ) return

        if ( 'alarm_motion' in device.capabilitiesObj ) {
            this.log(' Found motion sensor:       ', device.name, 'in', device.zoneName);
            this.attachEventListener(device,'motion');
        }
        if ( 'alarm_contact' in device.capabilitiesObj ) {
            this.log(' Found contact sensor:       ' + device.name, 'in', device.zoneName);
            this.attachEventListener(device,'contact');
        }
        if ( 'alarm_vibration' in device.capabilitiesObj ) {
            this.log(' Found vibration sensor:    ' + device.name, 'in', device.zoneName);
            this.attachEventListener(device,'vibration');
        }
        if ( 'alarm_tamper' in device.capabilitiesObj ) {
            this.log(' Found tamper sensor:       ' + device.name, 'in', device.zoneName);
            this.attachEventListener(device,'tamper');
        }
    }

    // Remove device function
    // - Called from device.js
    removeDevice(deviceId) {
        // Remove Surveillance Mode Switch
        if ( deviceId === 'sMode' ) {
            sModeDevice = undefined;
            this.log('Surveillance Mode Switch removed!')
        }
        // Remove Alarm Off Button
        if ( deviceId === 'aMode' ) { 
            aModeDevice = undefined;
            this.log('Alarm Button removed!')
        }
    }

    // Attach en Event Listener to the device, on an event call stateChange(device,state,sensorType)
    // - Called from addDevice(device)
    async attachEventListener(updatedDevice,sensorType) {
        const device =  await this.homeyApi.devices.getDevice({ id: updatedDevice.id });
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
        if ( this.isMonitoredFull(device) ) {
            monFull = ", Fully Monitored"
        } 
        if ( this.isMonitoredPartial(device) ) {
            monPartial = ", Partially Monitored"
        }
        if ( this.isLogged(device) ) {
            monLogged = ", Logged"
        }
        //this.log(' Attached Eventlistener to: ' + device.name + ': ' + sensorType + monFull + monPartial + monLogged)
    }

    // Get all devices from the homey-api, 
    // - Called via api.js from settings and several other functions
    async getDevices() {
        // return await this.homeyApi.devices.getDevices({ $cache : false });
        return await this.homeyApi.devices.getDevices();
    }

    // Get all zones from homey-api
    // - Called via api.js from settings
    async getZones() {
        return await this.homeyApi.zones.getZones();
    }

    /*
    async getZoneName(zoneId) {
        var result = "unknown";
        let allZones = zones //await this.getZones();

        for (let zone in allZones) {
            if ( allZones[zone].id == zoneId ) {
                result = allZones[zone].name;
            }
        };
        return result;
    }
    */

    // Get all users, users can be used by external keypads 
    // - Called via api.js from settings
    async getUsers(pin) {
        await delay(timeout);
        timeout = timeout * 1.5;
        if ( this.users != undefined ) {
            let userObject = this.getUserInfo(pin, this.users);
            if ( userObject.admin ) {
                timeout = 100;
                // user is an Administrator, return all users
                return this.users;
            } else {
                timeout = 100;
                // return the user whos PIN was entered
                return [userObject];
            } 
        } else {
            return [{ 'id': 0, 'name': 'New user', 'pincode': '000000', 'admin': true, 'valid': true}];
        }
    }

    // Save new or changed user, 
    // - Called from saveUser() in settings via api.js
    async processUsers(modifiedUser, action) {
        let pin = modifiedUser.pin;
        modifiedUser = modifiedUser.user;  
        this.homey.settings.set('nousers', false);
        let searchId = modifiedUser.id;
        let newUsers = [];
        if ( this.users ) {
            let userObject = this.users.find( record => record.id == searchId);
            if ( !userObject ) {
                // new user
                let userObject = this.getUserInfo(pin, this.users);
                if ( userObject.admin ) {
                    newUsers = this.users;
                    newUsers.push(modifiedUser)
                }
            } else {
                // existing user
                for (let user in this.users) {
                    if ( this.users[user].id == searchId ) {
                        if ( action === "save") {
                            newUsers.push(modifiedUser);
                        }
                    } else {
                        newUsers.push(this.users[user]);
                    }
                }
            }
        } else {
            // first user
            newUsers.push(modifiedUser)
        }
        this.users = newUsers;
        this.homey.settings.set('users', this.users);
            
        return "Succes";
    }

    // Process infromation received from a keypad, 
    // - Called by 3rd party apps via api.js
    async processKeypadCommands(post, type) {
        if ( this.checkAPIKEY(post.APIKEY) ) {
            let nu =this.getDateTime();
            let logLine = "";
            let silentCode = null;

            if ( type == "action" ) {
                let pinCode = post.value;
                let userObject = this.getUserInfo(pinCode, this.users);
                if ( !userObject["valid"] ) {
                    let shortPinCode = pinCode.substr(0, pinCode.length - 1);
                    userObject = this.getUserInfo(shortPinCode, this.users);
                    if ( userObject["valid"] ) {
                        silentCode = pinCode.substr(pinCode.length - 1, 1);
                        // todo: write code to handle silentCode
                        
                    }
                }
                if ( userObject["valid"] ) {
                    // logLine = "   " + nu + this.readableMode(surveillance) + " || " + post.diagnostics.sourceApp + " || " + userObject["name"] + " entered a valid code and pressed " + post.actionReadable + " on " + post.diagnostics.sourceDevice;
                    logLine = "   " + nu + this.readableMode(surveillance) + " || " + post.diagnostics.sourceApp + " || " + userObject["name"] + this.homey.__("history.validcode") + post.actionReadable + this.homey.__("history.on") + post.diagnostics.sourceDevice;
                    this.writeLog(logLine);
                    if ( post.action == "armed" || post.action == "disarmed" || post.action == "partially_armed" ) {
                        // logLine = "   " + nu + this.readableMode(surveillance) + " || " + post.diagnostics.sourceDevice + " || Send command " + post.actionReadable + " to Surveillance Mode Switch";
                        logLine = "   " + nu + this.readableMode(surveillance) + " || " + post.diagnostics.sourceDevice + " || " + this.homey.__("history.sendcommand") + post.actionReadable + this.homey.__("history.tosurveillancemode");
                        this.writeLog(logLine);
                        if ( sModeDevice != undefined ) {
                            sModeDevice.setCapabilityValue('homealarm_state', post.action).catch(() => {});
                        }
                        // this.setSurveillanceMode(post.action, post.diagnostics.sourceDevice);
                        return "Found user, changed Surveillance Mode to " + post.action
                    } else if ( post.action == "enter" ) {
                        // todo: write code to do something when the enter key is received

                        return "Found user, action is Enter"
                    } else if ( post.action == "cancel") {
                        // todo: write code to do something when the cancel key is received

                        return "Found user, action is Cancel"
                    } else {
                        return "Found user, action " + post.action + " is unknown"
                    }
                } else {
                    if ( post.value.length > 0 ) {
                        // logLine = "ad " + nu + this.readableMode(surveillance) + " || " + post.diagnostics.sourceApp + " || an invalid code was entered before pressing " + post.actionReadable + " on " + post.diagnostics.sourceDevice;
                        logLine = "ad " + nu + this.readableMode(surveillance) + " || " + post.diagnostics.sourceApp + " || " + this.homey.__("history.invalidcode") + post.actionReadable + this.homey.__("history.on") + post.diagnostics.sourceDevice;
                        this.writeLog(logLine);
                        this.log("Invalid code entered: " + userObject["pincode"])
                        return "Invalid code entered. Logline written, no further action"
                    } else {
                        //logLine = "sd " + nu + this.readableMode(surveillance) + " || " + post.diagnostics.sourceApp + " || Key " + post.actionReadable + " was pressed on " + post.diagnostics.sourceDevice;
                        logLine = "sd " + nu + this.readableMode(surveillance) + " || " + post.diagnostics.sourceApp + " || " + this.homey.__("history.key") + post.actionReadable + this.homey.__("history.pressed") + post.diagnostics.sourceDevice;
                        this.writeLog(logLine);
                        this.log("No code entered ")
                        return "No code entered. Logline written, no further action"
                    }
                }
            } else if ( type == "battery" ) {

            }
            
        } else {
            return "Heimdall: APIKEY error"
        }
    }

    // This returns the devices that can be used as sensor
    // Motion, Contact and Vibration
    // - Called from several functions
    async getUsableDevices () {
        var usableDevices = []
        let allDevices = await this.getDevices();

        for (let id in allDevices) {
            var device = allDevices[id]
            for ( let cap in device.capabilities ) {
                if ( [ "alarm_motion", "alarm_contact", "alarm_vibration" ].includes( device.capabilities[cap] ) ) {                    
                    usableDevices.push(device)
                }
            }   
        };
        return usableDevices
    }

    // Act on a change in the state of a device.
    // This function does the heavy lifting
    // - Called from an attached Event Listener in attachEventListener(device,sensorType)
    async stateChange(device,sensorState,sensorType) {
        if ( sensorType == 'tamper' && !heimdallSettings.useTampering ) {
            this.log("StateChange detected for tampering but shouldn't act on it")
            return
        }
        let nu = this.getDateTime();
        let color = "   ";
        let logLine = "";
        let sourceDeviceFull = this.isMonitoredFull(device);
        let sourceDevicePartial = this.isMonitoredPartial(device);
        let sourceDeviceLog = this.isLogged(device);
        //let zone = await this.getZoneName(device.zone);
        this.log('stateChange:----------------' + device.name + ' ('+ device.zoneName + ')');
        // Is the device monitored?
        if ( sourceDeviceFull || sourceDevicePartial || sourceDeviceLog ) {
            let sensorStateReadable;
            surveillance = this.homey.settings.get('surveillanceStatus');
            sensorStateReadable = this.readableState(sensorState, sensorType);
            this.log('sensorStateReadable:        ' + sensorStateReadable);

            // Select the desired color for the logline
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
            logLine = color + nu + this.readableMode(surveillance) + " || Heimdall || " + device.name + " " + sensorType + ": " + sensorStateReadable;
            if ( sensorState ) {
                // sensorState is true
                this.log('Surveillance Mode:          ' + surveillance);         
                if ( sensorType == 'contact' && this.isDelayed(device) && armCounterRunning ) {
                    // a Doorsensor with a delay is opened while the arming countdown is running
                    this.log('lastDoor:               Opened')
                    lastDoor = true;
                }
                // Is there no Alarm state active and no delayed trigger?
                // or
                // is there no Alarm state active, but a delayed trigger is true and heimdallSettings.alarmWhileDelayed is true
                if ( (!alarm && !alarmCounterRunning) || (!alarm && alarmCounterRunning && heimdallSettings.alarmWhileDelayed ) ) {
                    if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                        this.log('sourceDeviceFull:           ' + sourceDeviceFull);
                        this.log('sourceDevicePartial:        ' + sourceDevicePartial);
                        this.log('sourceDeviceLog:            ' + sourceDeviceLog);
                        this.log('Alarm is triggered:         Yes')
                        //let zone = await this.getZoneName(device.zone)
                        let delayOverruled = ".";
                        if ( alarmCounterRunning && !this.isDelayed(device) ) {
                            this.log('Alarm counter active:       Yes');
                            alarmCounterRunning = false;
                            delayOverruled = this.homey.__("history.delayoverruled");
                        } 

                        logLine = "al " + nu + this.readableMode(surveillance) + " || Heimdall || " + device.name + " in " + device.zoneName + this.homey.__("history.triggerdalarm") + delayOverruled
                        //logLine = "al " + nu + this.readableMode(surveillance) + " || Heimdall || " + device.name + " in " + zone + this.homey.__("history.triggerdalarm") + delayOverruled

                        if ( sensorType == 'motion' ) {
                            this.speak("motionTrue", device.name + " detected motion") 
                        }
                        if ( sensorType == 'contact' ) {
                            this.speak("doorOpen", device.name + " is opened") 
                        }         
                        if ( sensorType == 'tamper') {
                            this.speak("tamper", device.name + " detected tampering")
                        }         
                        if ( this.isDelayed(device) ) {
                            if ( alarmCounterRunning ) {
                                this.log("Device is delayed and there is already an Alarm Counter active.")
                                return
                            }
                            // The device has a delayed trigger
                            alarmCounterRunning = true;
                            this.log('alarmCounterRunning:        true')
                            logLine = "ad "+ nu + this.readableMode(surveillance) + " || Heimdall || " + this.homey.__("history.alarmdelayed") + heimdallSettings.alarmDelay + this.homey.__("history.seconds") + '\n' + logLine
                            let delay = heimdallSettings.alarmDelay * 1000;
                            // Trigger delay flow card
                            var tokens= { 'Reason': device.name + ': '+ sensorStateReadable , 'Zone': device.zoneName , 'Duration': heimdallSettings.alarmDelay * 1 };
                            //var tokens= { 'Reason': device.name + ': '+ sensorStateReadable , 'Zone': zone , 'Duration': heimdallSettings.alarmDelay * 1 };
                            this.homey.flow.getTriggerCard('AlarmDelayActivated').trigger(tokens)
                                .catch(this.error)
                                .then()

                            this.log('alarmCounterRunning:        true')
                            this.log('alarm is delayed:           Yes, ' + heimdallSettings.alarmDelay + ' seconden')
                            //speak("The alarm will go off in " + heimdallSettings.alarmDelay + " seconds.")
                            this.speak("alarmCountdown", this.homey.__("speech.startalarmcountdown") + heimdallSettings.alarmDelay + this.homey.__("speech.seconds"))
                            this.log('ttAlarmCountdown start:     ' + heimdallSettings.alarmDelay)
                            // Trigger Time Till Alarm flow card
                            let tta = heimdallSettings.alarmDelay - 1;
                            this.ttAlarmCountdown(tta, device,sensorStateReadable);
                            // Generate Homey wide event for starting the Alarm Delay
                            this.systemEvent("Alarm Delay", tta + 1);
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
                        logLine = color + nu + this.readableMode(surveillance) + " || Heimdall || " + device.name + ": " + sensorStateReadable + this.homey.__("history.noalarmtriggercountdown");
                    }
                } 
                else if ( alarm ) {
                    // Alarm state is active
                    if ( ( surveillance == 'armed' && sourceDeviceFull ) || ( surveillance == 'partially_armed' && sourceDevicePartial ) ) {
                        this.log('Alarmstate Active:          The Alarm State is active so just log the sensorstate')
                        logLine = color + nu + this.readableMode(surveillance) + " || Heimdall || " + device.name + ": " + sensorStateReadable + this.homey.__("history.noalarmtriggeralarmstate");
                        //let zone = await this.getZoneName(device.zone)
                        var tokens = {'Zone': device.zoneName, 'Device': device.name, 'State': sensorStateReadable};
                        //var tokens = {'Zone': zone, 'Device': device.name, 'State': sensorStateReadable};
                        this.homey.flow.getTriggerCard('SensorTrippedInAlarmstate').trigger(tokens)
                            .catch(this.error)
                            .then()
                    }
                }
            } 
            else {
            // sensorState is false
                if ( sensorType == 'contact' && this.isDelayed(device) && armCounterRunning && lastDoor ) {
                    // a Doorsensor with a delay is opened and closed while the arming countdown is running
                    this.log('lastDoor:                   Closed, countdown will be lowered')
                    changeTta = true;
                    // Generate Homey wide event for Last Door Function
                    this.systemEvent( "Last Door function","Activated" );
                }
            }

            let shouldLog = true;
            // this.log('logArmedOnly:               ' + heimdallSettings.logArmedOnly + ', Surveillance Mode: ' + surveillance)
            // this.log('logTrueOnly:                ' + heimdallSettings.logTrueOnly + ', Sensorstate: ' + sensorState)
            if ( heimdallSettings.logArmedOnly && surveillance === 'disarmed' && !sourceDeviceLog )  {
                shouldLog = false;
                // this.log('LogArmedOnly is true and Surveillance is off, so no log line')
            }
            if ( heimdallSettings.logTrueOnly && !sensorState && !sourceDeviceLog ) {
                shouldLog = false;
                // this.log('logTrueOnly is true and sensorstate is false, so no log line')
            }
            if ( shouldLog ) {
                this.writeLog(logLine)
            }
            if ( sourceDeviceLog ) {
                // trigger the flowcard when a device with logging changes state
                //let zone = await this.getZoneName(device.zone);
                var tokens = {'Zone': device.zoneName, 'Device': device.name, 'State': sensorStateReadable};
                //var tokens = {'Zone': zone, 'Device': device.name, 'State': sensorStateReadable};
                this.homey.flow.getTriggerCard('LogLineWritten').trigger(tokens)
                    .catch(this.error)
                    .then()
            }
        }
    }

    // sets Surveillance Mode
    // - Called from setNewState(newState) in Surveillance Mode device.js
    //   will call setSurveillanceValue() after evaluating conditions.
    setSurveillanceMode(value, source) {
        this.log('setSurveillanceMode:        ' + value);
        let nu =this.getDateTime();
        let logLine = "";    
        surveillance = this.homey.settings.get('surveillanceStatus');
        if ( value === 'disarmed' ) {
            // Surveillance Mode is set to Disarmed
            logLine = this.readableMode(value) + " || " + source + " || " + this.homey.__("history.smodedisarmed")
            this.setSurveillanceValue("sd ",value, logLine, false)
            this.homey.app.deactivateAlarm(false, this.homey.__("devices.surveillancemode.name"))
            if ( armCounterRunning ) {
                // code to cancel an arm command during delayArming
                this.log('Need to stop arming!')
                armCounterRunning = false;
            }
        } else {
            // Surveillance Mode is set to Armed or Partially Armed
            if ( value === 'armed' ) {
                logLine = this.readableMode(value) + " || " + source + " || " + this.homey.__("history.smodearmed")
            } else { 
                logLine = this.readableMode(value) + " || " + source + " || " + this.homey.__("history.smodepartiallyarmed")
            }
            // Does this need 
            this.homey.app.checkAllDevicesState();
            if ( (value == 'armed' && heimdallSettings.delayArmingFull) || (value == 'partially_armed' && heimdallSettings.delayArmingPartial )  ) {
                // (Partially) Arming is delayed
                this.log('Arming is delayed:          Yes, ' + heimdallSettings.armingDelay + ' seconds.')
                if ( armCounterRunning ) {
                    this.log('Armingdelay already active: Not starting a new one')
                    return
                }
                this.log('setSurveillanceValue in:    ' + heimdallSettings.armingDelay + ' seconds.')
                this.speak("armCountdown", this.homey.__("speech.startarmcountdown") + this.readableMode(value) + this.homey.__("speech.in") + heimdallSettings.armingDelay + this.homey.__("speech.seconds"))
                armCounterRunning = true;
                let tta = heimdallSettings.armingDelay;
                this.ttArmedCountdown(tta,"sa ", value, logLine);

                var tokens= { 'Duration': heimdallSettings.armingDelay * 1 };
                this.homey.flow.getTriggerCard('ArmDelayActivated').trigger(tokens)
                    .catch(this.error)
                    .then()
                
                // Generate Homey wide event for starting the Arming Delay
                this.systemEvent("Arming Delay", tta);

                if ( value == 'armed' ) {
                    logLine = "st " + nu + this.readableMode(surveillance) + " || " + source + " || " + this.homey.__("history.smodedelayarmed") + heimdallSettings.armingDelay + this.homey.__("history.seconds")
                } else { 
                    logLine = "st " + nu + this.readableMode(surveillance) + " || " + source + " || " + this.homey.__("history.smodedelaypartiallyarmed") + heimdallSettings.armingDelay + this.homey.__("history.seconds")
                }
                this.writeLog(logLine)
                // Check the states of the sensors 
                if ( heimdallSettings.checkBeforeCountdown ) {
                    this.homey.app.checkDevicesState(value, nu)
                }
            } else {
                // (Partially) Arming is not delayed
                this.log('Arming is delayed:          No')
                armCounterRunning = true;
                this.setSurveillanceValue("sa ",value, logLine, true)
            }
            if ( value === 'armed' || value === 'partially_armed' ) {
                this.homey.app.checkDevicesLastCom(value)
            }
        }
    }

    // Actually sets the Surveillance Mode Value
    // Write result to the log and trigger triggerSurveillanceChanged when needed.
    // - Called from setSurveillanceMode(value, source) when Arming is not delayed.
    // - Called from ttArmedCountdown(delay, color, value, logLine) when Arming is delayed.
    setSurveillanceValue(color,value, logLine, deviceCheck) {
        let nu =this.getDateTime();
        logLine = color + nu + logLine;
        surveillance = this.homey.settings.get('surveillanceStatus');
        lastDoor = false;
        changeTta = false;

        if ( armCounterRunning || value === 'disarmed' ) {
            this.homey.settings.set('surveillanceStatus', value);
            // Generate Homey wide event for setting the Surveillance Mode
            this.systemEvent("Surveillance Mode", value)
            this.speak("sModeChange", this.homey.__("speech.smodeset") + this.readableMode(value))
            this.log('setSurveillanceValue:       '+ value)
            if ( heimdallSettings.notificationSmodeChange ) {
                let message = this.homey.__("notification.smodeset1") + this.readableMode(value) + this.homey.__("notification.smodeset2")
                this.writeNotification(message)
            }
            
            var tokens = { 'mode': this.readableMode(value) };
            this.homey.flow.getTriggerCard('SurveillanceChanged').trigger(tokens)
                .catch(this.error)
                .then()
            
            // Check the states of the sensors 
            if ( deviceCheck ) {
                this.homey.app.checkDevicesState(value, nu)
            }
        } else {
            logLine = "sd " + nu + this.readableMode(surveillance) + " || Heimdall || " + this.homey.__("history.smodechangedisabled")
        }
        this.writeLog(logLine)   
        armCounterRunning = false;
    }

    // Cycle through all devices to check the last communication
    // - Called from setSurveillanceMode(value, source) when setting the Surveillance Mode to (Partially) Armed
    // - Called from actionCheckLastCommunication flow action card
    async checkDevicesLastCom(value) {
        try {
            let allDevices = await this.getDevices()
            
            for (let device in allDevices) {
                this.checkDeviceLastCom(allDevices[device], value)
            };
        } catch(err) {
            this.log("checkDevicesLastCom:        ", err)
        }
    }

    // Check the last communication per device 
    // Write result to the log and trigger triggerNoInfoReceived when needed.
    // - Called from checkDevicesLastCom(value)
    async checkDeviceLastCom(device, value) {
        if ( !device.ready || !device.capabilitiesObj) return
        if ( this.isMonitoredFull(device) || this.isMonitoredPartial(device) ) {
            let nu =this.getDateTime();
            let nuEpoch = Date.now();

            if ( 'alarm_motion' in device.capabilitiesObj || 'alarm_contact' in device.capabilitiesObj ) {
                let mostRecentComE = 0

                for ( let capability in device.capabilitiesObj ) {
                    let lu = Date.parse(device.capabilitiesObj[capability].lastUpdated)

                    if ( lu > mostRecentComE  ) {
                        mostRecentComE = lu
                    }
                }

                let mostRecentComH = new Date( mostRecentComE )
                let verschil = Math.round((nuEpoch - mostRecentComE)/1000)
                
                if ( verschil > heimdallSettings.noCommunicationTime * 3600 ) {
                    let d = new Date(0);
                    d.setUTCSeconds(Date.parse(mostRecentComH)/1000);
                    let lastUpdateTime = d.toLocaleString();

                    let tempColor = 'mp-'
                    //let zone = await this.getZoneName(device.zone)
                    let tempLogLine = tempColor + nu + this.readableMode(value) + " || Heimdall || " + device.name + " in " + device.zoneName + this.homey.__("history.noreport") + heimdallSettings.noCommunicationTime + this.homey.__("history.lastreport") + lastUpdateTime
                    //let tempLogLine = tempColor + nu + this.readableMode(value) + " || Heimdall || " + device.name + " in " + zone + this.homey.__("history.noreport") + heimdallSettings.noCommunicationTime + this.homey.__("history.lastreport") + lastUpdateTime
                    this.writeLog(tempLogLine)
                    this.log("checkDeviceLastCom:         " + device.name + " - did not communicate in last 24 hours")
                    if ( heimdallSettings.notificationNoCommunicationMotion && 'alarm_motion' in device.capabilitiesObj ) {
                        let message = '**' + device.name + '** in ' + device.zoneName + this.homey.__("history.noreport") + heimdallSettings.noCommunicationTime + this.homey.__("history.lastreport") + lastUpdateTime
                        //let message = '**' + device.name + '** in ' + zone + this.homey.__("history.noreport") + heimdallSettings.noCommunicationTime + this.homey.__("history.lastreport") + lastUpdateTime
                        this.writeNotification(message)
                    }
                    if ( heimdallSettings.notificationNoCommunicationContact && 'alarm_contact' in device.capabilitiesObj ) {
                        let message = '**' + device.name + '** in ' + device.zoneName + this.homey.__("history.noreport") + heimdallSettings.noCommunicationTime + this.homey.__("history.lastreport") + lastUpdateTime
                        //let message = '**' + device.name + '** in ' + zone + this.homey.__("history.noreport") + heimdallSettings.noCommunicationTime + this.homey.__("history.lastreport") + lastUpdateTime
                        this.writeNotification(message)
                    }

                    var tokens = {'Zone': device.zoneName, 'Device': device.name, 'LastUpdate': lastUpdateTime, 'Duration': heimdallSettings.noCommunicationTime};
                    //var tokens = {'Zone': zone, 'Device': device.name, 'LastUpdate': lastUpdateTime, 'Duration': heimdallSettings.noCommunicationTime};
                    this.homey.flow.getTriggerCard('noInfoReceived').trigger(tokens)
                        .catch(this.error)
                        .then()
                } else {
                    this.log("checkDeviceLastCom:         " + device.name + " - communicated in last 24 hours")
                }
            }
        }
    }

    // Cycle through all devices to check the Device State when setting the Surveillance Mode
    // - Called from setSurveillanceMode(value, source) when setting 
    //   the Surveillance Mode Delayed to (Partially) Armed and heimdallSettings.checkBeforeCountdown is true
    // - Called from setSurveillanceValue(color,value, logLine, deviceCheck) when setting
    //   the Surveillance Mode to (Partially) Armed or Delayed to (Partially) Armed and 
    //   heimdallSettings.checkBeforeCountdown is false
    async checkDevicesState(value, nu) {
        try {
            let allDevices = await this.getDevices()
            for (let device in allDevices) {
                this.checkDeviceState(allDevices[device], value, nu)
            };
        } catch(err) {
            this.log("checkDevicesLastCom:        ", err)
        }
    }
    
    // Check the state per device when included in the chosen Surveillance Mode 
    // Write result to the log and call alertSensorActiveAtArming when needed
    // - Called from checkDevicesState(value, nu)
    async checkDeviceState(device, value, nu) {
        if ( !device.ready || !device.capabilitiesObj) return
        let sensorState
        let sensorStateReadable
        let sensorType

        if ( 'alarm_motion' in device.capabilitiesObj && heimdallSettings.checkMotionAtArming ) {
            sensorState = device.capabilitiesObj.alarm_motion.value
            sensorStateReadable =this.readableState(sensorState, 'motion')
            sensorType = 'motion'
            this.log("checkDeviceState:           " + device.name + " - " + sensorType + ": " + sensorStateReadable)
        }
        if ( 'alarm_contact' in device.capabilitiesObj && heimdallSettings.checkContactAtArming ) {
            sensorState = device.capabilitiesObj.alarm_contact.value
            sensorStateReadable =this.readableState(sensorState, 'contact')
            sensorType = 'contact'
            this.log("checkDeviceState:           " + device.name + " - " + sensorType + ": " + sensorStateReadable)
        };
        if ( value == 'armed' ) {
            if ( this.isMonitoredFull(device) ) {
                if ( sensorState ) {
                    let delayText = ""
                    if ( this.isDelayed(device) ) {
                        delayText = this.homey.__("atarming.delayText")
                    }
                    if ( sensorType == 'motion' ) {
                        this.alertSensorActiveAtArming(value, nu, sensorType, this.homey.__("atarming.warningMotion") + sensorStateReadable + this.homey.__("atarming.on") + device.name + delayText)
                    } else if ( sensorType == 'contact') {
                        this.alertSensorActiveAtArming(value, nu, sensorType, this.homey.__("atarming.warningContact") + device.name + this.homey.__("atarming.is") + sensorStateReadable + delayText) 
                    }
                }
            }
        }
        else if ( value == 'partially_armed' ) {
            if ( this.isMonitoredPartial(device) ) {
                if ( sensorState ) {
                    let delayText = ""
                    if ( this.isDelayed(device) ) {
                        delayText = this.homey.__("atarming.delayText")
                    }   
                    if ( sensorType == 'motion' ) {
                        this.alertSensorActiveAtArming(value, nu, sensorType, this.homey.__("atarming.warningMotion") + sensorStateReadable + this.homey.__("atarming.on") + device.name + delayText)
                    } else if ( sensorType == 'contact' ) {
                        this.alertSensorActiveAtArming(value, nu, sensorType, this.homey.__("atarming.warningContact") + device.name + this.homey.__("atarming.is") + sensorStateReadable + delayText) 
                    }
                }
            }
        }
    }

    // When a sensor is active thats included in the chosen Surveillance Mode.
    // Write result to the log and trigger triggerSensorActiveAtArming
    // Generate Homey wide event and tell the user
    // - Called from checkDeviceState(device, value, nu)
    alertSensorActiveAtArming( value, nu, sensorType, warningText ) {
        let color = 'm' + value.substring(0,1) + '-'
        let logLine = color + nu + this.readableMode(value) + " || Heimdall || " + warningText
        this.writeLog(logLine)
        // activate triggercard
        var tokens = { 'warning': warningText };
        this.homey.flow.getTriggerCard('sensorActiveAtArming').trigger(tokens)
            .catch(this.error)
            .then()

        // Generate Homey wide event for an active sensor at arming
        this.systemEvent( "Sensor State at Arming","Active" );

        // Tell user
        if ( sensorType == 'motion' && heimdallSettings.spokenMotionAtArming ) {
            this.speak("sensorActive", warningText)
        } else if ( sensorType == 'contact' && heimdallSettings.spokenDoorOpenAtArming ) {
            this.speak("sensorActive", warningText)
        }
    }

    // Cycle through all devices to check the Device State from a flow
    // - Called from actionAllDevicesStateCheck flow action card
    async checkAllDevicesState() {
        try {
            let allDevices = await this.getDevices()
            for (let device in allDevices) {
                this.checkAllDeviceState(allDevices[device])
            };
        } catch(err) {
            this.log("checkAllDevicesState:       ", err)
        }
    }

    // Check the state per device
    // Write result to the log and call alertSensorActive(device, sensorType, sensorStateReadable) when needed
    // - Called from checkAllDevicesState()    
    async checkAllDeviceState(device) {
        if ( await this.checkReadyState(device) ) return
        let sensorState = false
        let sensorStateReadable
        let sensorType
        if ( 'alarm_motion' in device.capabilitiesObj ) {
            sensorState = device.capabilitiesObj.alarm_motion.value
            sensorStateReadable =this.readableState(sensorState, 'motion')
            sensorType = 'Motion'
            this.log("checkAllDeviceState:        " + device.name + " - " + sensorType + ": " + sensorStateReadable)
        }
        if ( 'alarm_contact' in device.capabilitiesObj ) {
            sensorState = device.capabilitiesObj.alarm_contact.value
            sensorStateReadable =this.readableState(sensorState, 'contact')
            sensorType = 'Contact'
            this.log("checkAllDeviceState:        " + device.name + " - " + sensorType + ": " + sensorStateReadable)
        };
        if ( sensorState ) {
            this.alertSensorActive (device, sensorType, sensorStateReadable)
        }
    }

    // When a sensor is active when the Device State is checked from a flow
    // Trigger triggerSensorActive
    // - Called from checkAllDeviceState(device)
    async alertSensorActive( device, sensorType, sensorstateReadable ) {
        //let zone = await this.getZoneName(device.zone)
        var tokens = { 'Zone': device.zoneName, 'Device': device.name, 'Device type': sensorType, 'State': sensorstateReadable }
        //var tokens = { 'Zone': zone, 'Device': device.name, 'Device type': sensorType, 'State': sensorstateReadable }
        this.homey.flow.getTriggerCard('sensorActiveAtSensorCheck').trigger(tokens)
            .catch(this.error)
            .then()
    }

    // Check if a device is in ready state
    // Update the devicesNotReadyAtStart and devicesNotReady lists
    // - Called from checkAllDeviceState(device)
    async checkReadyState(device) {
        if ( !device.ready ) {
            // The device is not ready
            // Check if the device is in the devicesNotReadyAtStart list
            for (let deviceNotReady in devicesNotReadyAtStart) {
                if ( device.id == devicesNotReadyAtStart[deviceNotReady] ) {                   
                    // The device has not been ready yet, no action
                    return true
                }
            }
            // The device is not in the devicesNotReadyAtStart list so it has been ready
            // Add to the devicesNotReady list
            devicesNotReady.push(device.id)
            // And log this
            this.log("Device no longer ready:     " + device.name)
            let nu =this.getDateTime();
            let logLine = "al " + nu + this.readableMode(surveillance) + " || " + this.homey.__("devicecheck.source") + " || " + device.name + this.homey.__("devicecheck.warning")
            for ( let cap in device.capabilities ) {
                if ( [ "alarm_motion", "alarm_contact", "alarm_vibration" ].includes( device.capabilities[cap] ) ) {
                    this.writeLog(logLine)
                }
            }                   
            return true
        } else {
            // The device is ready
            // Check if the device is in the devicesNotReadyAtStart list
            var tempArray = devicesNotReadyAtStart;
            for (let deviceNotReady in devicesNotReadyAtStart) {
                if ( device.id == devicesNotReadyAtStart[deviceNotReady] ) {
                    // The device has not been ready yet
                    // So add the device
                    this.addDevice(device);
                    // Remove device from devicesNotReadyAtStart list
                    tempArray.splice(deviceNotReady,1)
                    // And log it
                    this.log("Device now ready:           " + device.name)
                    let nu =this.getDateTime();
                    let logLine = "ao " + nu + this.readableMode(surveillance) + " || " + this.homey.__("devicecheck.source") + " || " + device.name + this.homey.__("devicecheck.ready")
                    for ( let cap in device.capabilities ) {
                        if ( [ "alarm_motion", "alarm_contact", "alarm_vibration" ].includes( device.capabilities[cap] ) ) {
                            this.writeLog(logLine)
                        }
                    }
                    return false
                }
            }
            devicesNotReadyAtStart = tempArray;
            // Check if the device is in the devicesNotReady list
            var tempArray = devicesNotReady;
            for (let deviceReady in devicesNotReady) {
                if ( device.id == devicesNotReady[deviceReady] ) {
                    // The device has been ready, was unready and is ready again
                    // Log this
                    this.log("Device became ready again:  " + device.name)
                    let nu =this.getDateTime();
                    let logLine = "ao " + nu + this.readableMode(surveillance) + " || " + this.homey.__("devicecheck.source") + " || " + device.name + this.homey.__("devicecheck.readyagain")
                    for ( let cap in device.capabilities ) {
                        if ( [ "alarm_motion", "alarm_contact", "alarm_vibration" ].includes( device.capabilities[cap] ) ) {
                            this.writeLog(logLine)
                        }
                    }   
                    // Remove the device from deviceNotReady list
                    tempArray.splice( deviceReady, 1 )               
                    return false
                }
            }
            devicesNotReady = tempArray;
            return false
        }
    }

    // Activates the Alarm State
    // Write to log, trigger triggerAlarmActivated, Write to Timeline (Depending on setting) and tell user
    // Generate Homey wide event
    // - Called from async stateChange(device,sensorState,sensorType) when not delayd
    // - Called from ttAlarmCountdown(delay,device,sensorStateReadable) when delayd
    async activateAlarm(device,sensorState,nu,source) {
        if ( nu == "" ) { 
            nu =this.getDateTime()
        }
        let logLine = ""
        alarm = true
        this.log("Alarm status:               activated")
        surveillance = this.homey.settings.get('surveillanceStatus')
        if ( surveillance != 'disarmed' || source == "Flowcard" ) {
            // Surveillance mode is active
            // let zone = await this.getZoneName(device.zone)
            if ( source == "Heimdall") {
                var tokens= {'Reason': device.name + ': '+ sensorState , 'Zone': device.zoneName };
                //var tokens= {'Reason': device.name + ': '+ sensorState , 'Zone': zone };
                logLine = "al " + nu + this.readableMode(surveillance) + " || " + source + " || " + this.homey.__("history.alarmactivated") + device.name + ": " + sensorState;
            } else {
                var tokens= {'Reason': 'Flowcard' , 'Zone': "" };
                logLine = "al " + nu + this.readableMode(surveillance) + " || " + source + " || " + this.homey.__("history.alarmactivatedflowcard");
            }
            this.homey.flow.getTriggerCard('AlarmActivated').trigger(tokens)
                .catch(this.error)
                .then()

            if ( heimdallSettings.notificationAlarmChange ) {
                let message = '**'+device.name+'** in '+ device.zoneName + this.homey.__("history.triggerdalarm")
                //let message = '**'+device.name+'** in '+ zone + this.homey.__("history.triggerdalarm")
                this.writeNotification(message)
            }

            this.speak("alarmChange", this.homey.__("speech.alarmactivated"))
            // save alarm status
            this.homey.settings.set('alarmStatus', alarm)
            // Check if Alarm Off Button exists and turn on 
            if ( aModeDevice != undefined ) {
                aModeDevice.setCapabilityValue('alarm_heimdall', true).catch(err => this.log('setting alarm_heimdall failed', err));
                // aModeDevice.setCapabilityValue('alarm_generic', true).catch(err => this.log('setting alarm_generic failed', err));
            }
            if ( sModeDevice != undefined ) {
                sModeDevice.setCapabilityValue('alarm_heimdall', true).catch(err => this.log('setting alarm_heimdall failed', err));
                // sModeDevice.setCapabilityValue('alarm_generic', true).catch(err => this.log('setting alarm_generic failed', err));
            }
        }
        else {
            // Surveillance mode is not active
            logLine = "ao " + nu + this.readableMode(surveillance) + " || " + source + " || " + this.homey.__("history.alarmnotactivated")
            alarm = false;
            this.homey.settings.set('alarmStatus', alarm)
        }  
        // write information to log
        this.writeLog(logLine)
        // Generate Homey wide event for setting the Alarm Status
        this.systemEvent("Alarm Status", alarm)
    }

    // Deactivates the Alarm State
    // Write to log, trigger triggerAlarmDeactivated, Write to Timeline (Depending on setting) and tell user
    // Generate Homey wide event
    // - Called from setSurveillanceMode(value, source) when the Surveillance Mode is set to Disarmed
    // - Called from Flow Card Deactivate Alarm
    // - Called from onCapabilityBoolean( value, opts, callback ) in Surveillance Mode Device
    // - Called from onCapabilityBoolean( value, opts, callback ) in Alarm Off Switch
    deactivateAlarm(value, source) {
        if ( alarm === true || source == "Flowcard" ) {
            let nu =this.getDateTime();
            alarm = false;
            this.log("Alarm status:               deactivated");
            surveillance = this.homey.settings.get('surveillanceStatus');
            this.homey.settings.set('alarmStatus', alarm);
            this.speak("alarmChange", this.homey.__("speech.alarmdeactivated"));
            // Check if Alarm Off Button exists and turn off
            if ( aModeDevice != undefined ) {
                aModeDevice.setCapabilityValue('alarm_heimdall', false).catch(err => this.log('setting alarm_heimdall failed', err));
                // aModeDevice.setCapabilityValue('alarm_generic', false).catch(err => this.log('setting alarm_generic failed', err));
            }
            if ( sModeDevice != undefined ) {
                sModeDevice.setCapabilityValue('alarm_heimdall', false).catch(err => this.log('setting alarm_heimdall failed', err));
                // sModeDevice.setCapabilityValue('alarm_generic', false).catch(err => this.log('setting alarm_generic failed', err));
            }
            var tokens = { 'Source': source };
            this.homey.flow.getTriggerCard('AlarmDeactivated').trigger(tokens)
                .catch(this.error)
                .then() 

            let logLine = "ao "+ nu + this.readableMode(surveillance) + " || " + source + " || " + this.homey.__("history.alarmdeactivated") + source;
            this.writeLog(logLine);
            if ( heimdallSettings.notificationAlarmChange ) {
                let message = this.homey.__("history.alarmdeactivated") + '**' + source + '**';
                this.writeNotification(message);
            }
            // Generate Homey wide event when setting the Alarm Status
            this.systemEvent("Alarm Status", alarm);
        }
    }

    // Write information to the Heimdall log and cleanup 20% when history above 2000 lines
    // - Called from multiple functions
    async writeLog(logLine) {
        let savedHistory = this.homey.settings.get('myLog');
        if ( savedHistory != undefined ) { 
            // cleanup history
            let lineCount = savedHistory.split(/\r\n|\r|\n/).length;
            if ( lineCount > 2000 ) {
                let deleteItems = parseInt( lineCount * 0.2 );
                let savedHistoryArray = savedHistory.split(/\r\n|\r|\n/);
                let cleanUp = savedHistoryArray.splice(-1*deleteItems, deleteItems, "" );
                savedHistory = savedHistoryArray.join('\n'); 
            }
            // end cleanup
            logLine = logLine + "\n" + savedHistory;
        } else {
            console.log("savedHistory is undefined!")
        }
        this.homey.settings.set('myLog', logLine );
//console.log(logLine);
        logLine = "";
    }

    // Write notification to the Timeline of the Homey App
    // - Called from multiple functions
    // - Called from actionInputNotification Flow Card
    async writeNotification(message) {
        this.homey.notifications.createNotification({ excerpt: message })
            .then(() => {})
            .catch(() => {})
    }

    // Let's Homey speak when spoken text is enabled.
    // - Called from multiple functions
    // - Only for Homey Pro -2023
    async speak(type, text) {
        if ( this.homey.platformVersion != 1 ) return
        if ( type == "sModeChange" && heimdallSettings.spokenSmodeChange ) {
            this.log('Say:                        ' + text)
            this.homey.speechOutput.say(text.toString())
         }
        if ( type == "alarmCountdown" && heimdallSettings.spokenAlarmCountdown ) {
            this.log('Say:                        ' + text)
            this.homey.speechOutput.say(text.toString())
        }
        if ( type == "armCountdown" && heimdallSettings.spokenArmCountdown ) {
            this.log('Say:                        ' + text)
            this.homey.speechOutput.say(text.toString())
        }
        if ( type == "alarmChange" && heimdallSettings.spokenAlarmChange ) {
            this.log('Say:                        ' + text)
            this.homey.speechOutput.say(text.toString())
        }
        if ( type == "motionTrue" && heimdallSettings.spokenMotionTrue ) {
            this.log('Say:                        ' + text)
            this.homey.speechOutput.say(text.toString())
        }
        if ( type == "doorOpen" && heimdallSettings.spokenDoorOpen ) {
            this.log('Say:                        ' + text)
            this.homey.speechOutput.say(text.toString())
        }
        if ( type == "tamper" && heimdallSettings.spokenTamperTrue ) {
            this.log('Say:                        ' + text)
            this.homey.speechOutput.say(text.toString())
        }    
        if ( type == "sensorActive") {
            this.log('Say:                        ' + text)
            this.homey.speechOutput.say(text.toString())
        }
    }

    // Countdown function for a delayed Arming
    // - Started from setSurveillanceMode(value, source)
    //  and calling itself every second until the timer is 0
    // - Calling setSurveillanceValue(color, value, logLine, false) when timer is 0
    ttArmedCountdown(delay, color, value, logLine) {
        this.log('ttArmedCountdown:           ' + delay)
        if ( armCounterRunning ) {
            if ( changeTta && delay > 9 ) {
                delay = 10;
                changeTta = false
                var prevLogLine = logLine      
                logLine = "st " +this.getDateTime() + this.readableMode(surveillance) + " || Heimdall || " + this.homey.__("history.smodedelaychanged")
                this.writeLog(logLine)
                logLine = prevLogLine
            }
            var tokens = { 'ArmedTimer': delay * 1};
            this.homey.flow.getTriggerCard('TimeTillArmed').trigger(tokens)
                .catch(this.error) 
                .then()

            // Generate Homey wide event advertising the delay left
            this.systemEvent("Arming Delay left", delay);

            if ( delay > 9 ) {
                if (delay/5 == parseInt(delay/5)) {
                    this.speak("armCountdown", delay)
                }
            } 
            else if ( delay > 0 )  {
                this.speak("armCountdown", delay)
            }
            if ( delay > 0 ) {
                this.homey.setTimeout(() => {
                    this.ttArmedCountdown(delay-1, color, value, logLine)
                }, 1000);
            }
            else if ( delay == 0 ) {
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
    
    // Countdown function for a delayed Alarm
    // - Started from stateChange(device,sensorState,sensorType)
    //  and calling itself every second until the timer is 0
    // - Calling activateAlarm(device, sensorStateReadable, "", "Heimdall") when timer is 0
    ttAlarmCountdown(delay,device,sensorStateReadable) {
        if ( !alarmCounterRunning ) {
            this.log('Alarm counter active:       Yes, break off delayed alarm')
            return
        }
        this.log('ttAlarmCountdown:       ' + delay)
        surveillance = this.homey.settings.get('surveillanceStatus');
        if ( surveillance != 'disarmed' ) {
            var tokens = { 'AlarmTimer': delay * 1};
            this.homey.flow.getTriggerCard('TimeTillAlarm').trigger(tokens)
                .catch(this.error)
                .then()
                
            // Generate Homey wide event advertising the delay left
            this.systemEvent("Alarm Delay left", delay);
            
            if ( delay > 9 ) {
                if ( delay/5 == parseInt(delay/5) ) {
                    this.speak("alarmCountdown", delay)
                }
            } 
            else if ( delay > 0 )  {
                this.speak("alarmCountdown", delay)
            }
            if ( delay > 0 ) {
                this.homey.setTimeout(() => {
                    this.ttAlarmCountdown(delay-1,device,sensorStateReadable)
                }, 1000);
            } 
            else if ( delay == 0 ) {
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
    // - Called from multiple functions and events are sent for:
    // Alarm Delay left, Alarm Status, Arming Delay left, Last Door function, Sensor State at Arming, Surveillance Mode
    systemEvent(event, details)
    {
        this.homey.api.realtime(event, details)
    }

    // Check if there is a user with the provide PIN and return the userObject if so
    // - Called from processKeypadCommands(post, type), processUsers(modifiedUser, action) and getUsers(pin)
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

    // Should this device be logged
    isLogged(device) {
        let devicesLogged = this.homey.settings.get('loggedDevices')
        let i;
        if ( devicesLogged !== null ) {
            for (i = 0; i < devicesLogged.length; i++) {
                if ( devicesLogged[i] && devicesLogged[i].id == device.id ) {
                    return true;
                }
            }
        }
        return false;
    }

    // add Logging to Device
    addLoggingTo(device) {
        if ( !this.isLogged(device) ) {
            let devicesLogged = this.homey.settings.get('loggedDevices')
            if ( devicesLogged == null ) { devicesLogged = [] }
            devicesLogged.push(device)
            this.homey.settings.set('loggedDevices',devicesLogged)
            this.removeMonitorFullFrom(device)
            this.removeMonitorPartialFrom(device)
            this.removeDelayFrom(device)
        }
    }

    // Remove Logging from Device
    removeLoggingFrom(device) {
        if ( this.isLogged(device) ) {
            let devicesLogged = this.homey.settings.get('loggedDevices')
            if ( devicesLogged !== null ) {
                let i;
                for (i = 0; i < devicesLogged.length; i++) {
                    if ( devicesLogged[i] && devicesLogged[i].id == device.id ) {
                        devicesLogged.splice(i, 1);
                    }
                }
                this.homey.settings.set('loggedDevices',devicesLogged)
            }
        }
    }

    // Should this device be monitored
    isMonitoredFull(device) {
        let devicesMonitoredFull = this.homey.settings.get('monitoredFullDevices')
        let i;
        if ( devicesMonitoredFull !== null ) {
            for (i = 0; i < devicesMonitoredFull.length; i++) {
                if ( devicesMonitoredFull[i] && devicesMonitoredFull[i].id == device.id ) {
                    return true;
                }
            }
        }
        return false;
    }

    // add Monitor Full to Device
    async addMonitorFullTo(device) {
        if ( !this.isMonitoredFull(device) ) {
            let devicesMonitoredFull = await this.homey.settings.get('monitoredFullDevices')
            if ( devicesMonitoredFull == null ) { devicesMonitoredFull = [] }
            devicesMonitoredFull.push(device)
            this.homey.settings.set('monitoredFullDevices',devicesMonitoredFull)
            if ( this.isLogged(device) ) {
                this.removeLoggingFrom(device)
            }
        }
    }

    // remove Monitor Full from Device
    removeMonitorFullFrom(device) {
        if ( this.isMonitoredFull(device) ) {
            let devicesMonitoredFull = this.homey.settings.get('monitoredFullDevices')
            if ( devicesMonitoredFull !== null ) {
                let i;
                for (i = 0; i < devicesMonitoredFull.length; i++) {
                    if ( devicesMonitoredFull[i] && devicesMonitoredFull[i].id == device.id ) {
                        devicesMonitoredFull.splice(i, 1);
                    }
                }
                this.homey.settings.set('monitoredFullDevices',devicesMonitoredFull)
            }
            if ( !this.isMonitoredPartial(device) ) {
                this.removeDelayFrom(device)
            }
        } 
    }

    // Should this device be monitored
    isMonitoredPartial(device) {
        let devicesMonitoredPartial = this.homey.settings.get('monitoredPartialDevices')
        let i;
        if ( devicesMonitoredPartial !== null ) {
            for (i = 0; i < devicesMonitoredPartial.length; i++) {
                if ( devicesMonitoredPartial[i] && devicesMonitoredPartial[i].id == device.id ) {
                    return true;
                }
            }
        }
        return false;
    }

    // add Monitor Partial to Device
    async addMonitorPartialTo(device) {
        if ( !this.isMonitoredPartial(device) ) {
            let devicesMonitoredPartial = await this.homey.settings.get('monitoredPartialDevices')
            if ( devicesMonitoredPartial == null ) { devicesMonitoredPartial = [] }
            devicesMonitoredPartial.push(device)
            this.homey.settings.set('monitoredPartialDevices',devicesMonitoredPartial)
            if ( this.isLogged(device) ) {
                this.removeLoggingFrom(device)
            }
        }
    }

    // remove Monitor Partial from Device
    removeMonitorPartialFrom(device) {
        if ( this.isMonitoredPartial(device) ) {
            let devicesMonitoredPartial = this.homey.settings.get('monitoredPartialDevices')
            if ( devicesMonitoredPartial !== null) {
                let i;
                for (i = 0; i < devicesMonitoredPartial.length; i++) {
                    if ( devicesMonitoredPartial[i] && devicesMonitoredPartial[i].id == device.id ) {
                        devicesMonitoredPartial.splice(i, 1);
                    }
                }
                this.homey.settings.set('monitoredPartialDevices',devicesMonitoredPartial)
            }
            if ( !this.isMonitoredFull(device) ) {
                this.removeDelayFrom(device)
            }

        } 
    }

    // Should this trigger be delayed
    isDelayed(device) {
        let devicesDelayed = this.homey.settings.get('delayedDevices')
        let i;
        if ( devicesDelayed !== null) {
            for (i = 0; i < devicesDelayed.length; i++) {
                if ( devicesDelayed[i] && devicesDelayed[i].id == device.id ) {
                    return true;
                }
            }
        }
        return false;
    }

    // add Delay to Device
    async addDelayTo(device) {
        if ( !this.isDelayed(device) ) {
            let devicesDelayed = this.homey.settings.get('delayedDevices')
            if ( devicesDelayed == null ) { devicesDelayed = [] }
            devicesDelayed.push(device)
            this.homey.settings.set('delayedDevices',devicesDelayed)
            if ( !this.isMonitoredFull(device) && !this.isMonitoredPartial(device) ) {
                await this.addMonitorFullTo(device)
                if ( this.isLogged(device) ) {
                    this.removeLoggingFrom(device)
                }
            }
        } 
    }

    // remove Delay from device
    removeDelayFrom(device) {
        if ( this.isDelayed(device) ) {
            let devicesDelayed = this.homey.settings.get('delayedDevices')
            if ( devicesDelayed !== null ) {
                let i;
                for (i = 0; i < devicesDelayed.length; i++) {
                    if ( devicesDelayed[i] && devicesDelayed[i].id == device.id ) {
                        devicesDelayed.splice(i, 1);
                    }
                }
                this.homey.settings.set('delayedDevices',devicesDelayed)
            }
        }
    }

    // Returns a Surveillance Mode in readable format in the users language
    // - Called from multiple functions
    readableMode(mode) {
        if ( mode == 'armed' ) {
            return this.homey.__("modes.armed")
        }
        else if ( mode == 'partially_armed' ) {
            return this.homey.__("modes.partiallyarmed")
        } 
        else if ( mode == 'disarmed' ) {
            return this.homey.__("modes.disarmed")
        }
        else {
            return 'unknown'
        }
    }

    // Returns a devicestate in readable format in the users language
    // - Called from multiple functions
    readableState(sensorState, type) {
        if ( type == 'motion' ) {
            if ( sensorState ) {
                return this.homey.__("states.motion")
                //return 'Motion detected'
            } else {
                return this.homey.__("states.nomotion")
                //return 'No motion detected'
            }
        } else if ( type == 'contact' ) {
            if ( sensorState ) {
                return this.homey.__("states.open")
                //return 'Open'
            } else {
                return this.homey.__("states.closed")
                //return 'Closed'
            }
        } else if ( type == 'vibration' ) {
            if ( sensorState ) {
                return this.homey.__("states.vibration")
                //return 'Vibration detected'
            } else {
                return this.homey.__("states.novibration")
                //return 'No Vibration detected'
            }
        } else if ( type == 'tamper' ) {
            if ( sensorState ) {
                return this.homey.__("states.tamper")
                //return 'Tamper detected'
            } else {
                return this.homey.__("states.notamper")
                //return 'No tamper detected'
            }
        }
        else {
            return 'unknown'
        }
    }

    // Returns a date timestring including milliseconds to be used in loglines
    // - Called from multiple functions
    getDateTime() {
        let timezone = this.homey.clock.getTimezone()
        let date = new Date(new Date().toLocaleString("en-US", {timeZone: timezone}));
        let dateMsecs = new Date();

        let hour = date.getHours();
        hour = (hour < 10 ? "0" : "") + hour;
        let min  = date.getMinutes();
        min = (min < 10 ? "0" : "") + min;
        let sec  = date.getSeconds();
        sec = (sec < 10 ? "0" : "") + sec;
        let msec = ("00" + dateMsecs.getMilliseconds()).slice(-3)
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        month = (month < 10 ? "0" : "") + month;
        let day  = date.getDate();
        day = (day < 10 ? "0" : "") + day;
        return day + "-" + month + "-" + year + "  ||  " + hour + ":" + min + ":" + sec + "." + msec + "  ||  ";
    }

    // Checks if the provided APIKEY is valid
    // - Called from processKeypadCommands(post, type)
    checkAPIKEY(APIKEY) {
        if ( APIKEY == Homey.env.APIKEY1 || APIKEY == Homey.env.APIKEY2 || APIKEY == Homey.env.APIKEY3 || APIKEY == Homey.env.APIKEY4 || APIKEY == Homey.env.APIKEY5 ) {
            return true
        } else {
            return false
        }
    }

}

// Translate text in ChatGPT
/*
In this code en means English, please add Danish, German, French, Italian, Dutch, Norwegian, Spanish and Swedish. Answer in acode block, formatted as json.
{
  "en": "Rolled back change for Homey Pro Early 2023",
}
*/
