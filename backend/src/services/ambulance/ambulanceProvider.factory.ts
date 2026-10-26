import { IAmbulanceProvider } from './ambulanceProvider.interface';
import { MockAmbulanceProvider } from './mockAmbulanceProvider';

export const createAmbulanceProvider = (): IAmbulanceProvider => {
  // Can be extended in the future to return a live telemetry provider if configured
  return new MockAmbulanceProvider();
};
