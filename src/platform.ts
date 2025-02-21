import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic, UnknownContext } from 'homebridge';
import * as fs from 'fs';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SmartThingsAirConditionerAccessory } from './platformAccessory';
import { RefreshTokenAuthenticator, RefreshTokenStore, RefreshData, Device, Component, CapabilityReference, SmartThingsClient, AuthData } from '@smartthings/core-sdk';
import { DeviceAdapter } from './deviceAdapter';


// on get refresh data, return the refresh token from the json file, and the secrets from the const variables
// on put auth data, write the auth data to the json file

// get and put refresh data from/to a json file
export class jsonTokenStore implements RefreshTokenStore {
  private readonly path: string;
  private readonly clientId: string;
  private readonly clientSecret: string
  constructor(public readonly log: Logger, path: string, clientId: string, clientSecret: string) {
    this.path = path;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }
  async getRefreshData(): Promise<RefreshData> {
    const data = fs.readFileSync(this.path, 'utf8');
    const json = JSON.parse(data);
    const refreshData = { refreshToken: json.refreshToken, clientId: this.clientId, clientSecret: this.clientSecret };
    this.log.debug('Loaded refresh data:', refreshData);
    return refreshData;
  }
  async putAuthData(data: AuthData): Promise<void> {
    fs.writeFileSync(this.path, JSON.stringify(data));
    this.log.debug('Saved auth data:', data);
  }
}


export class SmartThingsPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  private readonly accessories: PlatformAccessory[] = [];
  private readonly client: SmartThingsClient;
  private readonly tokenStore: RefreshTokenStore;
  private readonly refreshTokenAuthenticator: RefreshTokenAuthenticator;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    const authToken = this.config.authToken as string;
    const refreshToken = this.config.refreshToken as string;
    const clientId = this.config.clientId as string;
    const clientSecret = this.config.clientSecret as string;

    const jsonPath = 'refreshToken.json';
    this.tokenStore = new jsonTokenStore(this.log, jsonPath, clientId, clientSecret);

    if (!fs.existsSync('refreshToken.json')) {
      this.tokenStore.putAuthData({ authToken: authToken, refreshToken: refreshToken });
      this.log.info('Token store created at', jsonPath);
    } else {
      this.log.info('Token store found at', jsonPath);
    }

    this.refreshTokenAuthenticator = new RefreshTokenAuthenticator('', this.tokenStore);
    this.client = new SmartThingsClient(this.refreshTokenAuthenticator);

  
    if (authToken?.trim() && refreshToken?.trim()) {
      this.log.debug('Loading devices with auth token:', authToken, 'refresh token:', refreshToken);

      this.api.on('didFinishLaunching', () => {
        this.client.devices.list()
          .then((devices: Device[]) => this.handleDevices(devices))
          .catch(err => log.error('Cannot load devices', err));
      });
    } else {
      this.log.warn('Please congigure your API auth and refresh tokens and restart homebridge.');
    }
  }

  private handleDevices(devices: Device[]) {
    for (const device of devices) {
      if (device.components) {
        const capabilities = this.getCapabilities(device);
        const missingCapabilities = this.getMissingCapabilities(capabilities);

        if (device.deviceId && missingCapabilities.length === 0) {
          this.log.info('Registering device', device.deviceId);
          this.handleSupportedDevice(device);
        } else {
          this.log.info('Skipping device', device.deviceId, device.label, 'Missing capabilities', missingCapabilities);
        }
      }
    }
  }

  private getMissingCapabilities(capabilities: string[]): string[] {
    return SmartThingsAirConditionerAccessory.requiredCapabilities
      .filter((el) => !capabilities.includes(el));
  }

  private handleSupportedDevice(device: Device) {
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === device.deviceId);
    if (existingAccessory) {
      this.handleExistingDevice(device, existingAccessory);
    } else {
      this.handleNewDevice(device);
    }
  }

  private getCapabilities(device: Device) {
    return device.components?.flatMap((component: Component) => component.capabilities)
      .map((capabilityReference: CapabilityReference) => capabilityReference.id) ?? [];
  }

  private handleExistingDevice(device: Device, accessory: PlatformAccessory<UnknownContext>) {
    this.log.info('Restoring existing accessory from cache:', device.label);
    this.createSmartThingsAccessory(accessory, device);
  }

  private handleNewDevice(device: Device) {
    this.log.info('Adding new accessory:', device.label);
    const accessory = this.createPlatformAccessory(device);

    this.createSmartThingsAccessory(accessory, device);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }

  private createPlatformAccessory(device: Device): PlatformAccessory<UnknownContext> {
    if (device.label && device.deviceId) {
      const accessory = new this.api.platformAccessory(device.label, device.deviceId);
      accessory.context.device = device;
      return accessory;
    }

    throw new Error('Missing label and id.');
  }

  private createSmartThingsAccessory(accessory: PlatformAccessory<UnknownContext>, device: Device) {
    const deviceAdapter = new DeviceAdapter(device, this.log, this.client);
    new SmartThingsAirConditionerAccessory(this, accessory, deviceAdapter);
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.push(accessory);
  }
}
