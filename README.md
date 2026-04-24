# ares-cli

> [!WARNING]
> **We moved to [@webos-tools/cli](https://github.com/webos-tools/cli).** In the future, we plan to develop and maintain a single webOS CLI to support multi webOS in @webos-tools/cli. This repository has been deprecated since March 4, 2024.

**ares-cli** is a command-line interface (CLI) for webOS. It provides a collection of commands used for creating, packaging, installing, and launching apps or services in the command line environment. ares-cli lets you develop and test apps or services without using any IDE.

## Installation

To install ares-cli, use `npm`. It is recommended to install ares-cli globally. For Linux and macOS, you might need the `sudo` command.

``` shell
$ npm install -g @webosose/ares-cli
```

> Note: Node version 10.24.1 to 14.15.1 are recommended.

## Compatibility

Our release cycle is independent of webOS OSE and Auto. 
We recommend using the latest CLI. The latest CLI is compatible with the latest webOS OSE and Auto"

For information about the CLI previous version and compatible with platform, see the [CLI Release Notes](https://www.webosose.org/docs/tools/sdk/cli/cli-release-notes/).

## Command List

The list of ares-cli commands is as follows:

- `ares-generate`: Creates a webOS app or service from templates.
- `ares-package`: Packages the app or services into a package file.
- `ares-setup-device`: Manages the target devices.
- `ares-install`: Installs the app or service on the target device.
- `ares-launch`: Launches or terminates the app.
- `ares-inspect`: Enables Web Inspector or Node's Inspector for debugging web app or JS service.
- `ares-server`: Runs the Web server for testing local app file.
- `ares-shell`: Executes shell commands in the target device.
- `ares-push`: Pushes file(s) from a host machine to a target device.
- `ares-pull`: Pulls file(s) from a target device to a host machine.
- `ares-device`: Displays the device information.
- `ares-log`: Shows or saves logs of webOS apps and services.

## Documentations

- For more details about how to use ares-cli, see the [webOS OSE CLI User Guide](https://www.webosose.org/docs/tools/sdk/cli/cli-user-guide/#cli-commands).
- For step-by-step guides for developing apps or services, see the [tutorials](https://www.webosose.org/docs/tutorials/).
    - Developing External Web Apps
    - Developing External JS Services
    - Developing External QML Apps
    - Developing External Native Apps
    - Developing External Native Services

## Test Commands

You can test the ares-cli commands and their options to check their validity. The test is performed by `jasmine` or `npm test`. 

### Before You Begin

1. Turn on the webOS device.
2. Check the IP address and SSH port number.
3. Enable the developer mode.
    - webOS OSE: Already enabled by default.
    - webOS Auto: Enable it in the Settings app.

The following key-value pairs are the default configurations for the test.

192.168.178.27

