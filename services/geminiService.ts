
import { GoogleGenAI, Type } from "@google/genai";

// Schema para extração de dados de clientes
const customerSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nome completo do cliente" },
      address: { type: Type.STRING, description: "Endereço completo (Rua, Número, etc.)" },
      neighborhood: { type: Type.STRING, description: "Bairro" },
      city: { type: Type.STRING, description: "Cidade" },
      state: { type: Type.STRING, description: "Estado" },
      phone: { type: Type.STRING, description: "Telefone de contato" },
      status: { type: Type.STRING, description: "Observação de status" }
    },
    required: ["name"]
  }
};

/**
 * Extrai informações de clientes de arquivos (imagens, PDFs) usando IA.
 */
export const parseFileToCustomers = async (base64Data: string, mimeType: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: `Você é um robô de extração de dados especializado em tabelas de rotas comerciais. 
      Extraia CADA LINHA da tabela como um objeto JSON. Não pule nenhuma linha.
      Retorne uma lista JSON pura.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [filePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: customerSchema,
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Erro na extração:", error);
    throw error;
  }
};

/**
 * Converte texto bruto em JSON de clientes.
 */
export const parseRawTextToCustomers = async (text: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Transforme o texto em JSON de clientes: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: customerSchema,
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Erro no texto:", error);
    throw error;
  }
};

/**
 * Otimiza a ordem dos endereços focando no MENOR PERCURSO GERAL.
 */
export const optimizeRouteOrder = async (addresses: string[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Você é um motor de otimização logística avançado. Sua missão é resolver o Problema do Caixeiro Viajante para a lista abaixo.
      
      OBJETIVO: Retornar a sequência de endereços que resulta no MENOR PERCURSO TOTAL em quilômetros.
      
      REGRAS DE OURO:
      1. O PRIMEIRO endereço (coordenadas ou texto) é o PONTO DE PARTIDA ATUAL. Ele deve permanecer na posição index 0.
      2. Agrupe pontos por proximidade geográfica radical. Se dois endereços estão no mesmo bairro ou rua, eles devem ser visitados em sequência.
      3. Evite "vaivém": A rota deve fluir como uma linha contínua ou um círculo eficiente, nunca cruzando a cidade de um lado para o outro repetidamente.
      4. Analise a lógica dos nomes de ruas e numeração para deduzir a continuidade.
      5. Retorne APENAS o array JSON com os endereços na nova ordem.

      LISTA DE ENDEREÇOS (O primeiro é a origem):
      ${addresses.join('\n')}`,
      config: {
        thinkingConfig: { thinkingBudget: 8192 }, // Aumentado para permitir análise espacial mais profunda
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Erro na otimização de percurso:", error);
    return addresses;
  }
};
