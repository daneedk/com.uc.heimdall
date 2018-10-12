//let Homey;
let _myLog;
let surveillance;
let alarm;
var allDevices;
var logArmedOnly;
var logTrueOnly;
var dashboardVisible = true;
var illegalValue = false;
var heimdallSettings = {};
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
                // temp
                if (heimdallSettings.armingDelay == (null || undefined)) {
                    heimdallSettings.armingDelay = heimdallSettings.triggerDelay
                    heimdallSettings.alarmDelay = heimdallSettings.triggerDelay
                }
                //temp
            }
        }
        document.getElementById('autoRefresh').checked = heimdallSettings.autorefresh;
        document.getElementById('useColors').checked = heimdallSettings.useColors;
        document.getElementById('armingDelay').value = heimdallSettings.armingDelay;
        document.getElementById('alarmDelay').value = heimdallSettings.alarmDelay;
        document.getElementById('delayArmingFull').checked = heimdallSettings.delayArmingFull;
        document.getElementById('delayArmingPartial').checked = heimdallSettings.delayArmingPartial;
        document.getElementById('logArmedOnly').checked = heimdallSettings.logArmedOnly;
        document.getElementById('logTrueOnly').checked = heimdallSettings.logTrueOnly;
        document.getElementById('useTampering').checked = heimdallSettings.useTampering;
        document.getElementById('checkMotionAtArming').checked = heimdallSettings.checkMotionAtArming;
        document.getElementById('checkContactAtArming').checked = heimdallSettings.checkContactAtArming;
        document.getElementById('checkBeforeCountdown').checked = heimdallSettings.checkBeforeCountdown;
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
                //if (device.class == "sensor" || device.class == "lock")
                return device
            },
            getBattClass: function(waarde) {
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
    if ( illegalValue ) {
        illegalValue = false;
        return;
    }
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
            document.getElementById("surveillanceModeFull").className = "indicator btn-active";
            document.getElementById("surveillanceModePartial").className = "indicator btn-inactive";
        }
        else if( surveillance == 'partially_armed' ) 
        {
            document.getElementById("surveillanceModeFull").className = "indicator btn-inactive";
            document.getElementById("surveillanceModePartial").className = "indicator btn-active";
        }
        else {
            document.getElementById("surveillanceModeFull").className = "indicator btn-inactive";
            document.getElementById("surveillanceModePartial").className = "indicator btn-inactive";
        }
    })
    Homey.get('alarmStatus', function( err, alarmStatus ) {
        if( err ) return Homey.alert( err );
        alarm = alarmStatus;
        if( alarm) {
            document.getElementById("alarmMode").className = "indicator ind-alarm";
        }
        else {
            if (heimdallSettings.armingDelay != null) {
                document.getElementById("alarmMode").className = "indicator btn-inactive";
            }
        }
    })
}

function getLanguage() {
    console.log('language: ' + language);
    document.getElementById("instructions"+language).style.display = "inline";
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

function saveSettings() {
    heimdallSettings.autorefresh = document.getElementById('autoRefresh').checked;
    heimdallSettings.useColors = document.getElementById('useColors').checked;
    heimdallSettings.armingDelay = document.getElementById('armingDelay').value;
    heimdallSettings.alarmDelay = document.getElementById('alarmDelay').value;
    heimdallSettings.delayArmingFull = document.getElementById('delayArmingFull').checked;
    heimdallSettings.delayArmingPartial = document.getElementById('delayArmingPartial').checked;
    heimdallSettings.logArmedOnly = document.getElementById('logArmedOnly').checked;
    heimdallSettings.logTrueOnly = document.getElementById('logTrueOnly').checked;
    heimdallSettings.useTampering = document.getElementById('useTampering').checked;
    heimdallSettings.checkMotionAtArming = document.getElementById('checkMotionAtArming').checked;
    heimdallSettings.checkContactAtArming = document.getElementById('checkContactAtArming').checked;
    heimdallSettings.checkBeforeCountdown = document.getElementById('checkBeforeCountdown').checked;
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