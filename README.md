# Heimdall - Let Homey watch over your home

This app enables you to use your Homey as a surveillance system.
All detected motion and open/closed doors and windows on selected sensors will be seen by Heimdall. All these events will be logged and when Heimdall is in a Surveillance Mode the alarm will be triggered.

## How do I get it to work?
* Add a Surveillance Mode Switch.
* Select the devices to monitor on the devices page. 
* Add flows to activate and deactivate the desired Surveillance Mode.
* Add a flow with the desired actions when the alarm is triggered.
* Add a flow to deactivate the alarm.
* Add an Alarm Off Button.
* Detailed instructions can be found on the Instructions tab in the apps settings.

## Version 2.0.31
* Added Swedish language
* Localised notification on Surveillance Mode change
* Fixed some French translations

## Version 2.0.30
* Version bump due to app store changes

## Version 2.0.29
* Version bump due to app store changes

## Version 2.0.28
* Version bump due to app store changes

## Version 2.0.27
* Version bump due to app store changes

## Version 2.0.26
* Version bump due to app store changes

## Version 2.0.25
* Version bump due to app store changes

## Version 2.0.24
* Version bump due to app store changes

## Version 2.0.23
* Added condition flowcard to check if a device is part of the Partial Surveillance Mode
* Added action flowcard to add a device to the Partial Surveillance Mode
* Added action flowcard to remove a device from the Partial Surveillance Mode
* Added condition flowcard to check if a device is part of the Full Surveillance Mode
* Added action flowcard to add a device to the Full Surveillance Mode
* Added action flowcard to remove a device from the Full Surveillance Mode

## Version 2.0.22
* Fixed bug, introduced in 2.0.21, that caused devices to not log
* Added condition flowcard to check if a device is logged
* Added action flowcard to add logging to device
* Added action flowcard to remove logging from device

## Version 2.0.21
* Added condition flowcard to check if a device is delayed
* Added action flowcard to add delay to device
* Added action flowcard to remove delay from device

## Version 2.0.20
* Added 'Allow Alarm while in alarm delay'
* Added Italian translation

## Version 2.0.19
* Updated athom-api (2.1.179)

## Version 2.0.18
* Code cleanup
* Added French translation (Work in progress)
* Changed compatibility to >=2.0.5

## Version 2.0.17
* Translation improvements

## Version 2.0.16
* Fixed tag value on The arming delay is started card ([Github](https://github.com/daneedk/com.uc.heimdall/issues/37))
* Added translators to App Store

## Version 2.0.15
* Added Alarm Off function to Surveillance Mode Switch

## Version 2.0.14
* Improved dutch translations

## Version 2.0.13
* Added Alarm indicator to Alarm Off Button (Requires removing and adding the device)
* Added Alarm indicator to Surveillance Mode Switch (Requires removing and adding the device)

## Version 2.0.12
* Updated athom-api (2.1.166)

## Version 2.0.11
* Split Devices page into status- and settingspage

## Version 2.0.10
* Added new flow card: The arming delay is activated

## Version 2.0.9
* Improved device not ready handling ([Github](https://github.com/daneedk/com.uc.heimdall/issues/34))

## Version 2.0.8
* Added Check status of all sensors function
* Prevent starting a new Arming Delay when one is active
* Minor translation improvements

## Version 2.0.7
* Improved device enumeration

## Version 2.0.6
* Settings tabs automatically adjust to screenwidth

## Version 2.0.5
* Improved settings user interface
* Code cleanup

## Version 2.0.4
* Prevent creation of default flow cards for **Surveillance Mode Switch**
* Added examples to flowcard tags
* Code cleanup

## Version 2.0.3
* Small change in write to Timeline functionality

## Version 2.0.2
* Improved code for enumerating devices

## Version 2.0.1
* Fixed translations

## Version 2.0.0
* Initial rewrite to Homey V2 firmware.

## Changelog for Heimdall version 1
* The archived changelog for Heimdal Version 1 can be found in [CHANGELOG V1.md](https://github.com/daneedk/com.uc.heimdall/blob/beta/CHANGELOG%20V1.md) 

Please remember, Heimdall is not intended to be a full blown security system.

## Donate
If you like the app, consider buying me a beer!  
[![Paypal donate][pp-donate-image]][pp-donate-link]

[pp-donate-link]: https://www.paypal.me/daneedekruyff
[pp-donate-image]: https://www.paypalobjects.com/webstatic/en_US/i/btn/png/btn_donate_92x26.png
