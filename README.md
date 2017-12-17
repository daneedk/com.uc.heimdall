# Heimdall

This app makes it a bit easier to use your Homey as a surveillance system.
All detected motion and open/closed doors and windows on selected sensors will be seen by Heimdall. All these events will be logged and when Heimdall is in Surveillance Mode the alarm will be triggered.

## How do I get it to work?
* Add flows to activate and deactivate the Surveillance Mode.
* Add a flow with the desired actions when the alarm is triggered.
* Add a flow to deactivate the alarm.
* Add a Surveillance Mode Switch to use in the Homey app.
* Select the devices to monitor on the settings page.

## Known issues
* ~~The Surveillance Mode Switch does not get updated when the Surveillance mode is set with flow cards.~~

## Planned features
- [X] Button to activate/deactivate surveillance mode.
- [X] Settings page to select the motion and door/windows sensors to listen to.
- [ ] Button to deactivate alarm.
- [ ] Trigger delay configurable per device.
- [ ] Multiple 'armed' modes.
- [ ] ..

## Version 0.0.5
* Surveillance Mode Switch gets updated when the Surveillance mode is set with flow cards.

## Version 0.0.4
* Devices to monitor are monitored instantly after selecting, it is no longer needed to restart the app.

## Version 0.0.3
* Devices to monitor can now be selected on the settings page.
* Devices to have a 'Delayed Trigger' can be selected on the settings page. *Functionality is disabled*

## Version 0.0.2
* Added device: Surveillance Mode Switch. Turn Surveillance mode on/off.
* Added trigger flowcard: Surveillance is activated.
* Added trigger flowcard: Surveillance is deactivated.
* Some code cleanup. 

## Version 0.0.1
* Initial release.

Please remember, Heimdall is not intended to be a full blown security system.