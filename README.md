# Heimdall

This app makes it a bit easier to use your Homey as a surveillance system.
All detected motion and open/closed doors and windows on selected sensors will be seen by Heimdall. All these events will be logged and when Heimdall is in a Surveillance Mode the alarm will be triggered.

## How do I get it to work?
* Add a Surveillance Mode button.
* Select the devices to monitor on the settings page. 
* Add flows to activate and deactivate the desired Surveillance Mode.
* Add a flow with the desired actions when the alarm is triggered.
* Add a flow to deactivate the alarm.
* Add an Alarm Off Button.
* Detailed instructions can be found on the Instructions tab in the apps settings.

## Known issues
* The app crashes when the app page in Homeys settings is opened while the app is initializing.
* Dutch translations incomplete.

## Fixed issues
* The Surveillance Mode Switch does not get updated when the Surveillance mode is set with flow cards.
* Due to the adding of the Arming Delay in 0.0.11 the flowcards on the Surveillance Mode device are not representing the actual state. New flowcards are available from version 0.0.12, please replace the trigger and condition cards in your flows for the new cards that are available on the app icon in the flow editor.

## Planned features
- [X] Button to activate/deactivate surveillance mode.
- [X] Settings page to select the motion and door/windows sensors to listen to.
- [X] Trigger delay selectable for a monitored device.
- [X] Triggercard when a Delayed Trigger starts.
- [X] Multiple 'armed' modes.
- [X] Arming delay.
- [X] Triggercard when a Arming is delayed.
- [X] Button to deactivate alarm.
- [X] Replace current Surveillance Mode device with one with the same functionality but without the flow cards.
- [ ] Add alarm state indicator to the Deactivate Alarm button.
- [ ] Redesign the Dashboard.
- [ ] ..

## Version 0.0.13
* Replaced Surveillance Mode device with new one that has the same functionality minus the trigger and condition flow cards
* Fixed greyed-out 'Deactivate alarm button' (Needs removing an adding of the device)

## Version 0.0.12
* Added triggercard that fires when the Surveillance Mode changes.
* Added conditioncard to check Surveillance Mode.

## Version 0.0.11
* Added 'Arming Delay'.
* Added triggercard that gets fired every second during the arming delay. 

## Version 0.0.10
* Added triggercard that gets fired every second during a delayed trigger.
* Added more Dutch translations.
* Added Alarm Off Button. (1st version, functional but needs UX improvement)
* Added new icon to Surveillance Mode Button. (Needs removing and readding)
* Preparations for beta release.

## Version 0.0.9
* Added multiple 'armed' modes.
* Redesigned the device settings due to the multiple 'armed' modes.
* Added new Surveillance Mode button due to the multiple 'armed' modes.
* Removed flowcards due to the multiple 'armed' modes.
* New flowcards available on the Surveillance Mode button.
* Added more options what to log.
* Added more Dutch translations.

## Version 0.0.8
* Added a 'Just log' option for devices so they can be logged without activating the alarm.
* Added some intelligence to the selection of Monitor, Delayed Trigger and Just log options.
* Added more Dutch translations.

## Version 0.0.7
* Finished and enabled the 'Delayed Trigger' functionality.
* Added instructions to the app page in Homeys settings.

## Version 0.0.6
* Fixed bug that was introduced in 0.0.5 for first installations.

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