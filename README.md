# Heimdall - Let Homey watch over your home ![SDK2][logo]

This app enables you to use your Homey as a surveillance system.
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

## Version 1.0.25
* Removed temporary code

## Version 1.0.24
* Improved sensor communication check
* Code cleanup

## Version 1.0.23
* Check if sensors communicated with Homey in the last 24 hours

## Version 1.0.22
* Added [Last Door](https://github.com/daneedk/com.uc.heimdall/issues/27) functionality
* Split Trigger Delay to 2 separate settings, Arming Delay and Alarm Delay
* Changed Delay range to 0-300 seconds
* Minor layout changes to settings pages

## Version 1.0.21
* Added support for Vibration sensors

## Version 1.0.20
* Added ['Sensor tripped in Alarmstate'](https://github.com/daneedk/com.uc.heimdall/issues/25) trigger flow card

## Version 1.0.19
* Added function to API to retrieve Surveillance Mode and Alarm State
* Fixed issue with [triggering on measure_temperature reports](https://github.com/daneedk/com.uc.heimdall/issues/23)
* Code cleanup

## Version 1.0.18
* Updated Community ID

## Version 1.0.17
* Skipped

## Version 1.0.16
* Support for non-sensor devices with Contact, Motion and Tamper capabilities

## Version 1.0.15
* Added 'Alarm State' condition flow card

## Version 1.0.14
* Minor translation fixes

## Version 1.0.13
* Added flowcard that triggers when a logline is written

## Version 1.0.12
* Minor translation fixes

## Version 1.0.11
* Added battery indicator to devices

## Version 1.0.10
* Added setting [Perform Pre-Arming check before Arming Delay](https://github.com/daneedk/com.uc.heimdall/issues/17)

## Version 1.0.9
* Code cleanup, removed lodash dependency
* Minor translation fixes
* Added interpunction to Speech output to make it sound more natural

## Version 1.0.8
* Made Tampering detection optional due to [bug with some sensors](https://github.com/daneedk/com.uc.heimdall/issues/15)
* Minor translation fixes

## Version 1.0.7
* [Added **_Arming countdown (not) active_** condition flowcard](https://github.com/daneedk/com.uc.heimdall/issues/14)
* [Added **_Alarm countdown (not) active_** condition flowcard](https://github.com/daneedk/com.uc.heimdall/issues/14)

## Version 1.0.6
* Added support for tampering detection

## Version 1.0.5
* [Added 'Zone' tag to 'The alarm is activated' flow card](https://github.com/daneedk/com.uc.heimdall/issues/12)

## Version 1.0.4
* Arming delay selectable per Surveillance Mode

## Version 1.0.3
* [Cancel actions on tripped sensor when Alarm state is active](https://github.com/daneedk/com.uc.heimdall/issues/13)
* Code cleanup
* Minor translation fixes

## Version 1.0.2
* Added pre-arming check

## Version 1.0.1
* Incremented version number to get a smoother upgrade experience 

## Version 1.0.0
* No functional changes, previous beta promoted to stable

## Version 0.1.11 β
* Automatic history cleanup, 20% at 3000 lines

## Version 0.1.10 β
* Fixed Auto refresh settings

## Version 0.1.9 β
* Added saving **_Auto refresh_** and **_Use colors_** settings on Dashboard tab in settings
* Code cleanup, preparing for release

## Version 0.1.8 β
* Setting Surveillance Mode to Disarmed also deactivates an Alarm
* [Retrieving history on settingspage only when Dashboard is selected](https://github.com/daneedk/com.uc.heimdall/issues/9)
* [Added button for manual refresh when auto refresh on history is off](https://github.com/daneedk/com.uc.heimdall/issues/9)
* Code cleanup

## Version 0.1.7 β
* Bugfix for [bug introduced in 0.1.6](https://github.com/daneedk/com.uc.heimdall/issues/8)
* Added Homekit compatibility for [Homeykit](https://apps.athom.com/app/com.swttt.homekit) app
* Start with Speech output support

## Version 0.1.6 β
* Cancel trigger from a tripped sensor when a delay countdown is active
* More translations

## Version 0.1.5 α
* Researching Homekit compatability

## Version 0.1.4 β
* Added colors to History view
* Added 'The alarm is deactivated' flow card
* More translations

## Version 0.1.3 β
* Improved History view
* Improved translations

## Version 0.1.2 β
* Reason tag 'human friendly'
* States in history 'human friendly'

## Version 0.1.1 β
* Code cleanup

## Version 0.1.0 β
* Initial public beta version

Thanks to all testers of the alpha version!

Please remember, Heimdall is not intended to be a full blown security system.

## Donate
If you like the app, consider buying me a beer!  
[![Paypal donate][pp-donate-image]][pp-donate-link]

[pp-donate-link]: https://www.paypal.me/daneedekruyff
[pp-donate-image]: https://www.paypalobjects.com/webstatic/en_US/i/btn/png/btn_donate_92x26.png

[logo]: https://github.com/daneedk/com.uc.heimdall/blob/beta/assets/images/sdk2.png