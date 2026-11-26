import { describe, expect, it } from 'vitest';
import { CATEGORIAS_SUGERIDAS, planoCategorias } from '../src/core/categorias';

const HOJE = ['Temperos', 'Farinhas', 'Chás e ervas', 'Sementes e grãos', 'Argilas e minerais', 'Granolas e cereais', 'Castanhas e amendoim', 'Doces', 'Remedio', 'Geléias', 'Pimenta', 'Manteigas', 'Outros'];

describe('organização sugerida das categorias', () => {
  const p = planoCategorias(HOJE);

  it('renomeia as antigas', () => {
    expect(p.renomear).toEqual([
      ['Remedio', 'Raízes e cascas'],
      ['Granolas e cereais', 'Fibras e matinais'],
      ['Pimenta', 'Pimentas'],
      ['Geléias', 'Geleias'],
      ['Manteigas', 'Manteiga de garrafa'],
      ['Argilas e minerais', 'Argilas e cuidados naturais'],
    ]);
  });

  it('cria só as que faltam e mantém Temperos antes das especiarias até a loja mudar os produtos', () => {
    expect(p.criar).toEqual(['Especiarias em pó', 'Ervas secas', 'Temperos prontos', 'Sais e pimentas', 'Frutas secas', 'Petiscos', 'Doces de pote', 'Mel e própolis', 'Cacau e chocolates', 'Açúcares e adoçantes', 'Óleos e vinagres', 'Suplementos']);
    expect(p.ordem[0]).toBe('Temperos');
    expect(p.ordem.slice(1)).toEqual(CATEGORIAS_SUGERIDAS);
  });

  it('depois de aplicar, não sugere de novo', () => {
    expect(planoCategorias(p.ordem).mudou).toBe(false);
  });

  it('categoria que a loja inventou fica, antes de Outros', () => {
    const q = planoCategorias(['Ofertas', 'Outros', 'Doces']);
    expect(q.ordem.slice(-2)).toEqual(['Ofertas', 'Outros']);
    expect(q.ordem.filter((c) => c === 'Doces')).toHaveLength(1);
  });

  it('respeita a grafia da loja em nome igual', () => {
    const q = planoCategorias(['Chás e Ervas']);
    expect(q.ordem).toContain('Chás e Ervas');
    expect(q.ordem).not.toContain('Chás e ervas');
  });
});
