//let Homey;
let _myLog;
let surveillance;
let alarm;
var allDevices;
var triggerDelay = 30;
//var language = "nl";

function onHomeyReady(homeyReady){
    Homey = homeyReady;
    Homey.ready();
    getTriggerDelay();
    getLanguage();
    getSettings();
    refreshLog();

    new Vue({
        el: '#app',
        data: {
          devices: {},
          search: '',
          devicesMonitored: [],
          devicesDelayed: [],
          devicesLogged: [],
          log: []
        },
        methods: {
            getMonitoredDevices() {
                Homey.get('monitoredDevices', (err, result) => {
                  console.log('getMonitoredDevices: ' + result);
                  if (result) {
                    this.devicesMonitored = result;
                  }
    
                });
            },
            getDelayedDevices() {
                Homey.get('delayedDevices', (err, result) => {
                    console.log('getDelayedDevices: '+ result);
                    if (result) {
                        this.devicesDelayed = result;
                    }
        
                });
            },
            getLoggedDevices() {
                Homey.get('loggedDevices', (err, result) => {
                    console.log('getLoggedDevices: '+ result);
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
            async addMonitor(device) {
                var i;
                var addDeviceMonitor = true;
                for (i = 0; i < this.devicesMonitored.length; i++) {
                    if (this.devicesMonitored[i] && this.devicesMonitored[i].id == device.id) {
                        addDeviceMonitor = false;
                    }
                }
                if ( addDeviceMonitor ) {
                    await console.log('addMonitor: ' + device.id, device.name, device.class)
                    await this.devicesMonitored.push(device);
                    await Homey.set('monitoredDevices', this.devicesMonitored, (err, result) => {
                        if (err)
                            return Homey.alert(err);
                        }
                    )
                    console.log('addMonitor: ' + device.name + ' added to monitoredDevices');
                }
                this.removeLog(device);
            },
            async addDelay(device) {
                await console.log('addDelay: ' + device.id, device.name, device.class)
                await this.devicesDelayed.push(device);
                await Homey.set('delayedDevices', this.devicesDelayed, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                    }
                )
                console.log('addDelay: Delay added to ' + device.name);
                this.addMonitor(device);
            },
            async addLog(device) {
                await console.log('addLog: ' + device.id, device.name, device.class)
                await this.devicesLogged.push(device);
                await Homey.set('loggedDevices', this.devicesLogged, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                    }
                )
                console.log('addLog: Logging added to ' + device.name);
                this.removeMonitor(device);
            },
            async removeMonitor(device) {
                var i;
                for (i = 0; i < this.devicesMonitored.length; i++) {
                    if (this.devicesMonitored[i] && this.devicesMonitored[i].id == device.id) {
                        this.devicesMonitored.splice(i, 1);
                    }
                }
                await Homey.set('monitoredDevices', this.devicesMonitored, (err, result) => {
                    if (err)
                        return Homey.alert(err);
                    console.log('removeMonitor: ' + device.name + ' removed from monitoredDevices');
                })
                this.removeDelay(device);
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
                    console.log('removeLog: Logging removed from' + device.name);
                })
                
            },
            isMonitored(obj) {
                var i;
                for (i = 0; i < this.devicesMonitored.length; i++) {
                    if (this.devicesMonitored[i] && this.devicesMonitored[i].id == obj.id) {
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
            this.getMonitoredDevices();
            this.getDelayedDevices();
            this.getLoggedDevices();
            this.getDevices();
        },
        computed: {
            filteredItems() {
                return this.devices          
            }
        }
      })
}

function showTab(tab){
    // clean this up!
    if( tab == "tab1") {
        document.getElementById("tab1").style="display:block";
        document.getElementById("tab2").style="display:none";
        document.getElementById("tab3").style="display:none";
        document.getElementById("tab1b").className="tab tab-active";
        document.getElementById("tab2b").className="tab tab-inactive";
        document.getElementById("tab3b").className="tab tab-inactive";
    }
    else if ( tab == "tab2" ) {
        document.getElementById("tab1").style="display:none";
        document.getElementById("tab2").style="display:block";
        document.getElementById("tab3").style="display:none";
        document.getElementById("tab1b").className="tab tab-inactive";
        document.getElementById("tab2b").className="tab tab-active";
        document.getElementById("tab3b").className="tab tab-inactive";
    }
    else if ( tab == "tab3" ) {
        document.getElementById("tab1").style="display:none";
        document.getElementById("tab2").style="display:none";
        document.getElementById("tab3").style="display:block";
        document.getElementById("tab1b").className="tab tab-inactive";
        document.getElementById("tab2b").className="tab tab-inactive";
        document.getElementById("tab3b").className="tab tab-active";
    }

}

function getSettings() {
    Homey.get('surveillanceStatus', function( err, surveillanceStatus ) {
        if( err ) return Homey.alert( err );
        surveillance = surveillanceStatus;
        if( surveillance ) {
            document.getElementById("surveillanceMode").className = "btn wide btn-active";
        }
        else {
            document.getElementById("surveillanceMode").className = "btn wide btn-inactive";
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

function getTriggerDelay() {
    Homey.get('triggerDelay', function ( err, savedTriggerDelay ) {
        if (triggerDelay != null) {
            triggerDelay = savedTriggerDelay;
        }
        else {
            triggerDelay = 30;
        }
        document.getElementById("triggerDelay").value = triggerDelay;
    })
}

function getLanguage() {
    console.log('language: ' + language);
    document.getElementById("instructions"+language).style.display = "inline";
}

function setSurveillanceMode() {
    surveillance = !surveillance;
    Homey.set('surveillanceStatus', surveillance, function( err ){
        if( err ) return Homey.alert( err );
    });
    if( surveillance) {
        document.getElementById("surveillanceMode").className = "btn wide btn-active";
        writeLogline(document.getElementById("spanSurvActivated").innerText);
    }
    else {
        document.getElementById("surveillanceMode").className = "btn wide btn-inactive";
        writeLogline(document.getElementById("spanSurvDeactivated").innerText);
        // Cleanup
        alarm=false;
        Homey.set('alarmStatus', alarm, function( err ){
            if( err ) return Homey.alert( err );
        });
    } 
}

function writeLogline(line) {
    let nu = getDateTime();
    let logNew = nu + surveillance + " || " + line;
    Homey.get('myLog', function(err, logging){
        if( err ) return console.error('writeLogline: Could not get log', err);
        if (logging != undefined) { 
            logNew = logNew+"\n"+logging;
        }
        Homey.set('myLog', logNew );
    })
    refreshLog();
}

function changeTriggerDelay() {
    let newTriggerDelay = document.getElementById("triggerDelay").value;
    console.log('Triggerdelay: ' + newTriggerDelay)
    if (isNaN(newTriggerDelay) || newTriggerDelay < 0 || newTriggerDelay > 120) {
        document.getElementById("triggerDelay").value = triggerDelay;
        Homey.alert(document.getElementById("spanSecondsFail").innerHTML);
    } else {
        triggerDelay = newTriggerDelay
        Homey.set('triggerDelay', triggerDelay, function( err ){
            if( err ) return Homey.alert( err );
        });
        Homey.alert(document.getElementById("spanSaveSucces").innerHTML);
    }
}

function clear_simpleLOG(){
    Homey.set('myLog', '');
};

function download_simpleLOG(){
    download('Heimdall log.txt', document.getElementById('logtextarea').value);
};

function refreshLog(){
  if (document.getElementById("show_refresh").checked === true){
    show_log()
  }
  getSettings();
  setTimeout(refreshLog, 1000);
}

function show_log() {
  Homey.get('myLog', function(err, logging){
      if( err ) return console.error('show_log: Could not get log', err);
      if (_myLog !== logging){
        _myLog = logging
        document.getElementById('logtextarea').value = logging;
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