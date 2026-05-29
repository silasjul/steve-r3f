import { BufferGeometry, PlaneGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

let cached: BufferGeometry | null = null;

/**
 * Two unit-wide planes crossed at ±45° around Y, pivoted at the base (y=0).
 *
 * The top pixel row of plant textures (grass tips, flower bulb crowns) is
 * usually fully opaque, which produces a visible "+" of intersecting plane
 * edges from low angles. We crop the geometry and UVs to skip that row —
 * height shrinks to 15/16, and max UV v clamps to 15/16. Same idea applied
 * to the side edges (1px on each side) so vertical seams don't show either.
 */
export function getCrossPlaneGeometry(): BufferGeometry {
  if (cached) return cached;

  const PX = 1 / 16;
  const W = 1 - PX * 2;
  const H = 1 - PX;

  const make = () => {
    const g = new PlaneGeometry(W, H);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setX(i, PX + u * (1 - PX * 2));
      uv.setY(i, v * (1 - PX));
    }
    g.translate(0, H / 2, 0);
    return g;
  };

  const a = make();
  const b = make();
  a.rotateY(Math.PI / 4);
  b.rotateY(-Math.PI / 4);
  const merged = mergeGeometries([a, b])!;
  a.dispose();
  b.dispose();
  cached = merged;
  return cached;
}
