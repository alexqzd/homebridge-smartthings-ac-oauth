# Homebridge Smartthings AC Plugin

Control you Samsung SmartThings air conditioner with HomeKit using HomeBridge.

<img src="assets/homekit_ac.png" width="300">

## Setup the Plugin

Install the plugin by runnign:

    npm install -g homebridge-smartthings-ac

Generate a SmartThings API token here: https://account.smartthings.com/tokens
Make sure the token is allowed to 

* list 
* see 
* control 

all devices. 

Then, your token should look something like this:

    MyToken — x:devices:*, l:devices, r:devices:*

Enter the API token in the plugin settings in homebridge:

![Settings](assets/settings.png)

Finally, restart HomeBridge to reload the plugin.

## Setup Development Environment

If you want to get involved, here's how you build and install the plugin locally on your machine.

### Install Development Dependencies

Using a terminal, navigate to the project folder and run this command to install the development dependencies:

```
npm install
```

### Build Plugin

TypeScript needs to be compiled into JavaScript before it can run. The following command will compile the contents of your [`src`](./src) directory and put the resulting code into the `dist` folder.

```
npm run build
```

### Link To Homebridge

Run this command so your global install of Homebridge can discover the plugin in your development environment:

```
npm link
```

You can now start Homebridge, use the `-D` flag so you can see debug log messages in your plugin:

```
homebridge -D
```

### Watch For Changes and Build Automatically

If you want to have your code compile automatically as you make changes, and restart Homebridge automatically between changes you can run:

```
npm run watch
```

This will launch an instance of Homebridge in debug mode which will restart every time you make a change to the source code. It will load the config stored in the default location under `~/.homebridge`. You may need to stop other running instances of Homebridge while using this command to prevent conflicts. You can adjust the Homebridge startup command in the [`nodemon.json`](./nodemon.json) file.
