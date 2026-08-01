import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Vite bundles Leaflet's marker images at hashed URLs; point the default
// icon at them explicitly so pins don't silently disappear in production.
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function createMap(container: HTMLElement, center: [number, number] = [40.7128, -74.006], zoom = 14): L.Map {
  const map = L.map(container).setView(center, zoom);
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  return map;
}

export { L };
