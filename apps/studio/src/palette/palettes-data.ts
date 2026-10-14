// apps/studio/src/palette/palettes-data.ts
// Danh sach cac bo bang mau pixel art kinh dien

export interface PalettePreset {
  id: string;
  name: string;
  colors: string[];
}

export const PRESET_PALETTES: PalettePreset[] = [
  {
    id: 'endesga-32',
    name: 'Endesga 32 (Game Action & RPG)',
    colors: [
      '#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
      '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
      '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
      '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'
    ]
  },
  {
    id: 'pico-8',
    name: 'Pico-8 (16 Colors)',
    colors: [
      '#000000', '#1D2B53', '#7E2553', '#008751',
      '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
      '#FF004D', '#FFA300', '#FFEC27', '#00E436',
      '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
    ]
  },
  {
    id: 'gameboy',
    name: 'Game Boy Classic (4 Colors)',
    colors: [
      '#0f380f', '#306230', '#8bac0f', '#9bbc0f'
    ]
  },
  {
    id: 'dawnbringer-16',
    name: 'DawnBringer 16',
    colors: [
      '#140c1c', '#442434', '#30346d', '#4e4a4e',
      '#854c30', '#346524', '#d04648', '#757161',
      '#597dce', '#d27d2c', '#8595a1', '#6daa2c',
      '#d2a474', '#4992db', '#dad45e', '#deeed6'
    ]
  }
];
