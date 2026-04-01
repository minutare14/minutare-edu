/**
 * modules-data.js — Fonte de dados estruturada dos módulos
 * ─────────────────────────────────────────────────────────
 * COMO ATUALIZAR COM SEUS .md:
 *   Quando você me entregar os arquivos .md, eu atualizo a
 *   propriedade "content" de cada seção abaixo com o novo texto.
 *   Os módulos carregam esse conteúdo automaticamente.
 *
 * ESTRUTURA DE CADA SEÇÃO:
 *   { title, type, content }
 *   type: 'teoria' | 'exemplo' | 'atencao' | 'visual'
 *   content: string HTML pronto para renderizar
 */

window.MODULES_DATA = {

  // ─────────────────────────────────────────────────────────
  // MÓDULO 1 — Conjuntos Numéricos
  // ─────────────────────────────────────────────────────────
  'modulo-1': {
    title:    'Conjuntos Numéricos',
    aiTopic:  'Conjuntos Numéricos: Naturais, Inteiros, Racionais, Irracionais e Reais',
    quizTopic: 'Conjuntos Numéricos',
    fallbackQuiz: [
      {
        question: 'Qual dos números a seguir é irracional?',
        options: ['1/3', '√2', '0,333...', '−5'],
        correctAnswer: 1,
        explanation: '√2 ≈ 1,41421… é uma dízima infinita e não periódica, logo não pode ser escrito como fração — é irracional.',
        difficulty: 'fácil'
      },
      {
        question: 'Quais conjuntos contêm o número −7?',
        options: ['Apenas ℤ', 'ℤ, ℚ e ℝ', 'Apenas ℚ', 'ℕ, ℤ e ℝ'],
        correctAnswer: 1,
        explanation: '−7 é inteiro (ℤ), racional (ℚ = p/q, ex: −7/1) e real (ℝ). Não é natural pois ℕ não inclui negativos.',
        difficulty: 'médio'
      },
      {
        question: 'A dízima 0,1111... pertence a qual conjunto?',
        options: ['𝕀 (Irracional)', 'ℕ (Natural)', 'ℚ (Racional)', 'Nenhum dos anteriores'],
        correctAnswer: 2,
        explanation: '0,1111... = 1/9. Toda dízima periódica pode ser expressa como fração, portanto é racional (ℚ).',
        difficulty: 'médio'
      },
      {
        question: 'Qual afirmação sobre os conjuntos numéricos é VERDADEIRA?',
        options: ['ℕ ⊂ 𝕀', 'ℚ ∩ 𝕀 = ℝ', 'ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ', '𝕀 ⊂ ℚ'],
        correctAnswer: 2,
        explanation: 'A cadeia de inclusões correta é ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ. Os irracionais (𝕀) ficam separados de ℚ, mas ambos estão dentro de ℝ.',
        difficulty: 'difícil'
      },
      {
        question: 'π (pi) pertence a qual(is) conjunto(s)?',
        options: ['ℚ e ℝ', 'Apenas ℝ', '𝕀 e ℝ', 'ℤ, ℚ e ℝ'],
        correctAnswer: 2,
        explanation: 'π ≈ 3,14159... é irracional (não tem fração equivalente) e real. Pertence a 𝕀 e ℝ.',
        difficulty: 'fácil'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // MÓDULO 2 — Intervalos Reais
  // ─────────────────────────────────────────────────────────
  'modulo-2': {
    title:    'Intervalos Reais',
    aiTopic:  'Intervalos Reais: abertos, fechados, mistos e semirretas na reta real',
    quizTopic: 'Intervalos Reais',
    fallbackQuiz: [
      {
        question: 'O intervalo [−2, 5[ corresponde a qual desigualdade?',
        options: ['−2 < x < 5', '−2 ≤ x < 5', '−2 < x ≤ 5', '−2 ≤ x ≤ 5'],
        correctAnswer: 1,
        explanation: '[ indica extremo fechado (inclui −2, sinal ≤) e [ indica extremo aberto (exclui 5, sinal <). Resultado: −2 ≤ x < 5.',
        difficulty: 'fácil'
      },
      {
        question: 'O conjunto {x ∈ ℝ | x > 3} é representado por:',
        options: ['[3, +∞[', ']3, +∞[', ']−∞, 3[', '[3, +∞]'],
        correctAnswer: 1,
        explanation: 'x > 3 exclui o 3 (colchete aberto) e vai até +∞ (sempre aberto). Resposta: ]3, +∞[.',
        difficulty: 'fácil'
      },
      {
        question: 'Quantos inteiros existem no intervalo ]1, 5]?',
        options: ['3', '4', '5', '2'],
        correctAnswer: 1,
        explanation: ']1, 5] exclui 1 e inclui 5. Os inteiros são: 2, 3, 4, 5 → 4 inteiros.',
        difficulty: 'médio'
      },
      {
        question: 'Qual intervalo contém o número −½?',
        options: ['[0, 2[', ']−1, 0[', ']0, 1[', '[1, 3]'],
        correctAnswer: 1,
        explanation: '−½ = −0,5 está entre −1 e 0. O intervalo ]−1, 0[ inclui todos os reais entre −1 e 0 (exclusive os extremos).',
        difficulty: 'médio'
      },
      {
        question: 'Qual notação é INCORRETA?',
        options: ['[a, b]', ']a, +∞[', '[−∞, b]', ']a, b['],
        correctAnswer: 2,
        explanation: '[−∞, b] está incorreto pois o infinito NUNCA é incluído — deve ser sempre colchete aberto. O correto é ]−∞, b].',
        difficulty: 'difícil'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // MÓDULO 3 — Álgebra e Fatoração
  // ─────────────────────────────────────────────────────────
  'modulo-3': {
    title:    'Álgebra e Fatoração',
    aiTopic:  'Produtos Notáveis e Fatoração Algébrica',
    quizTopic: 'Produtos Notáveis e Fatoração',
    fallbackQuiz: [
      {
        question: 'Qual é o resultado de (x + 3)²?',
        options: ['x² + 9', 'x² + 3x + 9', 'x² + 6x + 9', 'x² + 6x + 3'],
        correctAnswer: 2,
        explanation: '(a+b)² = a² + 2ab + b². Com a=x e b=3: x² + 2·x·3 + 3² = x² + 6x + 9.',
        difficulty: 'fácil'
      },
      {
        question: 'Qual é a fatoração de x² − 16?',
        options: ['(x−4)²', '(x+4)(x−4)', '(x+8)(x−2)', '(x−16)(x+1)'],
        correctAnswer: 1,
        explanation: 'x² − 16 = x² − 4² → diferença de quadrados → (x+4)(x−4).',
        difficulty: 'fácil'
      },
      {
        question: 'Qual é a forma fatorada de x² + 10x + 25?',
        options: ['(x+5)(x−5)', '(x+5)²', '(x−5)²', '(x+25)(x+1)'],
        correctAnswer: 1,
        explanation: 'x² + 10x + 25 = x² + 2·5·x + 5² → trinômio quadrado perfeito → (x+5)².',
        difficulty: 'médio'
      },
      {
        question: 'Qual é o resultado de (2x − 1)(2x + 1)?',
        options: ['4x² − 4x + 1', '4x² + 1', '4x² − 1', '2x² − 1'],
        correctAnswer: 2,
        explanation: '(a+b)(a−b) = a² − b². Com a=2x e b=1: (2x)² − 1² = 4x² − 1.',
        difficulty: 'médio'
      },
      {
        question: 'Qual é o fator em evidência de 6x³ + 9x²?',
        options: ['3x', '3x²', '6x²', '9x'],
        correctAnswer: 1,
        explanation: 'MDC(6,9)=3 e MDC(x³,x²)=x². Fator = 3x². Verificando: 3x²·(2x+3) = 6x³+9x². ✓',
        difficulty: 'difícil'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // MÓDULO 4 — Relação de Ordem e Reta Real
  // ─────────────────────────────────────────────────────────
  'modulo-4': {
    title:    'Relação de Ordem e Reta Real',
    aiTopic:  'Relação de Ordem dos Reais e Reta Real',
    quizTopic: 'Relação de Ordem e Reta Real',
    fallbackQuiz: [
      {
        question: 'Na reta real, qual número fica mais à esquerda?',
        options: ['−1', '0,5', '−3', '1'],
        correctAnswer: 2,
        explanation: 'Quanto mais à esquerda, menor o número. −3 < −1 < 0,5 < 1, logo −3 fica mais à esquerda.',
        difficulty: 'fácil'
      },
      {
        question: 'Se a < b e multiplicamos ambos por −2, o resultado é:',
        options: ['−2a < −2b', '−2a > −2b', '−2a = −2b', 'Não é possível determinar'],
        correctAnswer: 1,
        explanation: 'Ao multiplicar por negativo, o sinal de desigualdade INVERTE. a < b → −2a > −2b.',
        difficulty: 'médio'
      },
      {
        question: 'Ordene do menor para o maior: −1/2, √3, 0, −2, 1',
        options: [
          '−2 < −1/2 < 0 < 1 < √3',
          '−1/2 < −2 < 0 < 1 < √3',
          '−2 < 0 < −1/2 < 1 < √3',
          '−2 < −1/2 < 0 < √3 < 1'
        ],
        correctAnswer: 0,
        explanation: '√3 ≈ 1,73 e −1/2 = −0,5. Em ordem: −2 < −0,5 < 0 < 1 < 1,73.',
        difficulty: 'médio'
      },
      {
        question: 'A relação de tricotomia afirma que para a, b ∈ ℝ:',
        options: [
          'a e b podem ser simultâneamente iguais e diferentes',
          'Exatamente uma das situações é verdadeira: a<b, a=b ou a>b',
          'Sempre a > b quando a e b são positivos',
          'a < b quando a é negativo'
        ],
        correctAnswer: 1,
        explanation: 'A tricotomia diz que para quaisquer a, b reais, EXATAMENTE UMA das relações é verdadeira: a<b, a=b ou a>b.',
        difficulty: 'difícil'
      },
      {
        question: 'Se a < b e b < c, podemos concluir que:',
        options: ['a > c', 'a = c', 'a < c', 'Não é possível comparar a e c'],
        correctAnswer: 2,
        explanation: 'Propriedade da transitividade da ordem: a < b e b < c implica a < c.',
        difficulty: 'fácil'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // MÓDULO 5 — Potenciação e Radiciação
  // ─────────────────────────────────────────────────────────
  'modulo-5': {
    title:    'Potenciação e Radiciação',
    aiTopic:  'Potenciação e Radiciação: propriedades e simplificação',
    quizTopic: 'Potenciação e Radiciação',
    fallbackQuiz: [
      {
        question: 'Qual é o valor de 2³ × 2⁴?',
        options: ['4⁷', '2⁷', '2¹²', '2⁻¹'],
        correctAnswer: 1,
        explanation: 'Produto de potências de mesma base: 2³ × 2⁴ = 2^(3+4) = 2⁷ = 128.',
        difficulty: 'fácil'
      },
      {
        question: 'Qual é o valor de 3⁻²?',
        options: ['−9', '1/9', '9', '−1/9'],
        correctAnswer: 1,
        explanation: 'Expoente negativo: a⁻ⁿ = 1/aⁿ. Então 3⁻² = 1/3² = 1/9.',
        difficulty: 'fácil'
      },
      {
        question: 'Simplificando √75:',
        options: ['5√3', '3√5', '7√3', '5√5'],
        correctAnswer: 0,
        explanation: '√75 = √(25×3) = √25 × √3 = 5√3. O maior quadrado perfeito que divide 75 é 25.',
        difficulty: 'médio'
      },
      {
        question: 'Qual é o valor de 8^(2/3)?',
        options: ['4', '2', '16', '6'],
        correctAnswer: 0,
        explanation: '8^(2/3) = (³√8)² = 2² = 4. Expoente fracionário m/n = ⁿ√(base) elevado a m.',
        difficulty: 'médio'
      },
      {
        question: '√(a² + b²) é igual a:',
        options: ['a + b', '(a + b)²', 'Não simplifica para a + b', 'a² + b'],
        correctAnswer: 2,
        explanation: '√(a² + b²) ≠ a + b. A raiz distribui sobre PRODUTO, não sobre soma. Ex: √(9+16) = √25 = 5 ≠ 3+4 = 7.',
        difficulty: 'difícil'
      }
    ]
  }
};
