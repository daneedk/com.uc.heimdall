//let Homey;
let _myLog;
let surveillance;
let alarm;
var allDevices;

function onHomeyReady( homeyReady ){
    Homey = homeyReady;
    Homey.ready();
    getSettings();
    refreshLog();
}

function showTab(tab){
    if( tab == "tab1") {
        document.getElementById("tab1").style="display:block";
        document.getElementById("tab2").style="display:none";
        document.getElementById("tab1b").className="tab tab-active";
        document.getElementById("tab2b").className="tab tab-inactive";
    }
    else {
        document.getElementById("tab1").style="display:none";
        document.getElementById("tab2").style="display:block";
        document.getElementById("tab1b").className="tab tab-inactive";
        document.getElementById("tab2b").className="tab tab-active";
    }
}

function getSettings() {
    Homey.get('surveillanceStatus', function( err, surveillanceStatus ) {
        if( err ) return Homey.alert( err );
        surveillance = surveillanceStatus;
        if( surveillance ) {
            document.getElementById("surveillanceMode").className = "btn btn-active";
        }
        else {
            document.getElementById("surveillanceMode").className = "btn btn-inactive";
        };
    });
    Homey.get('alarmStatus', function( err, alarmStatus ) {
        if( err ) return Homey.alert( err );
        alarm = alarmStatus;
        if( alarm) {
            document.getElementById("alarmMode").className = "btn btn-alarm";
        }
        else {
            document.getElementById("alarmMode").className = "btn btn-inactive";
        };
    });
}

function setSurveillanceMode() {
    surveillance = !surveillance;
    Homey.set('surveillanceStatus', surveillance, function( err ){
        if( err ) return Homey.alert( err );
    });
    if( surveillance) {
        document.getElementById("surveillanceMode").className = "btn btn-active";
        writeLogline(document.getElementById("spanSurvActivated").innerText);
    }
    else {
        document.getElementById("surveillanceMode").className = "btn btn-inactive";
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