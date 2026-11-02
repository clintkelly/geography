import { mapFor, place } from './content';
import { Dot, WorldMap, type Highlight } from './WorldMap';

/** A quick look at where a place is: the land pulses and a ring pings out from it. */
export function PlaceFlash({ placeId }: { placeId: string }) {
  const p = place(placeId);
  const map = mapFor(p.regionId);
  const highlights: Record<string, Highlight> = { [p.featureId]: 'flash' };
  const at = map.project(p.lonLat);
  return (
    <figure className="place-flash">
      <WorldMap key={placeId} map={map} label={`Map showing ${p.name}`} highlights={highlights} interactive={false} arrowPan={false}>
        {(scale) => (
          <>
            <circle cx={at[0]} cy={at[1]} r={26 * scale} className="ping" />
            <circle cx={at[0]} cy={at[1]} r={26 * scale} className="ping ping-2" />
            {p.tiny && <Dot id={placeId} at={at} scale={scale} tone="cursor" />}
          </>
        )}
      </WorldMap>
      <figcaption>{p.name}</figcaption>
    </figure>
  );
}
