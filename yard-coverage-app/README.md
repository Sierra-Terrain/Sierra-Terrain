# Sierra Terrain Yard Coverage App

Standalone static prototype for estimating residential outdoor square footage from an address, Google Maps satellite context, and six editable yard sections.

## Run

From this directory:

```bash
python3 -m http.server 4174
```

Then open `http://localhost:4174`.

## Google Maps

The app runs in demo mode without a key. To use live Google Maps, either:

- set `window.GOOGLE_MAPS_API_KEY` in `index.html`, or
- open the app with `?key=YOUR_GOOGLE_MAPS_KEY`.

The key needs access to the Maps JavaScript API and Geocoding API.
