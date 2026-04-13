import type { ExamGraphAsset, ImportedExam } from './contracts';

export const IMPORTED_EXAMS: ImportedExam[] = [
    {
        "id": "prova-1",
        "slug": "prova-1-semestre-passado",
        "title": "Prova 1",
        "sourceFolderName": "PROVA-1",
        "markdownPath": "C:\\Users\\emano\\OneDrive\\Documentos\\Downloads\\PROVAS\\PROVA-1\\PROVA-1.MD",
        "imagePath": "C:\\Users\\emano\\OneDrive\\Documentos\\Downloads\\PROVAS\\PROVA-1\\PROVA-1.jpeg",
        "discipline": "Bases Matemáticas",
        "semester": "semestre_passado",
        "type": "avaliacao",
        "hasGraphs": false,
        "graphAssets": [],
        "questions": [
            {
                "id": "q1",
                "number": "1",
                "statement": "Resolva as seguintes equações:\n\na)\n\\[\n|x^2 + x - 5| - |4x - 1| = 0\n\\]\n\nb)\n\\[\n|2x^2 + x - 3| = x^2 + 2x - 3\n\\]",
                "topics": [
                    "equacoes",
                    "modulo",
                    "polinomios"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q2",
                "number": "2",
                "statement": "Resolva as seguintes inequações:\n\na)\n\\[\n\\frac{2}{3x - 1} \\ge \\frac{1}{x - 1} - \\frac{1}{x + 1}\n\\]\n\nb)\n\\[\n|x^2 - 5x + 5| \\ge 1\n\\]",
                "topics": [
                    "inequacoes",
                    "fracoes_algebricas",
                    "modulo"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q3",
                "number": "3",
                "statement": "Considere a função:\n\n\\[\nf(x) = |x^2 - 1|\n\\]\n\nDetermine:\n\na) os pontos fixos de \\(f\\);\n\nb) um ponto fixo de \\(f^2 = f \\circ f\\).",
                "topics": [
                    "funcoes",
                    "modulo",
                    "pontos_fixos",
                    "composicao"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q4",
                "number": "4",
                "statement": "Uma empresa de montagem de veículos elétricos contratou um economista para determinar a função que modela o custo de operação em função da quantidade demandada de veículos a serem montados no mês. O economista concluiu que a função que melhor aproxima esta relação custo (em milhões de reais - R$) em função da demanda (demanda de mil carros a serem produzidos no mês) é\n\n\\[\nc(x) = \\left|\\frac{x^2 + x - 5}{4x - 1}\\right|\n\\]\n\nCom isto, sabendo que a demanda sempre é maior do que zero (i.e. \\(x > 0\\)), se a empresa objetiva manter o custo de operação menor do que **R$ 1.000.000** (um milhão de reais), qual deve ser a faixa de demanda a ser delimitada?",
                "topics": [
                    "funcao_modular",
                    "inequacoes",
                    "modelagem",
                    "aplicacao"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q5",
                "number": "extra",
                "statement": "Calcule os valores de \\(m\\) para que\n\n\\[\n(m+1)x^2 + 2(m+1)x + m - 1 = 0\n\\]\n\ntenha raízes negativas.",
                "topics": [
                    "equacao_quadratica",
                    "parametro",
                    "raizes"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            }
        ],
        "publicImagePath": "/exam-support/PROVA-1/PROVA-1.jpeg"
    },
    {
        "id": "prova-2",
        "slug": "prova-2-semestre-passado",
        "title": "Prova 2",
        "sourceFolderName": "PROVA-2",
        "markdownPath": "C:\\Users\\emano\\OneDrive\\Documentos\\Downloads\\PROVAS\\PROVA-2\\PROVA-2.MD",
        "imagePath": "C:\\Users\\emano\\OneDrive\\Documentos\\Downloads\\PROVAS\\PROVA-2\\PROVA-2.jpeg",
        "discipline": "Bases Matemáticas",
        "semester": "semestre_passado",
        "type": "avaliacao",
        "hasGraphs": false,
        "graphAssets": [],
        "questions": [
            {
                "id": "q1",
                "number": "1",
                "statement": "Resolva as seguintes equações:\n\na)\n\\[\n2 \\cdot 4^{x+2} - 5 \\cdot 4^{x+1} - 3 \\cdot 2^{2x+1} - 4^x = 20\n\\]\n\nb)\n\\[\n\\log_2 x = \\log_3 \\sqrt{x + 2}\n\\]",
                "topics": [
                    "equacoes_exponenciais",
                    "logaritmos",
                    "potencias"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q2",
                "number": "2",
                "statement": "Resolva as seguintes inequações:\n\na)\n\\[\n\\log_5 (x^2 - x) > \\log_{0,2} \\left(\\frac{1}{4}\\right)\n\\]\n\nb)\n\\[\n\\log(x^2) - 3\\log x^2 - 4 > 0\n\\]",
                "topics": [
                    "inequacoes_logaritmicas",
                    "logaritmos"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q3",
                "number": "3",
                "statement": "Sob a temperatura de **25ºC**, uma amostra de suco de limão apresenta:\n\n\\[\n[H^+] = 2,5 \\cdot 10^{-4} \\text{ mol/L}\n\\]\n\nSabendo que por definição a potência de hidrogênio (**pH**) é dada por:\n\n\\[\npH = -\\log[H^+]\n\\]\n\ncalcule o valor de pH da amostra de limão nessa temperatura.\n\n**Assuma:** \\(\\log 2 = 0,3\\)",
                "topics": [
                    "logaritmos",
                    "aplicacao",
                    "ph"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q4",
                "number": "4",
                "statement": "Determine o período, a paridade, a imagem e o gráfico da restrição a um período completo das funções a seguir:\n\na)\n\\[\n\\tan x\n\\]\n\nb)\n\\[\n\\cos x\n\\]",
                "topics": [
                    "trigonometria",
                    "periodo",
                    "paridade",
                    "imagem",
                    "graficos"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q5",
                "number": "5",
                "statement": "Calcule:\n\na)\n\\[\n\\tan\\left(\\frac{\\pi}{6}\\right)\n\\]\n\nb)\n\\[\n\\sen\\left(2\\arcsen\\left(-\\frac{1}{2}\\right)\\right)\n\\]",
                "topics": [
                    "trigonometria",
                    "arco",
                    "identidades_trigonometricas"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q6",
                "number": "6",
                "statement": "Uma pessoa está olhando para um prédio que está em um terreno plano.\n\nInicialmente, ela vê o prédio sob um ângulo de **60º**. Em seguida, ela anda **20 metros para trás** e passa a ver o prédio sob um ângulo de **45º**.\n\nQual a altura do prédio, sabendo que a pessoa tem **1,7 m** de altura?",
                "topics": [
                    "trigonometria",
                    "aplicacao",
                    "angulo_de_elevacao"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            }
        ],
        "publicImagePath": "/exam-support/PROVA-2/PROVA-2.jpeg"
    },
    {
        "id": "prova-3",
        "slug": "prova-3-semestre-passado",
        "title": "1ª Avaliação",
        "sourceFolderName": "PROVA-3",
        "markdownPath": "C:\\Users\\emano\\OneDrive\\Documentos\\Downloads\\PROVAS\\PROVA-3\\PROVA-3.MD",
        "imagePath": "C:\\Users\\emano\\OneDrive\\Documentos\\Downloads\\PROVAS\\PROVA-3\\PROVA-3.jpeg",
        "discipline": "Bases Matemáticas - CTIA03 - T02",
        "semester": "semestre_passado",
        "type": "avaliacao",
        "hasGraphs": true,
        "graphAssets": [
            {
                "id": "prova-3-q2-graph",
                "examId": "prova-3",
                "questionId": "q2",
                "sourceImagePath": "C:\\Users\\emano\\OneDrive\\Documentos\\Downloads\\PROVAS\\PROVA-3\\PROVA-3.jpeg",
                "graphType": "line",
                "renderMode": "svg",
                "reconstructed": true,
                "payload": {
                    "type": "line",
                    "xLabel": "preço",
                    "yLabel": "xícaras por mês",
                    "points": [
                        [
                            2,
                            500
                        ],
                        [
                            5,
                            200
                        ],
                        [
                            7,
                            0
                        ]
                    ],
                    "guides": {
                        "vertical": [
                            2,
                            5
                        ],
                        "horizontal": [
                            500,
                            200
                        ]
                    }
                }
            }
        ],
        "questions": [
            {
                "id": "q1",
                "number": "1",
                "statement": "Dados os intervalos:\n\n\\[\nA = [-1,4], \\quad B = [1,5], \\quad C = [2,4], \\quad D = [1,3]\n\\]\n\no número **1** pertence ao conjunto\n\n\\[\n(A \\cap B) - (D - C)\n\\]\n\n?",
                "topics": [
                    "intervalos",
                    "conjuntos",
                    "interseccao",
                    "diferenca"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q2",
                "number": "2",
                "statement": "Em uma cantina de lanches, o consumo de xícaras de café por mês em função do preço é dado pelo seguinte gráfico.\n\nCom base nessas informações, responda:\n\na) Qual é a função \\(C(x)\\) que fornece o consumo de xícaras de café por mês em função do preço?\n\nb) Para qual preço o consumo de xícaras de café por mês chega a zero?\n\nc) A função \\(C(x)\\) é crescente ou decrescente? Justifique.\n\nd) Para qual preço da xícara de café haverá o maior lucro bruto com a venda de xícaras de café no mês?",
                "topics": [
                    "funcao_afim",
                    "graficos",
                    "interpretacao_de_grafico",
                    "lucro"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": "prova-3-q2-graph"
            },
            {
                "id": "q3",
                "number": "3",
                "statement": "Defina e faça um exemplo dos conceitos a seguir:\n\na) Intervalo fechado à esquerda e aberto à direita;\n\nb) Função par;\n\nc) Função ímpar;\n\nd) Composição de funções.",
                "topics": [
                    "conceitos_basicos",
                    "intervalos",
                    "funcao_par",
                    "funcao_impar",
                    "composicao"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q4",
                "number": "4",
                "statement": "Considere a função quadrática (f : \\mathbb{R} \\to \\mathbb{R}) cujo gráfico passa pelos pontos:\n\n[\nA = (0,1), \\quad B = (-2,0), \\quad C = (1,0)\n]\n\nDetermine:\n\na) A lei de formação de (f);\n\nb) O valor mínimo absoluto de (f);\n\nc) O intervalo em que (f) é crescente.",
                "topics": [
                    "funcao_quadratica",
                    "raizes",
                    "vertice",
                    "crescimento"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q5",
                "number": "5",
                "statement": "Se\n\n[\nf(x) = \\frac{2}{7}x - 2\n]\n\ne\n\n[\ng(x) = \\frac{5}{3}x + a\n]\n\nsão tais que\n\n[\nf \\circ g(0) = 1\n]\n\ndetermine:\n\n[\nf(7) + 3g\\left(\\frac{1}{5}\\right)\n]",
                "topics": [
                    "funcao_afim",
                    "composicao",
                    "parametro"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            },
            {
                "id": "q6",
                "number": "extra",
                "statement": "Esboce o gráfico e determine o domínio da seguinte função:\n\n[\nf(x)=\n\\begin{cases}\n\\sqrt{x}, & \\text{se } x \\ge 0 \nx^2 - 2, & \\text{se } x < 0\n\\end{cases}\n]",
                "topics": [
                    "funcao_por_partes",
                    "dominio",
                    "graficos"
                ],
                "answerSchema": {
                    "hasScratchpad": true,
                    "hasOfficialAnswerField": true
                },
                "graphRef": null
            }
        ],
        "publicImagePath": "/exam-support/PROVA-3/PROVA-3.jpeg"
    }
] as ImportedExam[];

export const IMPORTED_GRAPH_ASSETS: ExamGraphAsset[] = [
    {
        "id": "prova-3-q2-graph",
        "examId": "prova-3",
        "questionId": "q2",
        "sourceImagePath": "C:\\Users\\emano\\OneDrive\\Documentos\\Downloads\\PROVAS\\PROVA-3\\PROVA-3.jpeg",
        "graphType": "line",
        "renderMode": "svg",
        "reconstructed": true,
        "payload": {
            "type": "line",
            "xLabel": "preço",
            "yLabel": "xícaras por mês",
            "points": [
                [
                    2,
                    500
                ],
                [
                    5,
                    200
                ],
                [
                    7,
                    0
                ]
            ],
            "guides": {
                "vertical": [
                    2,
                    5
                ],
                "horizontal": [
                    500,
                    200
                ]
            }
        }
    }
] as ExamGraphAsset[];
