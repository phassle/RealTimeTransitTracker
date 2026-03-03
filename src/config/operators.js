export const OPERATORS = [
  { slug: 'sl',          name: 'SL',               region: 'Stockholm',        center: [59.33, 18.07],  bounds: [[58.7, 17.2],  [60.0, 19.2]] },
  { slug: 'ul',          name: 'UL',               region: 'Uppsala',          center: [59.86, 17.64],  bounds: [[59.4, 16.8],  [60.7, 18.5]] },
  { slug: 'otraf',       name: 'Östgötatrafiken',  region: 'Östergötland',     center: [58.41, 15.63],  bounds: [[57.9, 14.7],  [59.0, 16.7]] },
  { slug: 'jlt',         name: 'JLT',              region: 'Jönköping',        center: [57.78, 14.16],  bounds: [[57.2, 13.3],  [58.2, 15.1]] },
  { slug: 'krono',       name: 'Kronoberg',        region: 'Kronoberg',        center: [56.88, 14.81],  bounds: [[56.4, 13.8],  [57.3, 15.8]] },
  { slug: 'klt',         name: 'KLT',              region: 'Kalmar',           center: [56.66, 16.36],  bounds: [[56.2, 15.4],  [57.8, 17.0]] },
  { slug: 'gotland',     name: 'Gotland',          region: 'Gotland',          center: [57.63, 18.30],  bounds: [[57.1, 18.0],  [58.0, 19.4]] },
  { slug: 'blekinge',    name: 'Blekingetrafiken', region: 'Blekinge',         center: [56.16, 15.59],  bounds: [[55.9, 14.4],  [56.4, 16.2]] },
  { slug: 'skane',       name: 'Skånetrafiken',    region: 'Skåne',            center: [55.61, 13.00],  bounds: [[55.3, 12.4],  [56.5, 14.6]] },
  { slug: 'varm',        name: 'Värmlandstrafik',  region: 'Värmland',         center: [59.38, 13.50],  bounds: [[58.8, 11.8],  [60.5, 14.5]] },
  { slug: 'orebro',      name: 'Örebro',           region: 'Örebro',           center: [59.27, 15.21],  bounds: [[58.6, 14.2],  [59.9, 16.0]] },
  { slug: 'vastmanland', name: 'Västmanland',      region: 'Västmanland',      center: [59.62, 16.55],  bounds: [[59.2, 15.5],  [60.1, 17.0]] },
  { slug: 'dt',          name: 'Dalatrafik',       region: 'Dalarna',          center: [60.48, 15.44],  bounds: [[59.9, 12.8],  [62.3, 16.8]] },
  { slug: 'xt',          name: 'X-trafik',         region: 'Gävleborg',        center: [60.67, 17.14],  bounds: [[60.2, 14.8],  [62.0, 17.5]] },
  { slug: 'dintur',      name: 'Din Tur',          region: 'Västernorrland',   center: [62.63, 17.94],  bounds: [[62.0, 15.5],  [64.0, 19.2]] },
];

export const OPERATOR_MAP = new Map(OPERATORS.map(op => [op.slug, op]));

export const SWEDEN_CENTER = [62.5, 15.5];
export const SWEDEN_ZOOM = 5;

/**
 * Returns slugs of operators whose bounding boxes overlap the given viewport bounds.
 * @param {{ south: number, west: number, north: number, east: number }} bounds
 * @returns {string[]}
 */
export function getVisibleOperators(bounds) {
  const { south, west, north, east } = bounds;
  return OPERATORS
    .filter(op => {
      const [[opS, opW], [opN, opE]] = op.bounds;
      return opN >= south && opS <= north && opE >= west && opW <= east;
    })
    .map(op => op.slug);
}
