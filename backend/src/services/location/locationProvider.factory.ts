import { config } from '../../config';
import { ILocationProvider } from './locationProvider.interface';
import { MockLocationProvider } from './mockLocationProvider';
import { GoogleMapsLocationProvider } from './googleMapsLocationProvider';
import { OsmLocationProvider } from './osmLocationProvider';
import { AppError } from '../../utils';

export const createLocationProvider = (): ILocationProvider => {
  if (config.mapsProvider === 'osm') {
    return new OsmLocationProvider({
      overpassUrl: config.osmOverpassUrl,
      nominatimUrl: config.osmNominatimUrl
    });
  }

  if (config.mapsProvider === 'google') {
    if (!config.googleMapsApiKey) {
      throw new AppError('Google Maps API key is missing while MAPS_PROVIDER is configured as "google"', 500);
    }
    return new GoogleMapsLocationProvider(config.googleMapsApiKey);
  }

  if (config.mapsProvider === 'mock') {
    return new MockLocationProvider();
  }

  throw new AppError(`Unsupported MAPS_PROVIDER: "${config.mapsProvider}"`, 500);
};
