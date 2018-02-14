var heimdallSettings = {
    "APIKey": ""
};

function load() {
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
        document.getElementById('tempapikey').value = heimdallSettings.APIKey;
    })

    if ( heimdallSettings.APIKey == "" ) {
        console.log('APIKey: ' + heimdallSettings.APIKey)
        document.getElementById('homeyalarm').style="display:none";
        document.getElementById('configHomeyAlarmStep1').style="display:block";
    } else {
        getHeartbeat()
        console.log('APIKey: ' + heimdallSettings.APIKey)
    }
}

var check = function() {
    if (document.getElementById('password').value ==
      document.getElementById('confirmPassword').value) {
      document.getElementById('message').style.color = 'green';
      document.getElementById('message').innerHTML = 'matching';
    } else {
      document.getElementById('message').style.color = 'red';
      document.getElementById('message').innerHTML = 'not matching';
    }
  }

function createAccount() {
    let emailAddress = document.getElementById("emailAddress").value
    let password = document.getElementById("password").value
    document.getElementById("password").value = ""
    document.getElementById("confirmPassword").value = ""

    console.log(emailAddress)
    var data = new FormData();
    data.append('email', emailAddress);
    data.append('password', password);
    
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.homeyalarm.com/createKey', true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('Client-ID',Homey.env.CLIENTID);
    xhr.onload = function () {
        writeResult(this.responseText)
        var json = JSON.parse(this.responseText)
        if ( json.Response == "Error" ) {
            writeResponse(json.Response, json.Reason)
        } else if ( json.Response == "OK") {
            console.log(json.APIKey)
            heimdallSettings.APIKey = json.APIKey
            Homey.set('settings', heimdallSettings );
            document.getElementById('configHomeyAlarmStep1').style="display:none";
            document.getElementById('configHomeyAlarmStep2').style="display:block";
        }        
    };
    xhr.send(urlencodeFormData(data));
// tempcode
    document.getElementById('tempapikey').value = heimdallSettings.APIKey;
}

function getState() {
    console.log('getState')
    var data = new FormData();
    
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.homeyalarm.com/getState', true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('Client-ID',Homey.env.CLIENTID);
    xhr.setRequestHeader('APIKey', heimdallSettings.APIKey);
    xhr.onload = function () {
        writeResult(this.responseText)
        var json = JSON.parse(this.responseText)
        if ( json.Response == "Error" ) { 
            writeResponse(json.Response, json.Reason)
        } else {
            writeResponse(json.Response, json.homestate_alarm)
        }
    };
    xhr.send(data); 
}

function getHeartbeat() {
    console.log('gHeartbeat')
    var data = new FormData();
    
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://www.homeyalarm.com/heartbeat', true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('Client-ID',Homey.env.CLIENTID);
    xhr.setRequestHeader('APIKey', heimdallSettings.APIKey);
    xhr.onload = function () {
        writeResult(this.responseText)
        var json = JSON.parse(this.responseText)
        if ( json.Response == "Error" ) { 
            writeResponse(json.Response, json.Reason)
        } else {
            writeResponse('<h2>Status</h2>', this.responseText)
        }
    };
    xhr.send(data); 
}

function writeResponse(response, reason) {
    document.getElementById('response').innerHTML = "<h2>" + response + "</h2>"
    document.getElementById('reason').innerHTML = reason
}

function writeResult(result) {
    document.getElementById('result').innerHTML = result
}

function urlencodeFormData(fd){
    var s = '';
    function encode(s){ return encodeURIComponent(s).replace(/%20/g,'+'); }
    for(var pair of fd.entries()){
        if(typeof pair[1]=='string'){
            s += (s?'&':'') + encode(pair[0])+'='+encode(pair[1]);
        }
    }
    return s;
}

// Tijdelijk

function tempsaveKey() {
    heimdallSettings.APIKey = document.getElementById("tempapikey").value
    Homey.set('settings', heimdallSettings );
}