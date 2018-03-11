//let Homey;
let _myLog;
let surveillance;
let alarm;
var allDevices;
var triggerDelay = 30;
var logArmedOnly;
var logTrueOnly;
var dashboardVisible = true;
var heimdallSettings = {};
var defaultSettings = {
    "triggerDelay": "30",
    "delayArmingFull": false,
    "delayArmingPartial": false,
    "logArmedOnly": false,
    "logTrueOnly": false,
    "spokenSmodeChange": false,
    "spokenAlarmCountdown": false,
    "spokenArmCountdown": false,
    "spokenAlarmChange": false,
    "spokenMotionTrue": false,
    "spokenTamperTrue": false,
    "spokenDoorOpen": false
};

function onHomeyReady(homeyReady){
    Homey = homeyReady;
    Homey.ready();
    heimdallSettings = defaultSettings;
    Homey.get('settings', function(err, savedSettings) {
        if (err) {
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
        document.getElementById('triggerDelay').value = heimdallSettings.triggerDelay;
        document.getElementById('delayArmingFull').checked = heimdallSettings.delayArmingFull;
        document.getElementById('delayArmingPartial').checked = heimdallSettings.delayArmingPartial;
        document.getElementById('logArmedOnly').checked = heimdallSettings.logArmedOnly;
        document.getElementById('logTrueOnly').checked = heimdallSettings.logTrueOnly;
        document.getElementById('checkMotionAtArming').checked = heimdallSettings.checkMotionAtArming;
        document.getElementById('checkContactAtArming').checked = heimdallSettings.checkContactAtArming;
        document.getElementById('spokenSmodeChange').checked = heimdallSettings.spokenSmodeChange;
        document.getElementById('spokenAlarmCountdown').checked = heimdallSettings.spokenAlarmCountdown;
        document.getElementById('spokenArmCountdown').checked = heimdallSettings.spokenArmCountdown;
        document.getElementById('spokenAlarmChange').checked = heimdallSettings.spokenAlarmChange;
        document.getElementById('spokenMotionTrue').checked = heimdallSettings.spokenMotionTrue;
        document.getElementById('spokenTamperTrue').checked = heimdallSettings.spokenTamperTrue;
        document.getElementById('spokenDoorOpen').checked = heimdallSettings.spokenDoorOpen;
        document.getElementById('spokenMotionAtArming').checked = heimdallSettings.spokenMotionAtArming;
        document.getElementById('spokenDoorOpenAtArming').checked = heimdallSettings.spokenDoorOpenAtArming;
        if ( document.getElementById('autoRefresh').checked ) {
            document.getElementById("buttonRefresh").style = "display:none";
        } else {
            document.getElementById("buttonRefresh").style = "display:block";
        }
    });
    
    showTab(1);
    getLanguage();
    getStatus();
    refreshHistory();

    new Vue({
        el: '#app',
        data: {
          devices: {},
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
                        return Homey.alert('getDevices' + err);
                    var array = Object.keys(result).map(function (key) {
                        return result[key];
                    });
                    this.devices = array.filter(this.filterArray);
                });
            },
            async addMonitorFull(device) {
                var i;
                var addDeviceMonitorFull = true;
                for (i = 0; i < this.devicesMonitoredFull.length; i++) {
                    if (this.devicesMonitoredFull[i] && this.devicesMonitoredFull[i].id == device.id) {
                        addDeviceMonitorFull = false;
                    }
                }
                if ( addDeviceMonitorFull ) {
                    console.log('addMonitorFull: ' + device.id, device.name, device.class)
                    await this.devicesMonitoredFull.push(device);
                    await Homey.set('monitoredFullDevices', this.devicesMonitoredFull, (err, result) => {
                        if (err)
                            return Homey.alert(err);
                        }
                    )
                    console.log('addMonitorFull: ' + device.name + ' added to monitoredFullDevices');
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
                    console.log('addMonitorPartial: ' + device.id, device.name, device.class)
                    await this.devicesMonitoredPartial.push(device);
                    await Homey.set('monitoredPartialDevices', this.devicesMonitoredPartial, (err, result) => {
                        if (err)
                            return Homey.alert(err);
                        }
                    )
                    console.log('addMonitorPartial: ' + device.name + ' added to monitoredPartialDevices');
                }
                this.removeLog(device);
            },
            async addDelay(device) {
                console.log('addDelay: ' + device.id, device.name, device.class)
                await this.devicesDelayed.push(device);
                await Homey.set('delayedDevices', this.devicesDelayed, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                    }
                )
                console.log('addDelay: Delay added to ' + device.name);
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
                console.log('addLog: ' + device.id, device.name, device.class)
                await this.devicesLogged.push(device);
                await Homey.set('loggedDevices', this.devicesLogged, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                    }
                )
                console.log('addLog: Logging added to ' + device.name);
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
                    console.log('removeMonitorFull: ' + device.name + ' removed from monitoredFullDevices');
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
                   console.log('removeMonitorPartial: ' + device.name + ' removed from monitoredPartialDevices');
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
                   console.log('removeDelay: Delay removed from' + device.name);
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
                   console.log('removeLog: Logging removed from: ' + device.name);
                })
            },
            isMonitoredFull(obj) {
                var i;
                for (i = 0; i < this.devicesMonitoredFull.length; i++) {
                    if (this.devicesMonitoredFull[i] && this.devicesMonitoredFull[i].id == obj.id) {
                        return true;
                    }
                }
                return false;
            },
            isMonitoredPartial(obj) {
                var i;
                for (i = 0; i < this.devicesMonitoredPartial.length; i++) {
                    if (this.devicesMonitoredPartial[i] && this.devicesMonitoredPartial[i].id == obj.id) {
                        return true;
                    }
                }
                return false;
            },
            isDelayed(obj) {
                var i;
                for (i = 0; i < this.devicesDelayed.length; i++) {
                    if (this.devicesDelayed[i] && this.devicesDelayed[i].id == obj.id) {
                        return true;
                    }
                }
                return false;
            },
            isLogged(obj) {
                var i;
                for (i = 0; i < this.devicesLogged.length; i++) {
                    if (this.devicesLogged[i] && this.devicesLogged[i].id == obj.id) {
                        return true;
                    }
                }
                return false;
            },
            filterArray(device) {
                if (device.class == "sensor" || device.class == "lock")
                return device
            }
        },
        mounted() {
            this.getDevices();
            this.getDeviceSettings();
        },
        computed: {
            filteredItems() {
                return this.devices          
            }
        }
      })
}

function showTab(tab){
    $('.tab').removeClass('tab-active')
    $('.tab').addClass('tab-inactive')
    $('#tabb' + tab).removeClass('tab-inactive')
    $('#tabb' + tab).addClass('active')
    $('.panel').hide()
    $('#tab' + tab).show()
    if ( tab == 1 ) {
        dashboardVisible = true
    } else {
        dashboardVisible = false
    }
}

function getStatus() {
    Homey.get('surveillanceStatus', function( err, surveillanceStatus ) {
        if( err ) return Homey.alert( err );
        surveillance = surveillanceStatus;
        if( surveillance == 'armed') {
            document.getElementById("surveillanceModeFull").className = "btn wide btn-active";
            document.getElementById("surveillanceModePartial").className = "btn wide btn-inactive";
        }
        else if( surveillance == 'partially_armed' ) 
        {
            document.getElementById("surveillanceModeFull").className = "btn wide btn-inactive";
            document.getElementById("surveillanceModePartial").className = "btn wide btn-active";
        }
        else {
            document.getElementById("surveillanceModeFull").className = "btn wide btn-inactive";
            document.getElementById("surveillanceModePartial").className = "btn wide btn-inactive";
        }
    })
    Homey.get('alarmStatus', function( err, alarmStatus ) {
        if( err ) return Homey.alert( err );
        alarm = alarmStatus;
        if( alarm) {
            document.getElementById("alarmMode").className = "btn wide btn-alarm";
        }
        else {
            if (triggerDelay != null) {
                document.getElementById("alarmMode").className = "btn wide btn-inactive";
            }
        }
    })
}

function getLanguage() {
    console.log('language: ' + language);
    document.getElementById("instructions"+language).style.display = "inline";
}

function changeTriggerDelay() {
    let newTriggerDelay = document.getElementById("triggerDelay").value;
    console.log('Triggerdelay: ' + newTriggerDelay)
    if (isNaN(newTriggerDelay) || newTriggerDelay < 0 || newTriggerDelay > 120) {
        document.getElementById("triggerDelay").value = triggerDelay;
        Homey.alert(Homey.__("tab2.settings.secondsFail") );
    } else {
        saveSettings();
        Homey.alert(Homey.__("tab2.settings.saveSucces"));
    }
}

function saveSettings() {
    heimdallSettings.autorefresh = document.getElementById('autoRefresh').checked;
    heimdallSettings.useColors = document.getElementById('useColors').checked;
    heimdallSettings.triggerDelay = document.getElementById('triggerDelay').value;
    heimdallSettings.delayArmingFull = document.getElementById('delayArmingFull').checked;
    heimdallSettings.delayArmingPartial = document.getElementById('delayArmingPartial').checked;
    heimdallSettings.logArmedOnly = document.getElementById('logArmedOnly').checked;
    heimdallSettings.logTrueOnly = document.getElementById('logTrueOnly').checked;
    heimdallSettings.checkMotionAtArming = document.getElementById('checkMotionAtArming').checked;
    heimdallSettings.checkContactAtArming = document.getElementById('checkContactAtArming').checked;
    heimdallSettings.spokenSmodeChange = document.getElementById('spokenSmodeChange').checked;
    heimdallSettings.spokenAlarmCountdown = document.getElementById('spokenAlarmCountdown').checked;
    heimdallSettings.spokenArmCountdown = document.getElementById('spokenArmCountdown').checked;
    heimdallSettings.spokenAlarmChange = document.getElementById('spokenAlarmChange').checked;
    heimdallSettings.spokenMotionTrue = document.getElementById('spokenMotionTrue').checked;
    heimdallSettings.spokenTamperTrue = document.getElementById('spokenTamperTrue').checked;
    heimdallSettings.spokenDoorOpen = document.getElementById('spokenDoorOpen').checked;
    heimdallSettings.spokenMotionAtArming = document.getElementById('spokenMotionAtArming').checked;
    heimdallSettings.spokenDoorOpenAtArming = document.getElementById('spokenDoorOpenAtArming').checked;
    if ( heimdallSettings.spokenMotionAtArming ) {
        document.getElementById('checkMotionAtArming').checked = true
        heimdallSettings.checkMotionAtArming = true
    }
    if ( heimdallSettings.spokenDoorOpenAtArming ) {
        document.getElementById('checkContactAtArming').checked = true
        heimdallSettings.checkContactAtArming = true
    }
    Homey.set('settings', heimdallSettings );
}

function clearHistory(){
    Homey.set('myLog', '');
    showHistory(0);
};

function downloadHistory(){
    download('Heimdall history.txt', document.getElementById('logtextarea').value);
};

function refreshHistory(){
    if ( dashboardVisible == true ) {
        if ( document.getElementById("autoRefresh").checked ){
            showHistory()
        }
        getStatus();
    }
    setTimeout(refreshHistory, 1000);
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
    if( err ) return console.error('showHistory: Could not get history', err);
    if (_myLog !== logging || run == 1 ){
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