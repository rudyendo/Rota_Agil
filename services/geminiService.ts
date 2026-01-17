
import { GoogleGenAI, Type } from "@google/genai";

const customerSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nome completo do cliente" },
      address: { type: Type.STRING, description: "Endereço completo" },
      neighborhood: { type: Type.STRING, description: "Bairro" },
      city: { type: Type.STRING, description: "Cidade" },
      state: { type: Type.STRING, description: "Estado" },
      phone: { type: Type.STRING, description: "Telefone" },
      status: { type: Type.STRING, description: "Status" }
    },
    required: ["name"]
  }
};

/**
 * Inicializa o cliente AI. No Vercel, process.env.API_KEY é injetado automaticamente.
 * Criamos a instância sempre no momento do uso para garantir que a chave mais atual seja utilizada.
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const parseFileToCustomers = async (base64Data: string, mimeType: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: "Extraia cada linha da tabela como JSON. Não pule ninguém." }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: customerSchema,
    },
  });
  return JSON.parse(response.text || "[]");
};

export const parseRawTextToCustomers = async (text: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Transforme em JSON: ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: customerSchema,
    },
  });
  return JSON.parse(response.text || "[]");
};

export const optimizeRouteOrder = async (addresses: string[]) => {
  const ai = getAiClient();
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Você é um especialista em logística de vendas externas.
    Sua tarefa é REORDENAR a lista para o MENOR PERCURSO GERAL começando pela ORIGEM (GPS).

    REGRAS:
    1. O primeiro item é a ORIGEM. Mantenha-o no topo da lista final.
    2. Agrupe endereços por proximidade geográfica extrema (mesma rua ou quarteirão).
    3. Organize por bairros vizinhos para evitar que o vendedor atravesse a cidade várias vezes.
    4. O objetivo é economizar combustível e tempo.

    DADOS:
    ${addresses.join('\n')}`,
    config: {
      thinkingConfig: { thinkingBudget: 15000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
  });
  
  return JSON.parse(response.text || "[]");
};
