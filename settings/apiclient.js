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
    })

    if ( heimdallSettings.APIKey == "" ) {
        console.log('APIKey: ' + heimdallSettings.APIKey)
        document.getElementById('configHomeyAlarmIntroduction').style="display:none";
        document.getElementById('configHomeyAlarmStep1').style="display:block";
    } else {
        getHeartbeat()
        document.getElementById('homeyAlarm').style="display:block";
        console.log('APIKey: ' + heimdallSettings.APIKey)
    }
    
}









