//let Homey;
var loading = true;
var useSpeech = true;
var showDevice = false;
let _myLog;
let surveillance;
let alarm;
var allDevices;
var logArmedOnly;
var logTrueOnly;
var dashboardVisible = true;
var statusVisible = false;
var illegalValue = false;
var heimdallSettings = {};
var logLine = {};
var platformVersion = 1;
var language = "en";
var newUser = 0;
var noUser = false;
var transferedUsers = {};
var isAdmin = false;
var canSave = false;
var canCancel = true;
var canDelete = false;
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
    "notificationSmodeChange": false,
    "notificationAlarmChange": false,
    "notificationNoCommunicationMotion": false,
    "notificationNoCommunicationContact": false
};

function onHomeyReady(homeyReady){
    Homey = homeyReady;
    Homey.ready();
    
    // Get platformVersion to determine if Speech options should be shown
    // Homey Pro -2023: Yes
    // Homey Pro 2023:  No
    Homey.get('platformVersion', function(err, savedSettings) {
        if ( err ) {
            Homey.alert( err );
        } else {
            if (savedSettings != (null || undefined)) {
                console.log('platformVersion:', savedSettings);
                platformVersion = savedSettings;
            }
            if ( platformVersion == 2 ) {
                useSpeech = false;    
            }
        }
    });

    // Listen to the 'Surveillance Mode' events emitted by the systemEvent("Surveillance Mode", value) function in app.js
    Homey.on('Surveillance Mode', function(data)
    {
        console.log("Surveillance Mode event received:", data);
    });

    heimdallSettings = defaultSettings;
    Homey.get('settings', function(err, savedSettings) {
        if ( err ) {
            Homey.alert( err );
        } else {
            if (savedSettings != (null || undefined)) {
                console.log('savedSettings:')
                console.log(savedSettings)
                heimdallSettings = savedSettings;
            }
        }
        document.getElementById('autoRefresh').checked = heimdallSettings.autorefresh;
        document.getElementById('useColors').checked = heimdallSettings.useColors;
        document.getElementById('armingDelay').value = heimdallSettings.armingDelay;
        document.getElementById('alarmDelay').value = heimdallSettings.alarmDelay;
        document.getElementById('delayArmingFull').checked = heimdallSettings.delayArmingFull;
        document.getElementById('delayArmingPartial').checked = heimdallSettings.delayArmingPartial;
        document.getElementById('alarmWhileDelayed').checked = heimdallSettings.alarmWhileDelayed;
        document.getElementById('logArmedOnly').checked = heimdallSettings.logArmedOnly;
        document.getElementById('logTrueOnly').checked = heimdallSettings.logTrueOnly;
        document.getElementById('useTampering').checked = heimdallSettings.useTampering;
        document.getElementById('checkMotionAtArming').checked = heimdallSettings.checkMotionAtArming;
        document.getElementById('checkContactAtArming').checked = heimdallSettings.checkContactAtArming;
        document.getElementById('checkBeforeCountdown').checked = heimdallSettings.checkBeforeCountdown;
        if (useSpeech) {
            document.getElementById('spokenSmodeChange').checked = heimdallSettings.spokenSmodeChange;
            document.getElementById('spokenAlarmCountdown').checked = heimdallSettings.spokenAlarmCountdown;
            document.getElementById('spokenArmCountdown').checked = heimdallSettings.spokenArmCountdown;
            document.getElementById('spokenAlarmChange').checked = heimdallSettings.spokenAlarmChange;
            document.getElementById('spokenMotionTrue').checked = heimdallSettings.spokenMotionTrue;
            document.getElementById('spokenTamperTrue').checked = heimdallSettings.spokenTamperTrue;
            document.getElementById('spokenDoorOpen').checked = heimdallSettings.spokenDoorOpen;
            document.getElementById('spokenMotionAtArming').checked = heimdallSettings.spokenMotionAtArming;
            document.getElementById('spokenDoorOpenAtArming').checked = heimdallSettings.spokenDoorOpenAtArming;
        }
        document.getElementById('notificationSmodeChange').checked = heimdallSettings.notificationSmodeChange
        document.getElementById('notificationAlarmChange').checked = heimdallSettings.notificationAlarmChange
        document.getElementById('notificationNoCommunicationMotion').checked = heimdallSettings.notificationNoCommunicationMotion
        document.getElementById('notificationNoCommunicationContact').checked = heimdallSettings.notificationNoCommunicationContact
        if ( document.getElementById('autoRefresh').checked ) {
            document.getElementById("buttonRefresh").style = "display:none";
        } else {
            document.getElementById("buttonRefresh").style = "display:block";
        }
    });

    showTab(1);
    getLanguage();
    refreshHistory();
    refreshStatus();

    new Vue({
        el: '#app',
        data: {
          devices: {},
          zones: {},
          search: '',
          devicesMonitoredFull: [],
          devicesMonitoredPartial: [],
          devicesDelayed: [],
          devicesLogged: [],
          log: []
        },
        methods: {
            getDeviceSettings() {
                Homey.get('monitoredFullDevices', (err, result) => {
                    if (result) {
                        this.devicesMonitoredFull = result;
                    }
                });
                Homey.get('monitoredPartialDevices', (err, result) => {
                    if (result) {
                        this.devicesMonitoredPartial = result;
                    }
                });
                Homey.get('delayedDevices', (err, result) => {
                    if (result) {
                        this.devicesDelayed = result;
                    }
                });
                Homey.get('loggedDevices', (err, result) => {
                    if (result) {
                        this.devicesLogged = result;
                    }
                });
            },
            getDevices() {
                Homey.api('GET', '/devices', null, (err, result) => {
                    if (err)
                        return Homey.alert('getDevices() ' + err);
                    var array = Object.keys(result).map(function (key) {
                        return result[key];
                    });
                    this.devices = array
                });
            },
            /*
            getZones() {
                Homey.api('GET', '/zones', null, (err, result) => {
                    if (err)
                        return Homey.alert('getZones' + err);
                    var array = Object.keys(result).map(function (key) {
                        return result[key];
                    });
                    this.zones = array
                    return this.zones
                });
            },
            */
            /*
            getZoneName: function(zoneId) {
                var result = "unknown";
                //var zones = this.zones;
                for (let zone in this.zones) {
                    if ( this.zones[zone].id == zoneId ) {
                        result = this.zones[zone].name;
                    }
                };
                return result;
            },
            */
            async addMonitorFull(device) {
                var i;
                var addDeviceMonitorFull = true;
                for (i = 0; i < this.devicesMonitoredFull.length; i++) {
                    if (this.devicesMonitoredFull[i] && this.devicesMonitoredFull[i].id == device.id) {
                        addDeviceMonitorFull = false;
                    }
                }
                if ( addDeviceMonitorFull ) {
                    await this.devicesMonitoredFull.push(device);
                    await Homey.set('monitoredFullDevices', this.devicesMonitoredFull, (err, result) => {
                        if (err)
                            return Homey.alert(err);
                        }
                    )
                }
                this.removeLog(device);
            },
            async addMonitorPartial(device) {
                var i;
                var addDeviceMonitorPartial = true;
                for (i = 0; i < this.devicesMonitoredPartial.length; i++) {
                    if (this.devicesMonitoredPartial[i] && this.devicesMonitoredPartial[i].id == device.id) {
                        addDeviceMonitorPartial = false;
                    }
                }
                if ( addDeviceMonitorPartial ) {
                    await this.devicesMonitoredPartial.push(device);
                    await Homey.set('monitoredPartialDevices', this.devicesMonitoredPartial, (err, result) => {
                        if (err)
                            return Homey.alert(err);
                        }
                    )
                }
                this.removeLog(device);
            },
            async addDelay(device) {
                await this.devicesDelayed.push(device);
                await Homey.set('delayedDevices', this.devicesDelayed, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                    }
                )
                var addMonitorNeeded = true;
                for (i = 0; i < this.devicesMonitoredPartial.length; i++) {
                    if (this.devicesMonitoredPartial[i] && this.devicesMonitoredPartial[i].id == device.id) {
                        addMonitorNeeded = false;
                    }
                }
                if ( addMonitorNeeded ) {
                    this.addMonitorFull(device);
                }
            },
            async addLog(device) {
                await this.devicesLogged.push(device);
                await Homey.set('loggedDevices', this.devicesLogged, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                    }
                )
                this.removeMonitorFull(device);
                this.removeMonitorPartial(device);
            },
            async removeMonitorFull(device) {
                var i;
                for (i = 0; i < this.devicesMonitoredFull.length; i++) {
                    if (this.devicesMonitoredFull[i] && this.devicesMonitoredFull[i].id == device.id) {
                        this.devicesMonitoredFull.splice(i, 1);
                    }
                }
                await Homey.set('monitoredFullDevices', this.devicesMonitoredFull, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                })
                var removeDelayNeeded = true;
                for (i = 0; i < this.devicesMonitoredPartial.length; i++) {
                    if (this.devicesMonitoredPartial[i] && this.devicesMonitoredPartial[i].id == device.id) {
                        removeDelayNeeded = false;
                    }
                }
                if ( removeDelayNeeded ) {
                    this.removeDelay(device);
                }
            },
            async removeMonitorPartial(device) {
                var i;
                for (i = 0; i < this.devicesMonitoredPartial.length; i++) {
                    if (this.devicesMonitoredPartial[i] && this.devicesMonitoredPartial[i].id == device.id) {
                        this.devicesMonitoredPartial.splice(i, 1);
                    }
                }
                await Homey.set('monitoredPartialDevices', this.devicesMonitoredPartial, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                })
                var removeDelayNeeded = true;
                for (i = 0; i < this.devicesMonitoredFull.length; i++) {
                    if (this.devicesMonitoredFull[i] && this.devicesMonitoredFull[i].id == device.id) {
                        removeDelayNeeded = false;
                    }
                }
                if ( removeDelayNeeded ) {
                    this.removeDelay(device);
                }
            },
            async removeDelay(device) {
                var i;
                for (i = 0; i < this.devicesDelayed.length; i++) {
                    if (this.devicesDelayed[i] && this.devicesDelayed[i].id == device.id) {
                        this.devicesDelayed.splice(i, 1);
                    }
                }
                await Homey.set('delayedDevices', this.devicesDelayed, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                })
            },
            async removeLog(device) {
                var i;
                for (i = 0; i < this.devicesLogged.length; i++) {
                    if (this.devicesLogged[i] && this.devicesLogged[i].id == device.id) {
                        this.devicesLogged.splice(i, 1);
                    }
                }
                await Homey.set('loggedDevices', this.devicesLogged, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                })
            },
            isMonitoredFull: function(obj) {
                var i;
                for (i = 0; i < this.devicesMonitoredFull.length; i++) {
                    if (this.devicesMonitoredFull[i] && this.devicesMonitoredFull[i].id == obj.id) {
                        return true;
                    }
                }
                return false;
            },
            isMonitoredPartial: function(obj) {
                var i;
                for (i = 0; i < this.devicesMonitoredPartial.length; i++) {
                    if (this.devicesMonitoredPartial[i] && this.devicesMonitoredPartial[i].id == obj.id) {
                        return true;
                    }
                }
                return false;
            },
            isDelayed: function(obj) {
                var i;
                for (i = 0; i < this.devicesDelayed.length; i++) {
                    if (this.devicesDelayed[i] && this.devicesDelayed[i].id == obj.id) {
                        return true;
                    }
                }
                return false;
            },
            isLogged: function(obj) {
                var i;
                for (i = 0; i < this.devicesLogged.length; i++) {
                    if (this.devicesLogged[i] && this.devicesLogged[i].id == obj.id) {
                        return true;
                    }
                }
                return false;
            },
            filterArray(device) {
                try {
                    return device.ready
                } catch(e) {
                    return false
                }
            },
            displayDevice: function(device) {
                showDevice = false
                for ( let id in device.capabilities ) {
                    if ( [ "alarm_motion", "alarm_contact", "alarm_vibration", "alarm_tamper" ].includes( device.capabilities[id] ) ) {
                        showDevice = true
                    }
                }    
            },
            getIcon: function(device) {
                try {
                    if ( device.ready ) {
                        return "<img src=\"" + device.iconObj.url + "\" class=\"icon-device\"/>";
                    } else {
                        return "<img src=\"./images/broken.svg\" class=\"icon-device\"/>";                        
                    }
                } catch(e) {
                    return "<!-- Error fetching image -->";
                }
            },
            getBattClass: function(capabilitiesObj) {
                try {
                    waarde = capabilitiesObj.measure_battery.value

                    if ("number" != typeof waarde)
                        waarde = "-",
                        closestClass="100"
                    else {
                        var s = waarde / 100;
                        s < 1.1 && (closestClass = "100"),
                        s < .9 && (closestClass = "80"),
                        s < .7 && (closestClass = "60"),
                        s < .5 && (closestClass = "40"),
                        s < .3 && (closestClass = "20"),
                        s < .1 && (closestClass = "0"),
                        waarde = waarde + "%"
                    } 
                    return "<span class=\"component component-battery charge-" + closestClass + "\">"+waarde+"</span>"
                } catch(e) { 
                    return "<!-- no capabilitiesObj.measure_battery.value -->"
                }
            },
            getLastSeen: function(device) {
                let mostRecentComE = 0
                for ( let capability in device.capabilitiesObj ) {
                    let lu = Date.parse(device.capabilitiesObj[capability].lastUpdated)

                    if ( lu > mostRecentComE  ) {
                        mostRecentComE = lu
                    }
                }
                if ( mostRecentComE == 0 ) return "<span id='ls-" + device.id + "'>not available</span>"
                let mostRecentComH = new Date( mostRecentComE )
                let result = "<span id='ls-" + device.id + "'>" + mostRecentComH.toLocaleString() + "</span>"
                return result
            },
            getCapabilityImage: function(device) {
                let result = "";
                for ( let capability in device.capabilitiesObj ) {
                    if ( capability === "alarm_contact" ) {
                        if ( device.capabilitiesObj.alarm_contact.value ) {
                            result += "<img id=\"" + device.id + "\" src=\"./images/contact.svg\" class=\"icon-capability active\"/>"    
                        } else {
                            result += "<img id=\"" + device.id + "\" src=\"./images/contact.svg\" class=\"icon-capability\"/>"
                        }
                    }
                    if ( capability === "alarm_motion" ) {
                        if ( device.capabilitiesObj.alarm_motion.value ) {
                            result += "<img id=\"" + device.id + "\" src=\"./images/motion.svg\" class=\"icon-capability active\"/>"    
                        } else {
                            result += "<img id=\"" + device.id + "\" src=\"./images/motion.svg\" class=\"icon-capability\"/>"
                        }
                    }
                    if ( capability === "alarm_vibration" ) {
                        if ( device.capabilitiesObj.alarm_vibration.value ) {
                            result += "<img id=\"" + device.id + "\" src=\"./images/vibration.svg\" class=\"icon-capability active\"/>"    
                        } else {
                            result += "<img id=\"" + device.id + "\" src=\"./images/vibration.svg\" class=\"icon-capability\"/>"
                        }
                    }
                    if ( capability === "alarm_tamper" ) {
                        if ( device.capabilitiesObj.alarm_tamper.value ) {
                            result += "<img id=\"" + device.id + "\" src=\"./images/tamper.svg\" class=\"icon-capability-tamper active\"/>"    
                        } else {
                            result += "<img id=\"" + device.id + "\" src=\"./images/tamper.svg\" class=\"icon-capability-tamper\"/>"
                        }
                    }
                }
                return result
            }
        },
        async mounted() {
            // await this.getZones();
            await this.getDevices();
            await this.getDeviceSettings();
        },
        computed: {
            filteredItems() {
                return this.devices
            },
            filteredZones() {
                return this.zones
            }
        }
      })
}

function showTab(tab){
    /*
    if ( document.getElementById("useredit").style.display == "block") {
        Homey.alert('Please exit the user settings by pressing either the Save or Cancel button.');
        return;
    }
    */
    loading = false
    document.getElementById("tabs").style.display = "inline";
    if ( illegalValue ) {
        illegalValue = false;
        return;
    }
    $('.tab').addClass('tab-inactive')
    $('.tab').removeClass('tab-active')
    $('#tabb' + tab).addClass('tab-active')
    $('#tabb' + tab).removeClass('tab-inactive')
    $('.panel').hide()
    $('#tab' + tab).show()
    dashboardVisible = ( tab == 1 ) ? true : false
    statusVisible = ( tab == 2 ) ? true : false   
    if ( tab != 4 ) {
        document.getElementById("pinentry").style.display = "";
        document.getElementById("userspane").style.display = "none";
        document.getElementById("useredit").style.display = "none";
        document.getElementById("usereditdescription").style.display = "none";
        document.getElementById("invalidpin").style.display = "none"; 
        document.getElementById("validating").style.display = "none";
        document.getElementById("pin").value = "";
        document.getElementById("userspane").innerHTML = "";
    } else {
        prepareUsersTab();
    }
}

function showSubTab(tab){
    $('.subTab').addClass('tab-inactive')
    $('.subTab').removeClass('tab-active')
    $('#subTabb' + tab).addClass('tab-active')
    $('#subTabb' + tab).removeClass('tab-inactive')
    $('.subPanel').hide()
    $('#subTab' + tab).show()
    statusVisible = ( tab == 1 ) ? true : false
}

function prepareUsersTab() {
    Homey.get('nousers')
        .then((result) => {
            if ( result ) {
                document.getElementById("pinentry").style.display = "none";
                document.getElementById("userAdmin").checked = true;
                document.getElementById("userAdmin").disabled = true;
                document.getElementById("userEnabled").checked = true;
                document.getElementById("userEnabled").disabled = true;
                document.getElementById("usereditdescription").style.display = "block";
                canCancel = false;
                $('#cancelButton').removeClass('btn-active');
                $('#cancelButton').addClass('btn-inactive');
                noUser = true;
                addUser(0);
                transferedUsers = [];
            };
        })
        .catch((error) => {
            return Homey.alert('prepareUsersTab(): ' + errror); 
        });
}

async function getLanguage() {
    await Homey.get('language', function(err, savedLanguage) {
        if ( err ) {
            language = "en"
        } else {
            if (savedLanguage != (null || undefined)) {
                language = savedLanguage;
            } else {
                language = "en"
            }
        }
        document.getElementById("instructions"+language).style.display = "inline";   
    });
}


function apiRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
      Homey.api(method, endpoint, data, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

async function getAllDevices() {
    const result = await apiRequest('GET', '/devices');
    const array = Object.keys(result).map(function (key) {
        return result[key];
    });
    allDevices = array;
}



function filterArray(device) {
    try {
        return device.ready
    } catch(e) {
        return false
    }
}

function changeArmingDelay() {
    let newArmingDelay = document.getElementById("armingDelay").value;
    if (isNaN(newArmingDelay) || newArmingDelay < 0 || newArmingDelay > 300) {
        document.getElementById("armingDelay").value = heimdallSettings.armingDelay;
        Homey.alert(Homey.__("tab2.settings.secondsFail") );
        illegalValue = true;
    } else {
        saveSettings();
    }
}

function changeAlarmDelay() {
    let newAlarmDelay = document.getElementById("alarmDelay").value;
    if (isNaN(newAlarmDelay) || newAlarmDelay < 0 || newAlarmDelay > 300) {
        document.getElementById("alarmDelay").value = heimdallSettings.alarmDelay;
        Homey.alert(Homey.__("tab2.settings.secondsFail") );
        illegalValue = true;
    } else {
        saveSettings();
    }
}

function enterPIN() {
    document.getElementById("invalidpin").style.display = "none";
    document.getElementById("validating").style.display = "block";
    let searchPin = document.getElementById('pin').value;

    Homey.api('GET', '/users/' + searchPin)
        .then((result) => {
            transferedUsers = Object.keys(result).map(function (key) {
                return result[key];
            });
            //console.log(transferedUsers);
            let numUsers = transferedUsers.length

            if (numUsers == 1 ) {
                isAdmin = transferedUsers[0].admin;

                if ( isAdmin == null ) {
                    document.getElementById("validating").style.display = "none";
                    document.getElementById("invalidpin").style.display = "block";
                    document.getElementById("pinentry").style.display = "";
                    document.getElementById("userspane").style.display = "none";
                    return;
                }
            }
            document.getElementById("pinentry").style.display = "none";
            document.getElementById("userspane").style.display = "block";
            document.getElementById("validating").style.display = "none";
            displayUsers(transferedUsers);       
        })
        .catch((error) => {
            document.getElementById("validating").style.display = "none";
            document.getElementById("invalidpin").style.display = "block";
            return Homey.alert('enterPIN: ' + error); 
        });
}

function displayUsers(users) {
    let items=""
    isAdmin = false;
    newUser = 0;
    for (user in users) {
        let fullUser = JSON.stringify(users[user]);

        if ( users[user].id > newUser ) {newUser = users[user].id;}
        if ( users[user].admin ) { userType = Homey.__("tab4.users.usersgroup.administrator"); isAdmin=true; } else { userType = Homey.__("tab4.users.usersgroup.user") };
        if ( !users[user].valid ) { userType = Homey.__("tab4.users.usersgroup.disabled") };
        let item1 = '<div onclick="editUser(' + users[user].id + ')" id=user' + users[user].id + ' class="settings-item"><div class="settings-item-text">';
        let item2 = '<input hidden id="userAll' + users[user].id + '" value=\'' + fullUser + '\'></input>';
        let item3 = '<span><b>' + users[user].name + '</b><br />' + userType + '</span>';
        let item4 = '</div><div class="settings-item-arrow">';
        let item5 = '<i class="arrow right"></i>';
        let item6 = '</div></div>';
        let itemLast = '<div class="settings-item"><div class="settings-item-divider"></div><div class="settings-item-divider"></div></div>';
        items = items + item1 + item2 + item3 + item4 + item5 + item6 + itemLast;
    }
    newUser += 1;

    if ( isAdmin ) {
        let item = '<div class="settings-item"><div class="users-user-add"><span onclick="addUser(' + newUser + ')">+ Add user</span></div><div class="settings-item-last"><span></span></div></div><div class="settings-item"><div class="settings-item-divider"></div><div class="settings-item-divider"></div></div>';
        items = items + item;
    }
    newHTML = items.substr(0,items.length-115);
    document.getElementById("userspane").innerHTML = newHTML;
}

function addUser(userId) {
    document.getElementById("userspane").style.display = "none";
    document.getElementById("useredit").style.display = "block";
    document.getElementById("userEnabled").checked = true;
    document.getElementById("userId").value = userId;

    if ( userId != 0 ) {
        document.getElementById("userAdmin").disabled = false;
        document.getElementById("userEnabled").disabled = false;
    }
    checkSave();
    canDelete = false; 
    $('#deleteButton').removeClass('btn-active');
    $('#deleteButton').addClass('btn-inactive');
}

function checkSave() {
    let userName = document.getElementById("userName").value;
    let userPIN = document.getElementById("userPIN").value;

    if ( userName.length > 1 && userPIN.length > 3) {
        canSave = true;
        $('#saveButton').removeClass('btn-inactive');
        $('#saveButton').addClass('btn-active');
    } else {
        canSave = false;
        $('#saveButton').removeClass('btn-active');
        $('#saveButton').addClass('btn-inactive');
    }
}

function checkAdmin() {
    let userAdmin = document.getElementById("userAdmin").checked;

    if ( userAdmin ) {
        canDelete = false;
        $('#deleteButton').removeClass('btn-active');
        $('#deleteButton').addClass('btn-inactive');
    } else  {
        canDelete = true;
        $('#deleteButton').removeClass('btn-inactive');
        $('#deleteButton').addClass('btn-active');
    }
}

function saveUser() {
    if ( !canSave ) return;
    document.getElementById("validating").style.display = "block";
    let userAdmin = true;
    let userEnabled = true;
    let userId = document.getElementById("userId").value*1;
    let userName = document.getElementById("userName").value;
    let userPIN = document.getElementById("userPIN").value;
    let userRFIDTag = document.getElementById("userRFIDTag").value;

    if ( userId != 0 ) { 
        userAdmin = document.getElementById("userAdmin").checked;
        userEnabled = document.getElementById("userEnabled").checked;
    }
    let user = {id: userId, name: userName, pincode: userPIN, rfidtag: userRFIDTag, admin: userAdmin, valid: userEnabled};
    processUser(user,"save");

    logLine.type = 'Succes';
    // todo translation
    //logLine.text = 'Changes to user ' + userName + ' were saved. ';
    logLine.text = Homey.__("history.changeuser") + userName + Homey.__("history.saved");

    Homey.set('logforme', logLine , (err, result) => {
        if (err)
            return Homey.alert(err);
    })
}

function cancelUser(action) {
    if ( !canCancel ) return;
    document.getElementById("userspane").style.display = "block";
    document.getElementById("useredit").style.display = "none";
    document.getElementById("usereditdescription").style.display = "none";
    document.getElementById("userId").value = "";
    let userName = document.getElementById("userName").value;
    document.getElementById("userName").value = "";
    document.getElementById("userPIN").value = "";
    document.getElementById("userRFIDTag").value = "";
    document.getElementById("userAdmin").checked = false;
    document.getElementById("userEnabled").checked = false;

    if ( action != 'save' ) {
        logLine.type = 'No Succes';
        // todo translation
        //logLine.text = 'Changes to user ' + userName + ' were not saved, Cancel button was clicked. ';
        logLine.text = Homey.__("history.changeuser") + userName + Homey.__("history.notsaved");

        Homey.set('logforme', logLine , (err, result) => {
            if (err)
                return Homey.alert(err);
        })
    }
}

function deleteUser() {
    if ( !canDelete ) return;
    let userId = document.getElementById("userId").value;
    let user = {id: userId, name: false, pincode: false, rfidtag: false, admin: false, valid: false};
    processUser(user,"delete");
}

function processUser(modifiedUser, action) {
    Homey.set('nousers', false );

    let postBody = {
        "pin": document.getElementById('pin').value,
        "user": modifiedUser
    }
    Homey.api('POST', '/users/' + action, postBody )
        .then((result) => {
            console.log('Heimdall API success reply: ', result);
        })
        .catch((error) => {
            console.error('Heimdall API ERROR reply: ', error);
        });
    canCancel = true;
    cancelUser('save');

    if ( noUser ) {
        document.getElementById('pin').value = modifiedUser.pincode;
        noUser = false;
        $('#cancelButton').removeClass('btn-inactive');
        $('#cancelButton').addClass('btn-active');
        document.getElementById("userAdminLbl").style.display = "";
        document.getElementById("userAdminCbx").style.display = "";
        document.getElementById("userEnabledLbl").style.display = "";
        document.getElementById("userEnabledCbx").style.display = "";
    }
    setTimeout(enterPIN(), 2000);

}

function editUser(userId) {
    let user = JSON.parse(document.getElementById("userAll"+userId).value);
    document.getElementById("userspane").style.display = "none";
    document.getElementById("useredit").style.display = "block";
    document.getElementById("userId").value = userId;
    document.getElementById("userName").value = user.name;
    document.getElementById("userPIN").value = user.pincode;
    let currentRFIDtag = user.rfidtag;
    if ( !currentRFIDtag ) { 
        document.getElementById("userRFIDTag").value = "";
    } else {
        document.getElementById("userRFIDTag").value = user.rfidtag;
    }
    document.getElementById("userAdmin").checked = user.admin;
    document.getElementById("userEnabled").checked = user.valid;

    if ( !isAdmin ) {
        document.getElementById("userAdmin").disabled = true;
        document.getElementById("userEnabled").disabled = true;
    } else {
        document.getElementById("userAdmin").disabled = false;
        document.getElementById("userEnabled").disabled = false;
    }
    checkSave();

    if ( userId == 0 ) {
        canDelete = false; 
        $('#deleteButton').removeClass('btn-active');
        $('#deleteButton').addClass('btn-inactive');
        document.getElementById("userAdmin").checked = true;
        document.getElementById("userAdmin").disabled = true;
        document.getElementById("userEnabled").checked = true;
        document.getElementById("userEnabled").disabled = true;
    } else {
        canDelete = true; 
        $('#deleteButton').removeClass('btn-inactive');
        $('#deleteButton').addClass('btn-active');
        if ( isAdmin ) {
            document.getElementById("userAdminLbl").style.display = "";
            document.getElementById("userAdminCbx").style.display = "";
            document.getElementById("userEnabledLbl").style.display = "";
            document.getElementById("userEnabledCbx").style.display = "";
        } else {
            document.getElementById("userAdminLbl").style.display = "none";
            document.getElementById("userAdminCbx").style.display = "none";
            document.getElementById("userEnabledLbl").style.display = "none";
            document.getElementById("userEnabledCbx").style.display = "none";
        }
    }

    Homey.get('taginfo')
        .then((taginfo) => {
            if ( taginfo ) {
                if ( Date.now() - taginfo.time < 300000 ) {
                    // taginfo is younger than 5 minutes
                    // todo translation
                    //let message = "New RFID tag received from " + taginfo.source + ". Do you want to add it to this user?"
                    let message = Homey.__("history.tagreceived") + taginfo.source + Homey.__("history.tagadd")
                    if ( document.getElementById("userRFIDTag").value != '') {
                        // todo translation
                        //message = "New RFID tag received from " + taginfo.source + ". Do you want to replace this users current RFID tag?"
                        message = Homey.__("history.tagreceived") + taginfo.source + Homey.__("history.tagreplace")
                    }
                    Homey.confirm(message)
                        .then((result) => {
                            if ( result ) {
                                document.getElementById("userRFIDTag").value = taginfo.rfidtag;
                                //console.log('taginfo.time',taginfo.time);
                                taginfo.time = 0;
                                Homey.set('taginfo',taginfo);
                                //console.log('taginfo.time',taginfo.time);

                                let selectedUser = document.getElementById('userName').value
            
                                logLine.type = 'Succes';
                                // todo translation
                                //logLine.text = 'RFID tag ' + taginfo.rfidtag + ' was added to user ' + selectedUser ;
                                logLine.text = Homey.__("history.rfidtag") + taginfo.rfidtag + Homey.__("history.tagaddedto") + selectedUser ;
                    
                                Homey.set('logforme', logLine , (err, result) => {
                                    if (err)
                                        return Homey.alert(err);

                                        canSave = true;
                                        saveUser();

                                })
                                // todo translation
                                //Homey.alert("RFID tag was added to user " + selectedUser);
                                Homey.alert(Homey.__("history.rfidtag") + Homey.__("history.tagaddedto") + selectedUser);

                            } else {

                            }

                        })
                        .catch(error => {
                            
                        });
                } else {
                    if ( taginfo.time !=0 ) {
                        // taginfo is older than 5 minutes
                        logLine.type = 'No succes';
                        // todo translation
                        //logLine.text = 'RFID tag expired, it can not be added to a user. Please reregister the tag';
                        logLine.text = Homey.__("history.rfidtagexpired");
                        
                        Homey.set('logforme', logLine , (err, result) => {
                            if (err)
                                return Homey.alert(err);
                        })    
                        Homey.set('taginfo',null);                
                    }
                }
            };
        })
        .catch(error => {
            return Homey.alert('taginfo: ' + error); 
        });

}

function saveSettings() {
    heimdallSettings.autorefresh = document.getElementById('autoRefresh').checked;
    heimdallSettings.useColors = document.getElementById('useColors').checked;
    heimdallSettings.armingDelay = document.getElementById('armingDelay').value;
    heimdallSettings.alarmDelay = document.getElementById('alarmDelay').value;
    heimdallSettings.delayArmingFull = document.getElementById('delayArmingFull').checked;
    heimdallSettings.delayArmingPartial = document.getElementById('delayArmingPartial').checked;
    heimdallSettings.alarmWhileDelayed = document.getElementById('alarmWhileDelayed').checked;
    heimdallSettings.logArmedOnly = document.getElementById('logArmedOnly').checked;
    heimdallSettings.logTrueOnly = document.getElementById('logTrueOnly').checked;
    heimdallSettings.useTampering = document.getElementById('useTampering').checked;
    heimdallSettings.checkMotionAtArming = document.getElementById('checkMotionAtArming').checked;
    heimdallSettings.checkContactAtArming = document.getElementById('checkContactAtArming').checked;
    heimdallSettings.checkBeforeCountdown = document.getElementById('checkBeforeCountdown').checked;
    if (useSpeech) {
        heimdallSettings.spokenSmodeChange = document.getElementById('spokenSmodeChange').checked;
        heimdallSettings.spokenAlarmCountdown = document.getElementById('spokenAlarmCountdown').checked;
        heimdallSettings.spokenArmCountdown = document.getElementById('spokenArmCountdown').checked;
        heimdallSettings.spokenAlarmChange = document.getElementById('spokenAlarmChange').checked;
        heimdallSettings.spokenMotionTrue = document.getElementById('spokenMotionTrue').checked;
        heimdallSettings.spokenTamperTrue = document.getElementById('spokenTamperTrue').checked;
        heimdallSettings.spokenDoorOpen = document.getElementById('spokenDoorOpen').checked;
        heimdallSettings.spokenMotionAtArming = document.getElementById('spokenMotionAtArming').checked;
        heimdallSettings.spokenDoorOpenAtArming = document.getElementById('spokenDoorOpenAtArming').checked;
    } else {
        heimdallSettings.spokenSmodeChange = false;
        heimdallSettings.spokenAlarmCountdown = false;
        heimdallSettings.spokenArmCountdown = false;
        heimdallSettings.spokenAlarmChange = false;
        heimdallSettings.spokenMotionTrue = false;
        heimdallSettings.spokenTamperTrue = false;
        heimdallSettings.spokenDoorOpen = false;
        heimdallSettings.spokenMotionAtArming = false;
        heimdallSettings.spokenDoorOpenAtArming = false;
    }
    heimdallSettings.notificationSmodeChange = document.getElementById('notificationSmodeChange').checked;
    heimdallSettings.notificationAlarmChange = document.getElementById('notificationAlarmChange').checked;
    heimdallSettings.notificationNoCommunicationMotion = document.getElementById('notificationNoCommunicationMotion').checked;
    heimdallSettings.notificationNoCommunicationContact = document.getElementById('notificationNoCommunicationContact').checked; 
    heimdallSettings.noCommunicationTime = 24;
    if (useSpeech) {
        if ( heimdallSettings.spokenMotionAtArming ) {
            document.getElementById('checkMotionAtArming').checked = true
            heimdallSettings.checkMotionAtArming = true
        }
        if ( heimdallSettings.spokenDoorOpenAtArming ) {
            document.getElementById('checkContactAtArming').checked = true
            heimdallSettings.checkContactAtArming = true
        }
    }
    if ( !heimdallSettings.checkMotionAtArming && !heimdallSettings.checkContactAtArming ) {
        document.getElementById('checkBeforeCountdown').checked = false;
        heimdallSettings.checkBeforeCountdown = document.getElementById('checkBeforeCountdown').checked;
    }
    if ( !heimdallSettings.delayArmingFull && !heimdallSettings.delayArmingPartial ) {
        document.getElementById('checkBeforeCountdown').checked = false;
        heimdallSettings.checkBeforeCountdown = document.getElementById('checkBeforeCountdown').checked;
    }
    Homey.set('settings', heimdallSettings );
}

function clearHistory() {
    Homey.set('myLog', '');
    showHistory(0);
};

function downloadHistory() {
    download('Heimdall history.txt', document.getElementById('logtextarea').value);
};

function refreshHistory() {
    if ( dashboardVisible == true ) {
        if ( document.getElementById("autoRefresh").checked ){
            showHistory(0)
        }
    }
    setTimeout(refreshHistory, 1000);
}

function refreshStatus() {
    if ( statusVisible == true ) {
        showStatus()
    }
    setTimeout(refreshStatus, 1000);
}

function changeAutoRefresh() {
    if (document.getElementById("autoRefresh").checked === true ){
        document.getElementById("buttonRefresh").style = "display:none";
    } else {
        document.getElementById("buttonRefresh").style = "display:block";
    }
    saveSettings();
    showHistory(0);
}

function changeUseColor() {
    saveSettings();
    showHistory(1);
}

function showHistory(run) {
    Homey.get('myLog', function(err, logging){
        if( err ) {
            console.error('showHistory: Could not get history', err);
            return
        }

        if (_myLog !== logging || run == 1 ){
            console.log("_myLog !== logging || run == 1")
            _myLog = logging
            // Need work here -> done!
            document.getElementById('logtextarea').value = logging;
            
            let color = ""
            let htmlstring = "" 
            let historyArray = logging.split("\n")
            let dark = false
            let headerstring = '<div class="rTableRow"><div class="rTableCell line rTableHead">' + Homey.__("tab1.history.date") + '</div><div class="rTableCell line rTableHead">' + Homey.__("tab1.history.time") + '</div><div class="rTableCell line rTableHead">' + Homey.__("tab1.history.smode") + '</div><div class="rTableCell line rTableHead">' + Homey.__("tab1.history.source") + '</div><div class="rTableCell line rTableHead">' + Homey.__("tab1.history.action") + '</div></div>'
        
            historyArray.forEach(element => {
                element = element.replace(/ \|\| /g,'</div><div class="rTableCell line">')
                if ( element != "") {
                    if ( dark ) {
                        color = element.substr(0,3)
                        color = color.replace("-","d")
                        dark = false
                    } else {
                        color = element.substr(0,3)
                        color = color.replace("-","l")
                        dark = true
                    }
                    element = element.substr(3, element.length - 3 )
                    if (document.getElementById("useColors").checked === false){
                        color = ""
                    }
                    htmlstring = htmlstring + '<div class="rTableRow ' + color + '"><div class="rTableCell line">' + element + "</div></div>"
                }
            });
            htmlstring = headerstring + htmlstring
            document.getElementById('historyTable').innerHTML = htmlstring
        }
    });
}

async function showStatus() {
    await getAllDevices();
    for ( let id in allDevices ) {
        let device = allDevices[id]
        for ( let capability in device.capabilitiesObj ) {
            if ( capability === "alarm_contact" ) {
                if ( device.capabilitiesObj.alarm_contact.value ) {
                    $('#'+device.id).addClass('active')
                } else {
                    $('#'+device.id).removeClass('active')
                }
            }
            if ( capability === "alarm_motion" ) {
                if ( device.capabilitiesObj.alarm_motion.value ) {
                    $('#'+device.id).addClass('active')
                } else {
                    $('#'+device.id).removeClass('active')
                }
            }
            if ( capability === "alarm_vibration" ) {
                if ( device.capabilitiesObj.alarm_vibration.value ) {
                    $('#'+device.id).addClass('active')
                } else {
                    $('#'+device.id).removeClass('active')
                }
            }
            if ( capability === "alarm_tamper" ) {
                if ( device.capabilitiesObj.alarm_tamper.value ) {
                    $('#'+device.id).addClass('active')
                } else {
                    $('#'+device.id).removeClass('active')
                }
            }
            if ( [ "alarm_motion", "alarm_contact", "alarm_vibration", "alarm_tamper" ].includes( capability) ) {
                let mostRecentComE = 0
                let lastUpdateDate = ""
                for ( let capability in device.capabilitiesObj ) {
                    let lu = Date.parse(device.capabilitiesObj[capability].lastUpdated)

                    if ( lu > mostRecentComE  ) {
                        mostRecentComE = lu
                    }
                }
                if ( mostRecentComE == 0 ) {
                    lastUpdateDate = "not available"
                } else { 
                    lastUpdateDate = new Date( mostRecentComE ).toLocaleString()
                }
                let lastSeen = "ls-" + device.id
                document.getElementById(lastSeen).innerHTML = lastUpdateDate
            }
        }
    }
}

function download(filename, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        pom.dispatchEvent(event);
    }
    else {
        pom.click();
    }
}

/*
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
*/