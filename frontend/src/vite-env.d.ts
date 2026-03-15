/// <reference types="vite/client" />

interface LeafletMap {
  setView: (coords: [number, number], zoom: number) => LeafletMap;
  remove: () => void;
}

interface LeafletMarker {
  addTo: (map: LeafletMap) => LeafletMarker;
  bindPopup: (content: string) => LeafletMarker;
}

interface TileLayer {
  addTo: (map: LeafletMap) => TileLayer;
}

declare global {
  interface Window {
    L: {
      map: (element: HTMLElement | string, options?: any) => LeafletMap;
      tileLayer: (url: string, options?: any) => TileLayer;
      marker: (coords: [number, number]) => LeafletMarker;
    };
  }
}
