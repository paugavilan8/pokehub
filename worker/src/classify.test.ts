import { describe, expect, it } from 'vitest';
import { classify, detectLang } from './classify';

// Títulos reales de tiendas españolas (octubre de 2026).
describe('classify', () => {
  it.each([
    ['ETB Caos Creciente - (Idioma Español)', 'etb'],
    ['Booster Box Llamas Obsidianas  - (Idioma Español)', 'box'],
    ['Blister Llama Blanca  - (Idioma Español)', 'blister'],
    ['Mini Tin Crown Zenith - (Idioma Inglés)', 'tin'],
    ['Sobre Party VStar Universe - (Idioma Coreano)', 'pack'],
    ['Sobres 25th Anniversary', 'pack'],
    ['Booster Bundle Delta Reign ( Próximamente )', 'bundle'],
    ['Lata Pokémon 30 Aniversario EX Tin, Español', 'tin'],
    ['Build & Battle Box Chaos Rising - Inglés', 'collection'],
    ['Caja 30th Anniversary Celebration M6a - Coreano', 'collection'],
    ['UPC 30 Aniversario, Celebraciones Pokémon, Inglés ( Próximamente )', 'collection'],
  ])('%s -> %s', (title, kind) => {
    expect(classify(title)).toBe(kind);
  });

  it.each([
    'Topps | Value Box Topps NFL HERITAGE 2026',
    'Disney Lorcana | Caja 24 Sobres Hyperia City',
    'Weiss Schwarz | Booster Box 12 Sobre Persona 30th Anniversary',
    'Booster Box Yu-Gi-Oh Original Artwork Collection - (Idioma Japonés)',
    'Pikachu ex #234 Special Art Rare M2a Mega Dream ex PSA 10 - Japonés',
    'Charizard EX 100/106 – Flashfire – Inglés – Full Art',
    'Protector Acrílico para Bundle',
    'Bolsa Pokémon',
    'Gift Bundle El Hobbit - Inglés',
    'Pedido David',
    'Combo Booster Box Perfect Order + ETB 30 Aniversario',
    'Fundas Premium Matte Radiant Jirachi',
    'Case 10 ETB Oscuridad Absoluta | Élite Pitch Black',
    'Pokémon Mystery Box 1000€ Caja Misteriosa de Cartas Pokémon',
    'Pokémon Center Heat Wave Arena: Misty & Psyduck Porta Deck Box',
  ])('descarta %s', (title) => {
    expect(classify(title, title.includes('Hobbit') ? ['Booster Bundle Magic: The Gathering'] : [])).toBeNull();
  });

  it('usa etiquetas y tipo de producto para descartar otros juegos', () => {
    expect(classify('Booster Box 18 Sobres HV-P04 Talent and Sense', ['Segunda Mano', 'Otros TCGs'])).toBeNull();
    expect(classify('My Little Pony TCG | Booster Box 20 Sobres Nightmare Night', [])).toBeNull();
  });
  it('confía en la etiqueta Pokémon aunque el nombre recuerde a otro juego', () => {
    expect(classify('Caja de sobres Magic Mirror', ['Caja de sobres Pokémon TCG'])).toBe('box');
  });
});

describe('detectLang', () => {
  it('lee el idioma del título o las etiquetas', () => {
    expect(detectLang('ETB Caos Creciente - (Idioma Español)')).toBe('es');
    expect(detectLang('Sobres 25th Anniversary', ['Coreano - Japonés'])).toBe('ja');
    expect(detectLang('Build & Battle Box Chaos Rising - Inglés')).toBe('en');
    expect(detectLang('Caja sin idioma')).toBeNull();
  });
});
