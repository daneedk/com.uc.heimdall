# Heimdall - Let Homey watch over your home

This app enables you to use your Homey as a surveillance system.
All detected motion and open/closed doors and windows on selected sensors will be seen by Heimdall. All these events will be logged and when Heimdall is in a Surveillance Mode the alarm will be triggered.

## How do I get it to work?
* Add a Surveillance Mode switch.
* Select the devices to monitor on the devices page. 
* Add flows to activate and deactivate the desired Surveillance Mode.
* Add a flow with the desired actions when the alarm is triggered.
* Add a flow to deactivate the alarm.
* Add an Alarm Off Button.
* Detailed instructions can be found on the Instructions tab in the apps settings.

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