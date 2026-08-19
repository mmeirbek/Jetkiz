export const MANGYSTAU_REGION = {
  name: 'Mangystau Region',
  minLat: 40.5,
  maxLat: 44.5,
  minLng: 50,
  maxLng: 56.5,
} as const;

export function isMangystauCoordinate(lat: number, lng: number): boolean {
  return (
    lat >= MANGYSTAU_REGION.minLat &&
    lat <= MANGYSTAU_REGION.maxLat &&
    lng >= MANGYSTAU_REGION.minLng &&
    lng <= MANGYSTAU_REGION.maxLng
  );
}

export function isMangystauRoute(
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
): boolean {
  return (
    isMangystauCoordinate(originLat, originLng) &&
    isMangystauCoordinate(destinationLat, destinationLng)
  );
}
